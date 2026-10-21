import { createHmac, timingSafeEqual } from 'node:crypto';

const PROVIDER_BASE = 'https://2factor.in/API/V1';
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 3;
const HOUR_MS = 60 * 60 * 1000;

// Best-effort limits: state is per warm function instance, not shared across instances.
const state = { lastSent: new Map(), mobileHits: new Map(), ipHits: new Map(), attempts: new Map(), used: new Set() };
export const resetOtpState = () => Object.values(state).forEach(s => s.clear());

const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });
const intEnv = (env, name, fallback) => { const v = Number.parseInt(env[name] ?? '', 10); return Number.isFinite(v) && v > 0 ? v : fallback; };
const b64 = (s) => Buffer.from(s).toString('base64url');
const sign = (payload, secret) => createHmac('sha256', secret).update(payload).digest('base64url');

function config(env) {
  const apiKey = env.TWOFACTOR_API_KEY;
  const secret = env.OTP_CHALLENGE_SECRET;
  if (!apiKey || !secret) {
    console.error('OTP configuration error: TWOFACTOR_API_KEY and OTP_CHALLENGE_SECRET must be set.');
    return null;
  }
  return { apiKey, secret, template: env.TWOFACTOR_TEMPLATE_NAME || '', cooldown: intEnv(env, 'OTP_RESEND_COOLDOWN_SECONDS', 30), maxPerHour: intEnv(env, 'OTP_MAX_REQUESTS_PER_HOUR', 5), maxPerIpHour: intEnv(env, 'OTP_MAX_REQUESTS_PER_IP_HOUR', 20), timeoutMs: intEnv(env, 'TWOFACTOR_TIMEOUT_MS', 8000) };
}

const unavailable = () => json(503, { message: 'OTP service is not available. Please try again later.' });
const normalizeMobile = (v) => { const m = String(v ?? ''); return /^[6-9]\d{9}$/.test(m) ? m : null; };

function hit(map, key, windowMs, now) {
  const recent = (map.get(key) || []).filter(t => now - t < windowMs);
  map.set(key, recent);
  return recent;
}

async function callProvider(url, timeoutMs, fetchImpl) {
  try {
    const res = await fetchImpl(url, { method: 'GET', signal: AbortSignal.timeout(timeoutMs) });
    const data = await res.json().catch(() => null);
    return { ok: true, data, httpStatus: res.status };
  } catch {
    return { ok: false };
  }
}

export async function requestOtp(req, { env = process.env, fetchImpl = fetch, now = Date.now() } = {}) {
  if (req.method !== 'POST') return json(405, { message: 'Method not allowed.' });
  const cfg = config(env);
  if (!cfg) return unavailable();
  const body = await req.json().catch(() => ({}));
  const mobile = normalizeMobile(body.mobileNumber);
  if (!mobile) return json(400, { message: 'Enter a valid 10-digit mobile number.' });
  if (body.termsAccepted !== 'true' && body.termsAccepted !== true) return json(400, { message: 'Please accept the terms and privacy notice to continue.' });

  const ip = (req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
  const last = state.lastSent.get(mobile);
  if (last && now - last < cfg.cooldown * 1000) {
    const retryAfter = Math.ceil((cfg.cooldown * 1000 - (now - last)) / 1000);
    return json(429, { message: `Please wait ${retryAfter}s before requesting another OTP.`, retryAfter }, { 'Retry-After': String(retryAfter) });
  }
  const mobileRecent = hit(state.mobileHits, mobile, HOUR_MS, now);
  const ipRecent = hit(state.ipHits, ip, HOUR_MS, now);
  if (mobileRecent.length >= cfg.maxPerHour || ipRecent.length >= cfg.maxPerIpHour) {
    return json(429, { message: 'Too many OTP requests. Please try again later.', retryAfter: 3600 }, { 'Retry-After': '3600' });
  }

  const template = cfg.template ? `/${encodeURIComponent(cfg.template)}` : '';
  const result = await callProvider(`${PROVIDER_BASE}/${encodeURIComponent(cfg.apiKey)}/SMS/91${mobile}/AUTOGEN${template}`, cfg.timeoutMs, fetchImpl);
  const sessionId = result.ok && result.data?.Status === 'Success' ? String(result.data.Details || '') : '';
  if (!sessionId) {
    console.error('2Factor send failed', { reached: result.ok, status: result.data?.Status, details: result.data?.Details });
    return json(502, { message: 'OTP could not be sent. Please try again later.' });
  }

  state.lastSent.set(mobile, now);
  mobileRecent.push(now); ipRecent.push(now);
  const payload = b64(JSON.stringify({ s: sessionId, m: mobile, e: now + CHALLENGE_TTL_MS }));
  console.info('OTP requested', { mobileSuffix: mobile.slice(-2) });
  return json(200, { message: 'OTP sent to your mobile number.', challengeToken: `${payload}.${sign(payload, cfg.secret)}`, resendAfterSeconds: cfg.cooldown });
}

function readChallenge(token, secret, now) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try { const c = JSON.parse(Buffer.from(payload, 'base64url').toString()); return c.e > now ? c : { expired: true }; } catch { return null; }
}

export async function verifyOtp(req, { env = process.env, fetchImpl = fetch, now = Date.now() } = {}) {
  if (req.method !== 'POST') return json(405, { message: 'Method not allowed.' });
  const cfg = config(env);
  if (!cfg) return unavailable();
  const body = await req.json().catch(() => ({}));
  const mobile = normalizeMobile(body.mobileNumber);
  const otp = String(body.otp ?? '');
  if (!mobile || !/^\d{6}$/.test(otp)) return json(400, { message: 'Enter the mobile number and the 6-digit OTP.' });

  const challenge = readChallenge(body.challengeToken, cfg.secret, now);
  if (challenge?.expired) return json(401, { message: 'OTP expired. Please request a new OTP.' });
  if (!challenge || challenge.m !== mobile) return json(401, { message: 'Please request a new OTP.' });
  if (state.used.has(challenge.s)) return json(401, { message: 'This OTP has already been used. Please request a new OTP.' });
  const tries = state.attempts.get(challenge.s) || 0;
  if (tries >= MAX_VERIFY_ATTEMPTS) return json(429, { message: 'Too many incorrect attempts. Please request a new OTP.' });
  state.attempts.set(challenge.s, tries + 1);

  const result = await callProvider(`${PROVIDER_BASE}/${encodeURIComponent(cfg.apiKey)}/SMS/VERIFY/${encodeURIComponent(challenge.s)}/${otp}`, cfg.timeoutMs, fetchImpl);
  if (!result.ok || (result.httpStatus >= 500)) {
    state.attempts.set(challenge.s, tries);
    return json(503, { message: 'OTP verification is temporarily unavailable. Please try again.' });
  }
  const { Status, Details } = result.data || {};
  if (Status === 'Success' && /matched/i.test(String(Details))) {
    state.used.add(challenge.s);
    // The rest of this demo app trusts "demo-" tokens held in the browser; replace with a real session issuer in production.
    return json(200, { accessToken: `demo-user-${mobile}` });
  }
  if (/expired/i.test(String(Details))) return json(401, { message: 'OTP expired. Please request a new OTP.' });
  return json(401, { message: 'Invalid OTP.' });
}

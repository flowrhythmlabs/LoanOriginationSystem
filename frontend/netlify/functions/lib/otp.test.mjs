import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { requestOtp, verifyOtp, resetOtpState } from './otp.mjs';

const env = { TWOFACTOR_API_KEY: 'test-key-123', OTP_CHALLENGE_SECRET: 'test-secret', OTP_RESEND_COOLDOWN_SECONDS: '30' };
const mobile = '9876543210';
const post = (body) => new Request('http://x/api', { method: 'POST', headers: { 'x-nf-client-connection-ip': '1.1.1.1' }, body: JSON.stringify(body) });
const provider = (data, status = 200) => async () => new Response(JSON.stringify(data), { status });
const sent = provider({ Status: 'Success', Details: 'session-1' });
const reqBody = { mobileNumber: mobile, termsAccepted: 'true' };

beforeEach(() => resetOtpState());

async function challenge(now = 1000) {
  const res = await requestOtp(post(reqBody), { env, fetchImpl: sent, now });
  return (await res.json()).challengeToken;
}

test('request OTP succeeds and never returns the OTP or key', async () => {
  const res = await requestOtp(post(reqBody), { env, fetchImpl: sent, now: 1000 });
  const text = JSON.stringify(await res.json());
  assert.equal(res.status, 200);
  assert.ok(!/test-key-123|demoOtp|"otp"/.test(text));
});

test('request OTP rejects invalid mobile and missing terms', async () => {
  assert.equal((await requestOtp(post({ mobileNumber: '123', termsAccepted: 'true' }), { env, fetchImpl: sent })).status, 400);
  assert.equal((await requestOtp(post({ mobileNumber: mobile }), { env, fetchImpl: sent })).status, 400);
});

test('resend cooldown and hourly limit', async () => {
  await requestOtp(post(reqBody), { env, fetchImpl: sent, now: 1000 });
  assert.equal((await requestOtp(post(reqBody), { env, fetchImpl: sent, now: 2000 })).status, 429);
  const e = { ...env, OTP_MAX_REQUESTS_PER_HOUR: '2' };
  assert.equal((await requestOtp(post(reqBody), { env: e, fetchImpl: sent, now: 40000 })).status, 200);
  assert.equal((await requestOtp(post(reqBody), { env: e, fetchImpl: sent, now: 80000 })).status, 429);
});

test('missing API key fails safely', async () => {
  const res = await requestOtp(post(reqBody), { env: {}, fetchImpl: sent });
  assert.equal(res.status, 503);
});

test('provider failure and timeout do not send or authenticate', async () => {
  assert.equal((await requestOtp(post(reqBody), { env, fetchImpl: provider({ Status: 'Error', Details: 'x' }) })).status, 502);
  const boom = async () => { throw new Error('timeout'); };
  assert.equal((await requestOtp(post(reqBody), { env, fetchImpl: boom })).status, 502);
  const token = await challenge();
  const res = await verifyOtp(post({ mobileNumber: mobile, otp: '123456', challengeToken: token }), { env, fetchImpl: boom, now: 2000 });
  assert.equal(res.status, 503);
  assert.equal((await res.json()).accessToken, undefined);
});

test('verify succeeds once, replay rejected', async () => {
  const token = await challenge();
  const ok = provider({ Status: 'Success', Details: 'OTP Matched' });
  const res = await verifyOtp(post({ mobileNumber: mobile, otp: '123456', challengeToken: token }), { env, fetchImpl: ok, now: 2000 });
  assert.equal(res.status, 200);
  assert.ok((await res.json()).accessToken);
  assert.equal((await verifyOtp(post({ mobileNumber: mobile, otp: '123456', challengeToken: token }), { env, fetchImpl: ok, now: 3000 })).status, 401);
});

test('incorrect and expired OTP', async () => {
  const token = await challenge();
  const bad = provider({ Status: 'Error', Details: 'OTP Mismatch' });
  assert.equal((await verifyOtp(post({ mobileNumber: mobile, otp: '000000', challengeToken: token }), { env, fetchImpl: bad, now: 2000 })).status, 401);
  const exp = provider({ Status: 'Error', Details: 'OTP Expired' });
  const res = await verifyOtp(post({ mobileNumber: mobile, otp: '000000', challengeToken: token }), { env, fetchImpl: exp, now: 3000 });
  assert.match((await res.json()).message, /expired/i);
  const late = await verifyOtp(post({ mobileNumber: mobile, otp: '000000', challengeToken: token }), { env, fetchImpl: bad, now: 1000 + 6 * 60 * 1000 });
  assert.match((await late.json()).message, /expired/i);
});

test('verification attempts are limited', async () => {
  const token = await challenge();
  const bad = provider({ Status: 'Error', Details: 'OTP Mismatch' });
  const statuses = [];
  for (let i = 0; i < 4; i++) statuses.push((await verifyOtp(post({ mobileNumber: mobile, otp: '000000', challengeToken: token }), { env, fetchImpl: bad, now: 2000 })).status);
  assert.deepEqual(statuses, [401, 401, 401, 429]);
});

test('tampered token or different mobile is rejected', async () => {
  const token = await challenge();
  const ok = provider({ Status: 'Success', Details: 'OTP Matched' });
  assert.equal((await verifyOtp(post({ mobileNumber: mobile, otp: '123456', challengeToken: token + 'x' }), { env, fetchImpl: ok, now: 2000 })).status, 401);
  assert.equal((await verifyOtp(post({ mobileNumber: '9123456780', otp: '123456', challengeToken: token }), { env, fetchImpl: ok, now: 2000 })).status, 401);
});

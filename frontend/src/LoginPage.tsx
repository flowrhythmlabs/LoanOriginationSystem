import { demoFetch } from './mockApi';
import { useEffect, useMemo, useRef, useState } from 'react';
import { clearAuth, persistAuth, readStoredAuth, type AuthSession } from './auth';

const initialMode = 'user';

type LoginMode = 'user' | 'admin';

type UserLoginState = {
  mobile: string;
  otp: string;
  otpSent: boolean;
  challengeToken: string;
  otpError: string;
  authError: string;
};

type AdminLoginState = {
  username: string;
  password: string;
  authError: string;
};

export function LoginPage({ onAuthenticated }: { onAuthenticated: (session: AuthSession) => void }) {
  const [mode, setMode] = useState<LoginMode>(initialMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [otpAttemptsRemaining, setOtpAttemptsRemaining] = useState(3);
  const [resendSeconds, setResendSeconds] = useState(0);
  const verifyingRef = useRef(false);
  useEffect(() => { if (resendSeconds <= 0) return; const timer = window.setTimeout(() => setResendSeconds(value => value - 1), 1000); return () => window.clearTimeout(timer); }, [resendSeconds]);
  const [userState, setUserState] = useState<UserLoginState>({
    mobile: '',
    otp: '',
    otpSent: false,
    challengeToken: '',
    otpError: '',
    authError: ''
  });
  const [adminState, setAdminState] = useState<AdminLoginState>({
    username: '',
    password: '',
    authError: ''
  });

  const authSummary = useMemo(() => readStoredAuth(), []);

  const onUserSendOtp = async () => {
    const mobile = userState.mobile;
    if (!consentAccepted) { setTermsError(true); return; }
    setTermsError(false);
    if (!/^\d{10}$/.test(mobile)) {
      setUserState((prev) => ({ ...prev, otpError: 'Please enter a valid 10-digit mobile number.' }));
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await demoFetch('/api/auth/otp/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNumber: mobile, termsAccepted: String(consentAccepted), consentVersion: 'v1' })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (typeof result.retryAfter === 'number' && result.retryAfter <= 600) setResendSeconds(result.retryAfter);
        throw new Error(result.message || 'OTP could not be sent. Please try again later.');
      }
      setUserState((prev) => ({ ...prev, otpSent: true, challengeToken: String(result.challengeToken || ''), otp: '', otpError: '', authError: '' })); setOtpAttemptsRemaining(3); setResendSeconds(Number(result.resendAfterSeconds) || 30);
    } catch (error) {
      setUserState((prev) => ({ ...prev, otpError: error instanceof Error && error.name !== 'TypeError' ? error.message : 'Network error. Check your connection and try again.' }));
    } finally { setIsSubmitting(false); }
  };

  const onUserVerifyOtp = async () => {
    if (verifyingRef.current) return;
    const mobile = userState.mobile;
    if (!/^\d{10}$/.test(mobile)) {
      setUserState((prev) => ({ ...prev, authError: 'Please enter a valid 10-digit mobile number.' }));
      return;
    }
    if (!userState.otpSent || !/^\d{6}$/.test(userState.otp)) {
      setUserState((prev) => ({ ...prev, authError: 'Enter the 6-digit OTP sent to your mobile number.' }));
      return;
    }
    setIsSubmitting(true);
    verifyingRef.current = true;
    try {
      const response = await demoFetch('/api/auth/login/user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNumber: mobile, otp: userState.otp, challengeToken: userState.challengeToken })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.accessToken) throw new Error(result.message || 'OTP verification failed.');
      const session: AuthSession = { authenticated: true, role: 'USER', mobile, accessToken: result.accessToken };
      persistAuth(session); onAuthenticated(session);
    } catch (error) {
      setOtpAttemptsRemaining(value => Math.max(0, value - 1)); setUserState((prev) => ({ ...prev, otp: '', authError: `${error instanceof Error ? error.message : 'OTP verification failed.'} ${Math.max(0, otpAttemptsRemaining - 1)} attempts left.` }));
    } finally { verifyingRef.current = false; setIsSubmitting(false); }
  };

  useEffect(() => {
    if (userState.otpSent && /^\d{6}$/.test(userState.otp) && !isSubmitting && otpAttemptsRemaining > 0) {
      void onUserVerifyOtp();
    }
    // OTP verification is intentionally triggered only when the six-digit value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userState.otp, userState.otpSent]);

  const onAdminLogin = async () => {
    const username = adminState.username.trim();
    if (!username || !adminState.password) {
      setAdminState((prev) => ({ ...prev, authError: 'Username and password are required.' }));
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await demoFetch('/api/auth/login/admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: adminState.password })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.accessToken) throw new Error(result.message || 'Invalid username or password.');
      const session: AuthSession = { authenticated: true, role: 'ADMIN', username, accessToken: result.accessToken };
      persistAuth(session); onAuthenticated(session);
    } catch (error) {
      setAdminState((prev) => ({ ...prev, authError: error instanceof Error ? error.message : 'Login failed.' }));
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="auth-page-shell">
      <div className="auth-glow auth-glow-left" />
      <div className="auth-glow auth-glow-right" />
      <aside className="auth-design-panel">
        <div className="design-brand-row"><div className="design-brand-mark"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 18 30 3v10L16 22v21L6 37Z" fill="#1470b8"/><path d="m20 27 22-13v11L20 39Z" fill="#5ac8c5"/></svg></div><div><div className="design-brand">FinEdge NBFC</div><div className="design-tagline">Your Growth. Our Support.</div></div></div>
        <h1>Your Dreams<br/>Our Priority</h1>
        <p>Quick, simple and secure loan solutions for a better tomorrow.</p>
        <div className="design-feature"><span>ϟ</span><div><strong>Fast Processing</strong><small>Get decisions in minutes</small></div></div>
        <div className="design-feature"><span>✓</span><div><strong>Secure &amp; Trusted</strong><small>Your data is always protected</small></div></div>
        <div className="design-feature"><span>♙</span><div><strong>Easy Application</strong><small>Complete in a few simple steps</small></div></div>
        <div className="design-illustration" aria-hidden="true"><img src="/login-illustration.png" alt="" /><div className="illustration-slogan">Build<br/>Your Future<br/>with Us</div></div>
      </aside>
      <div className="auth-card">
        <div className="new-login-top"><span>◎ English⌄</span></div>
        {mode === 'user' && (
          <div className="auth-form">
            <div className="new-login-welcome">
              <div className="user-avatar" aria-label="User avatar"><img src="/approved-user-avatar.png" alt="Welcome back" /></div>
              <div><h2>Welcome Back!</h2><p>Login to continue with your<br/>loan application.</p></div>
            </div>
            <label className="auth-field">
              <span>Mobile Number <em className="login-required">*</em></span>
              <input
                type="tel"
                value={userState.mobile}
                onChange={(event) => {
                  const value = event.target.value;
                  if (/\D/.test(value)) {
                    setUserState((prev) => ({ ...prev, authError: 'Mobile number must contain digits only.', otpError: '' }));
                    return;
                  }
                  setUserState((prev) => ({ ...prev, mobile: value.slice(0, 10), otpSent: false, challengeToken: '', otp: '', authError: '', otpError: '' })); setConsentAccepted(false);
                }}
                onPaste={(event) => {
                  if (/\D/.test(event.clipboardData.getData('text'))) {
                    event.preventDefault();
                    setUserState((prev) => ({ ...prev, authError: 'Mobile number must contain digits only.', otpError: '' }));
                  }
                }}
                placeholder="Enter 10-digit mobile number"
                inputMode="numeric"
                maxLength={10}
                autoComplete="tel"
              />
            </label>

            {userState.otpSent && <label className="auth-field login-otp-field">
              <span>OTP <em className="login-required">*</em></span>
              <div className="otp-boxes" style={{display:'grid',gridTemplateColumns:'repeat(6,minmax(0,1fr))',gap:8}}>
                {Array.from({length:6}, (_, index) => <input key={index} id={`otp-box-${index}`} type="text" inputMode="numeric" maxLength={index === 0 ? 6 : 1} disabled={!userState.otpSent || isSubmitting} autoComplete={index === 0 ? 'one-time-code' : 'off'} aria-label={`OTP digit ${index + 1}`} value={userState.otp[index] || ''} onChange={event => { const raw = event.target.value.replace(/\D/g,''); if (raw.length > 1) { setUserState(prev => ({...prev, otp: raw.slice(0,6), authError:''})); document.getElementById(`otp-box-${Math.min(raw.length,6)-1}`)?.focus(); return; } const digits = userState.otp.padEnd(6,' ').split(''); digits[index] = raw || ' '; const next = digits.join('').trimEnd().replace(/ /g,''); setUserState(prev => ({...prev, otp: next, authError:''})); if (raw && index < 5) document.getElementById(`otp-box-${index+1}`)?.focus(); }} onPaste={event => { const digits = event.clipboardData.getData('text').replace(/\D/g,'').slice(0,6); if (digits) { event.preventDefault(); setUserState(prev => ({...prev, otp:digits, authError:''})); document.getElementById(`otp-box-${Math.min(digits.length,6)-1}`)?.focus(); } }} />)}
              </div>
              <div className="login-otp-help"><span>{userState.otpSent ? 'OTP verifies automatically after all 6 digits are entered.' : 'Enter your mobile number and select Continue to receive an OTP.'}</span>{userState.otpSent && <button type="button" className="login-resend" onClick={onUserSendOtp} disabled={isSubmitting || resendSeconds > 0}>{resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend OTP'}</button>}</div>
            </label>}
            <label className={`auth-field auth-consent${termsError ? ' has-error' : ''}`}><input type="checkbox" checked={consentAccepted} disabled={userState.otpSent} aria-invalid={termsError} aria-describedby={termsError ? 'terms-error' : undefined} onChange={e => { setConsentAccepted(e.target.checked); if (e.target.checked) setTermsError(false); }} /><span>I agree to the <a href="/terms.html" target="_blank" rel="noreferrer">Terms &amp; Conditions</a> and <a href="/privacy.html" target="_blank" rel="noreferrer">Privacy Policy</a>.</span></label>
            {termsError && <div id="terms-error" className="terms-error" role="alert">Please select Terms &amp; Conditions to continue.</div>}
            <button type="button" className="primary auth-submit" onClick={userState.otpSent ? onUserVerifyOtp : onUserSendOtp} disabled={isSubmitting || (userState.otpSent && userState.otp.length !== 6)}>
              {isSubmitting ? (userState.otpSent ? 'Verifying...' : 'Sending OTP...') : (userState.otpSent ? 'Login' : 'Continue')}
            </button>
            {userState.otpError && <div className="auth-error">{userState.otpError}</div>}
            {userState.authError && <div className="auth-error">{userState.authError}</div>}
          </div>
        )}

        {mode === 'admin' && (
          <div className="auth-form">
            <div className="auth-form-header">
              <div>
                <h2>Admin Login</h2>
                <p>Manage applications and approvals.</p>
              </div>
            </div>

            <label className="auth-field">
              <span>Username</span>
              <input
                type="text"
                value={adminState.username}
                onChange={(event) => setAdminState((prev) => ({ ...prev, username: event.target.value, authError: '' }))}
                placeholder="Enter admin username"
                autoComplete="username"
              />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <div className="password-wrap">
                <input
                  type={showAdminPassword ? 'text' : 'password'}
                  value={adminState.password}
                  onChange={(event) => setAdminState((prev) => ({ ...prev, password: event.target.value, authError: '' }))}
                  placeholder="Enter admin password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowAdminPassword((value) => !value)}
                  aria-label={showAdminPassword ? 'Hide password' : 'Show password'}
                >
                  {showAdminPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            <button type="button" className="primary auth-submit" onClick={onAdminLogin} disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Login'}
            </button>
            {adminState.authError && <div className="auth-error">{adminState.authError}</div>}
          </div>
        )}

        <div style={{textAlign:'center',marginTop:18,fontSize:12}}><button type="button" className="secondary" style={{background:'transparent',border:'none',padding:4,fontSize:12}} onClick={() => setMode(mode === 'user' ? 'admin' : 'user')}>{mode === 'user' ? 'Staff login' : 'Back to applicant login'}</button></div>

        {authSummary && (
          <button
            type="button"
            className="secondary auth-logout-inline"
            onClick={() => {
              clearAuth();
              window.location.reload();
            }}
          >
            Logout
          </button>
        )}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { clearAuth, persistAuth, readStoredAuth, type AuthSession } from './auth';

const initialMode = window.location.pathname.startsWith('/staff') ? 'admin' : 'user';
const demoMode = import.meta.env.VITE_DEMO_MODE === 'true';

type LoginMode = 'user' | 'admin';
type OtpLifecycle = 'idle' | 'sending' | 'request_accepted' | 'verification_pending' | 'verified' | 'failed';

type UserLoginState = {
  mobile: string;
  otp: string;
  otpSent: boolean;
  demoOtp: string;
  otpLifecycle: OtpLifecycle;
  otpStatus: string;
  otpError: string;
  authError: string;
};

type AdminLoginState = {
  username: string;
  password: string;
  authError: string;
};

export function LoginPage({ onAuthenticated }: { onAuthenticated: (session: AuthSession) => void }) {
  const [mode] = useState<LoginMode>(initialMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [staffChallengeId, setStaffChallengeId] = useState('');
  const [staffMfaCode, setStaffMfaCode] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [mobileError, setMobileError] = useState('');
  const [otpAttemptsRemaining, setOtpAttemptsRemaining] = useState(3);
  const [resendSeconds, setResendSeconds] = useState(0);
  const otpRequestInFlight = useRef(false);
  const otpVerificationInFlight = useRef(false);
  useEffect(() => { if (resendSeconds <= 0) return; const timer = window.setTimeout(() => setResendSeconds(value => value - 1), 1000); return () => window.clearTimeout(timer); }, [resendSeconds]);
  const [userState, setUserState] = useState<UserLoginState>({
    mobile: '',
    otp: '',
    otpSent: false,
    demoOtp: '',
    otpLifecycle: 'idle',
    otpStatus: '',
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
    if (otpRequestInFlight.current || isSubmitting || resendSeconds > 0) return;
    const mobile = userState.mobile;
    const invalidMobile = !/^\d{10}$/.test(mobile);
    setMobileError(invalidMobile ? (mobile ? 'Please enter a valid 10-digit mobile number.' : 'Mobile number is required.') : '');
    setTermsError(!consentAccepted);
    if (invalidMobile || !consentAccepted) return;

    otpRequestInFlight.current = true;
    setIsSubmitting(true);
    setUserState(prev => ({ ...prev, otpLifecycle: 'sending', otpError: '', authError: '' }));
    try {
      const response = await fetch('/api/auth/otp/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNumber: mobile, termsAccepted: String(consentAccepted), consentVersion: 'v1' })
      });
      const result = await response.json().catch(() => ({}));
      const retryAfter = Math.max(0, Number(result.retryAfterSeconds) || 0);
      if (response.status === 429) {
        setResendSeconds(retryAfter);
        setUserState(prev => {
          const hasActiveOtp = Boolean(result.requestPending || prev.otpSent);
          return {
            ...prev,
            otpSent: hasActiveOtp,
            otpLifecycle: hasActiveOtp ? 'verification_pending' : 'failed',
            otpStatus: '',
            otpError: 'Please wait before requesting another OTP.'
          };
        });
      } else if (result.requestState === 'VERIFICATION_PENDING') {
        setResendSeconds(retryAfter || 30);
        setOtpAttemptsRemaining(3);
        setUserState(prev => ({
          ...prev,
          otpSent: true,
          otpLifecycle: 'verification_pending',
          demoOtp: '',
          otp: '',
          otpStatus: '',
          otpError: 'We couldn’t send the OTP right now. Please try again shortly.',
          authError: ''
        }));
      } else if (!response.ok) {
        setResendSeconds(retryAfter);
        setUserState(prev => ({
          ...prev,
          otpSent: false,
          otpLifecycle: 'failed',
          demoOtp: '',
          otp: '',
          otpStatus: '',
          otpError: 'We couldn’t send the OTP right now. Please try again shortly.',
          authError: ''
        }));
      } else {
        setOtpAttemptsRemaining(3);
        setResendSeconds(retryAfter || 30);
        setUserState(prev => ({
          ...prev,
          otpSent: true,
          otpLifecycle: 'request_accepted',
          demoOtp: demoMode ? (result.demoOtp || '') : '',
          otpStatus: 'If your number is eligible, you will receive an OTP shortly.',
          otp: '',
          otpError: '',
          authError: ''
        }));
      }
    } catch (error) {
      setResendSeconds(30);
      setOtpAttemptsRemaining(3);
      setUserState(prev => ({
        ...prev,
        otpSent: true,
        otpLifecycle: 'verification_pending',
        demoOtp: '',
        otp: '',
        otpStatus: '',
        otpError: error instanceof TypeError
          ? 'Unable to connect. Please check your internet connection and try again.'
          : 'Something went wrong. Please try again.',
        authError: ''
      }));
    } finally {
      otpRequestInFlight.current = false;
      setIsSubmitting(false);
    }
  };

  const onUserVerifyOtp = async () => {
    const mobile = userState.mobile;

    if (!/^\d{10}$/.test(mobile)) {
      setUserState((prev) => ({ ...prev, authError: 'Please enter a valid 10-digit mobile number.' }));
      return;
    }

    if (!userState.otpSent || !/^\d{6}$/.test(userState.otp)) {
      setUserState((prev) => ({ ...prev, authError: 'Enter the 6-digit OTP sent to your mobile number.' }));
      return;
    }

    if (otpVerificationInFlight.current) return;

    otpVerificationInFlight.current = true;
    setIsSubmitting(true);
    setUserState(prev => ({ ...prev, otpLifecycle: 'verification_pending', authError: '' }));
    try {
      const response = await fetch('/api/auth/login/user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNumber: mobile, otp: userState.otp })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.accessToken) {
        const knownInvalidOtp = response.status === 401 && result.errorCode === 'INVALID_OTP';
        const expiredOtp = response.status === 401 && result.errorCode === 'EXPIRED_OTP';
        setUserState(prev => ({
          ...prev,
          otp: knownInvalidOtp || expiredOtp ? '' : prev.otp,
          otpLifecycle: 'failed',
          authError: expiredOtp
            ? 'This OTP has expired. Please request a new one.'
            : knownInvalidOtp
              ? 'The OTP you entered is incorrect. Please try again.'
              : 'Something went wrong. Please try again.'
        }));
        if (knownInvalidOtp || expiredOtp) setOtpAttemptsRemaining(value => Math.max(0, value - 1));
        return;
      }
      const session: AuthSession = { authenticated: true, role: 'USER', mobile, accessToken: result.accessToken };
      setUserState(prev => ({ ...prev, otpLifecycle: 'verified', authError: '' }));
      persistAuth(session); onAuthenticated(session);
    } catch (error) {
      setUserState(prev => ({
        ...prev,
        otp: '',
        otpLifecycle: 'failed',
        authError: error instanceof TypeError
          ? 'Unable to connect. Please check your internet connection and try again.'
          : 'Something went wrong. Please try again.'
      }));
    } finally {
      otpVerificationInFlight.current = false;
      setIsSubmitting(false);
    }
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
      setAdminState(prev => ({ ...prev, authError: 'Username and password are required.' }));
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/staff/auth/password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: adminState.password })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.challengeId) throw new Error(result.message || 'Staff sign-in failed.');
      setStaffChallengeId(result.challengeId);
      setStaffMfaCode('');
      setAdminState(prev => ({ ...prev, password: '', authError: '' }));
    } catch (error) {
      setAdminState(prev => ({ ...prev, authError: error instanceof Error ? error.message : 'Staff sign-in failed.' }));
    } finally { setIsSubmitting(false); }
  };

  const onStaffMfa = async () => {
    if (!/^\d{6}$/.test(staffMfaCode)) {
      setAdminState(prev => ({ ...prev, authError: 'Enter the 6-digit code from your authenticator.' }));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/staff/auth/mfa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: staffChallengeId, code: staffMfaCode })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.accessToken) throw new Error(result.message || 'MFA verification failed.');
      // The existing admin workspace uses ADMIN as its UI role; server permissions remain authoritative.
      const session: AuthSession = { authenticated: true, role: 'ADMIN', username: result.username || adminState.username.trim(), accessToken: result.accessToken };
    persistAuth(session);
    onAuthenticated(session);
    } catch (error) {
      setStaffMfaCode('');
      setAdminState(prev => ({ ...prev, authError: error instanceof Error ? error.message : 'MFA verification failed.' }));
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
        {demoMode && <div className="auth-demo-box" role="status">Demo environment</div>}



        <div className="new-login-top"><span>◎ English⌄</span></div>

        {mode === 'user' && (
          <div className="auth-form">
            <div className="new-login-welcome">
              <div className="user-avatar" aria-label="User avatar"><img src="/approved-user-avatar.png" alt="Welcome back" /></div>
              <div><h2>Welcome Back!</h2><p>Login to continue with your<br/>loan application.</p></div>
            </div>

            <label className={`auth-field${mobileError ? ' has-error' : ''}`}>
              <span>Mobile Number <em className="login-required">*</em></span>
              <input
                type="tel"
                value={userState.mobile}
                aria-invalid={!!mobileError}
                onChange={(event) => {
                  const value = event.target.value;
                  if (/\D/.test(value)) {
                    setUserState((prev) => ({ ...prev, authError: 'Mobile number must contain digits only.', otpError: '' }));
                    return;
                  }
                  setMobileError('');
                  setUserState((prev) => ({ ...prev, mobile: value.slice(0, 10), otpSent: false, demoOtp: '', otpLifecycle: 'idle', otpStatus: '', otp: '', authError: '', otpError: '' })); setConsentAccepted(false);
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
              {mobileError && <span className="terms-error" role="alert">{mobileError}</span>}
            </label>

            {userState.otpSent && <label className="auth-field login-otp-field">
              <span>OTP <em className="login-required">*</em></span>
              <div className="otp-boxes" style={{display:'grid',gridTemplateColumns:'repeat(6,minmax(0,1fr))',gap:8}}>
                {Array.from({length:6}, (_, index) => <input key={index} id={`otp-box-${index}`} type="text" inputMode="numeric" maxLength={index === 0 ? 6 : 1} disabled={!userState.otpSent || isSubmitting} autoComplete={index === 0 ? 'one-time-code' : 'off'} aria-label={`OTP digit ${index + 1}`} value={userState.otp[index] || ''} onChange={event => { const raw = event.target.value.replace(/\D/g,''); if (raw.length > 1) { setUserState(prev => ({...prev, otp: raw.slice(0,6), authError:''})); document.getElementById(`otp-box-${Math.min(raw.length,6)-1}`)?.focus(); return; } const digits = userState.otp.padEnd(6,' ').split(''); digits[index] = raw || ' '; const next = digits.join('').trimEnd().replace(/ /g,''); setUserState(prev => ({...prev, otp: next, authError:''})); if (raw && index < 5) document.getElementById(`otp-box-${index+1}`)?.focus(); }} onPaste={event => { const digits = event.clipboardData.getData('text').replace(/\D/g,'').slice(0,6); if (digits) { event.preventDefault(); setUserState(prev => ({...prev, otp:digits, authError:''})); document.getElementById(`otp-box-${Math.min(digits.length,6)-1}`)?.focus(); } }} />)}
                </div>
              <div className="login-otp-help"><span>{userState.otpSent ? 'Enter the 6-digit OTP received by SMS; it verifies automatically when complete.' : 'Enter your mobile number and select Continue to receive an OTP by SMS.'}</span>{userState.otpSent && <button type="button" className="login-resend" onClick={onUserSendOtp} disabled={isSubmitting || resendSeconds > 0}>{resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend OTP'}</button>}</div>
              {userState.otpStatus && <div role="status">{userState.otpStatus}</div>}
            </label>}
            {userState.demoOtp && demoMode && <div className="auth-demo-box"><span>Demo OTP</span><strong>{userState.demoOtp}</strong></div>}
            <label className={`auth-field auth-consent${termsError ? ' has-error' : ''}`}><input type="checkbox" checked={consentAccepted} disabled={userState.otpSent} aria-invalid={termsError} onChange={e => { setConsentAccepted(e.target.checked); if (e.target.checked) setTermsError(false); }} /><span>I agree to the <a href="/terms.html" target="_blank" rel="noreferrer">Terms &amp; Conditions</a> and <a href="/privacy.html" target="_blank" rel="noreferrer">Privacy Policy</a>.</span></label>
            {termsError && <div id="terms-error" className="terms-error" role="alert">Please select Terms &amp; Conditions to continue.</div>}
            <button type="button" className="primary auth-submit" onClick={userState.otpSent ? onUserVerifyOtp : onUserSendOtp} disabled={isSubmitting || (userState.otpSent && userState.otp.length !== 6) || (!userState.otpSent && resendSeconds > 0)}>
              {isSubmitting
                ? (userState.otpLifecycle === 'sending' ? 'Sending OTP…' : 'Verifying...')
                : (!userState.otpSent && resendSeconds > 0 ? `Please wait (${resendSeconds}s)` : (userState.otpSent ? 'Login' : 'Continue'))}
                </button>

            {userState.otpError && <div className="auth-error">{userState.otpError}</div>}
            {userState.authError && <div className="auth-error">{userState.authError}</div>}
          </div>
        )}

        {mode === 'admin' && (
          <div className="auth-form">
            <div className="auth-form-header">
              <div>
                <h2>Staff Login</h2>
                <p>Secure staff access with multi-factor authentication.</p>
              </div>
            </div>


            {!staffChallengeId && <label className="auth-field">
              <span>Username</span>
              <input
                type="text"
                value={adminState.username}
                onChange={(event) => setAdminState((prev) => ({ ...prev, username: event.target.value, authError: '' }))}
                placeholder="Enter staff username"
                autoComplete="username"
              />
            </label>}

            {!staffChallengeId && <label className="auth-field">
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
            </label>}

            {staffChallengeId && <label className="auth-field">
              <span>Authenticator code</span>
              <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                value={staffMfaCode} onChange={e => setStaffMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit MFA code" aria-label="Authenticator code" />
            </label>}
            <button type="button" className="primary auth-submit" onClick={staffChallengeId ? onStaffMfa : onAdminLogin} disabled={isSubmitting}>
              {isSubmitting ? 'Verifying...' : staffChallengeId ? 'Verify MFA' : 'Continue'}
            </button>
            {staffChallengeId && <button type="button" className="secondary" disabled={isSubmitting} onClick={() => { setStaffChallengeId(''); setStaffMfaCode(''); setAdminState(prev => ({ ...prev, authError: '' })); }}>Back to password</button>}
            {adminState.authError && <div className="auth-error">{adminState.authError}</div>}
          </div>
        )}
        <div style={{textAlign:'center',marginTop:18,fontSize:12}}><a href={mode === 'user' ? '/staff/login' : '/'}>{mode === 'user' ? 'Staff login' : 'Back to applicant login'}</a></div>

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

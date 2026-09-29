import { useMemo, useState } from 'react';
import { clearAuth, DEMO_ADMIN, DEMO_USER_OTP, persistAuth, readStoredAuth, type AuthSession } from './auth';

const initialMode = 'user';

type LoginMode = 'user' | 'admin';

type UserLoginState = {
  mobile: string;
  otp: string;
  otpSent: boolean;
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
  const [userState, setUserState] = useState<UserLoginState>({
    mobile: '9876543210',
    otp: '',
    otpSent: false,
    otpError: '',
    authError: ''
  });
  const [adminState, setAdminState] = useState<AdminLoginState>({
    username: 'admin',
    password: 'admin',
    authError: ''
  });

  const authSummary = useMemo(() => readStoredAuth(), []);

  const onUserSendOtp = async () => {
    const mobile = userState.mobile;
    if (/\D/.test(mobile)) {
      setUserState((prev) => ({ ...prev, otpError: 'Mobile number must contain digits only.' }));
      return;
    }
    if (!/^\d{10}$/.test(mobile)) {
      setUserState((prev) => ({ ...prev, otpError: 'Please enter a valid 10-digit mobile number.' }));
      return;
    }

    setIsSubmitting(true);
    setUserState((prev) => ({ ...prev, otpSent: true, otpError: '', authError: '' }));
    window.setTimeout(() => setIsSubmitting(false), 300);
  };

  const onUserVerifyOtp = async () => {
    const mobile = userState.mobile;

    if (/\D/.test(mobile)) {
      setUserState((prev) => ({ ...prev, authError: 'Mobile number must contain digits only.' }));
      return;
    }
    if (!/^\d{10}$/.test(mobile)) {
      setUserState((prev) => ({ ...prev, authError: 'Please enter a valid 10-digit mobile number.' }));
      return;
    }

    if (!userState.otpSent) {
      setUserState((prev) => ({ ...prev, authError: 'Please send OTP before verifying.' }));
      return;
    }

    if (userState.otp !== DEMO_USER_OTP) {
      setUserState((prev) => ({ ...prev, authError: 'Invalid OTP. Please try again.' }));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/login/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNumber: mobile, otp: userState.otp })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.token) {
        throw new Error(result?.message || 'Login failed.');
      }
      const session: AuthSession = { authenticated: true, token: result.token, role: 'USER', mobile };
      persistAuth(session);
      onAuthenticated(session);
    } catch (error) {
      setUserState((prev) => ({ ...prev, authError: error instanceof Error ? error.message : 'Login failed.' }));
      setIsSubmitting(false);
    }
  };

  const onAdminLogin = async () => {
    const username = adminState.username.trim();
    if (!username) {
      setAdminState((prev) => ({ ...prev, authError: 'Username is required.' }));
      return;
    }
    if (!adminState.password.trim()) {
      setAdminState((prev) => ({ ...prev, authError: 'Password is required.' }));
      return;
    }

    const isValid = username === DEMO_ADMIN.username && adminState.password === DEMO_ADMIN.password;
    if (!isValid) {
      setAdminState((prev) => ({ ...prev, authError: 'Invalid username or password.' }));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/login/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: adminState.password })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.token) {
        throw new Error(result?.message || 'Login failed.');
      }
      const session: AuthSession = { authenticated: true, token: result.token, role: 'ADMIN', username };
      persistAuth(session);
      onAuthenticated(session);
    } catch (error) {
      setAdminState((prev) => ({ ...prev, authError: error instanceof Error ? error.message : 'Login failed.' }));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page-shell">
      <div className="auth-glow auth-glow-left" />
      <div className="auth-glow auth-glow-right" />

      <div className="auth-card">
        <div className="auth-header">
          <div>
            <div className="brand">FinEdge Bank</div>
            <div className="subtitle">Loan Origination System</div>
          </div>
          <div className="auth-badge">Secure Access</div>
        </div>

        <div className="auth-hero">
          <h1>Welcome back</h1>
          <p className="auth-intro">Choose your secure sign-in path to continue with the LOS workflow.</p>
        </div>

        <div className="auth-mode-grid">
          <button
            type="button"
            className={`auth-mode-card ${mode === 'user' ? 'selected' : ''}`}
            onClick={() => setMode('user')}
          >
            <span className="auth-icon">👤</span>
            <span className="auth-mode-title">User</span>
            <span className="auth-mode-subtitle">Login as User</span>
          </button>

          <button
            type="button"
            className={`auth-mode-card ${mode === 'admin' ? 'selected' : ''}`}
            onClick={() => setMode('admin')}
          >
            <span className="auth-icon">🛡</span>
            <span className="auth-mode-title">Admin</span>
            <span className="auth-mode-subtitle">Login as Admin</span>
          </button>
        </div>

        {mode === 'user' && (
          <div className="auth-form">
            <div className="auth-form-header">
              <div>
                <h2>User Login</h2>
                <p>Access your application dashboard securely.</p>
              </div>
            </div>

            <label className="auth-field">
              <span>Mobile Number</span>
              <input
                type="tel"
                value={userState.mobile}
                onChange={(event) => {
                  const value = event.target.value;
                  if (/\D/.test(value)) {
                    setUserState((prev) => ({ ...prev, authError: 'Mobile number must contain digits only.', otpError: '' }));
                    return;
                  }
                  setUserState((prev) => ({ ...prev, mobile: value.slice(0, 10), authError: '', otpError: '' }));
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

            {!userState.otpSent ? (
              <button type="button" className="primary auth-submit" onClick={onUserSendOtp} disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Send OTP'}
              </button>
            ) : (
              <>
                <div className="auth-demo-box">
                  <span>Demo OTP</span>
                  <strong>{DEMO_USER_OTP}</strong>
                </div>

                <label className="auth-field">
                  <span>Enter OTP</span>
                  <input
                    type="text"
                    value={userState.otp}
                    onChange={(event) => setUserState((prev) => ({ ...prev, otp: event.target.value, authError: '' }))}
                    placeholder="Enter 6-digit OTP"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                </label>
                <button type="button" className="primary auth-submit" onClick={onUserVerifyOtp} disabled={isSubmitting}>
                  {isSubmitting ? 'Verifying...' : 'Verify OTP'}
                </button>
              </>
            )}

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

            <div className="auth-demo-box compact">
              <span>Demo credentials</span>
              <strong>admin / admin</strong>
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

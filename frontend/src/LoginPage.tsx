import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { clearAuth, DEMO_ADMIN, DEMO_USER_OTP, persistAuth, readStoredAuth, type AuthSession } from './auth';
import { CONSENT_DOCUMENTS, CONSENT_VERSION } from './termsContent';

const initialMode = 'user';
const CONSENT_ERROR = 'Please accept the Terms & Conditions and Privacy Policy to continue.';

type LoginMode = 'user' | 'admin';
type ConsentDocumentKey = keyof typeof CONSENT_DOCUMENTS;

type ConsentControlProps = {
  id: string;
  accepted: boolean;
  error: string;
  onChange: (accepted: boolean) => void;
  onOpenDocument: (document: ConsentDocumentKey) => void;
};

function ConsentControl({ id, accepted, error, onChange, onOpenDocument }: ConsentControlProps) {
  const openDocument = (event: MouseEvent<HTMLAnchorElement>, document: ConsentDocumentKey) => {
    event.preventDefault();
    onOpenDocument(document);
  };

  return (
    <div className={`consent-section ${error ? 'has-error' : ''}`}>
      <div className="consent-row">
        <input
          id={id}
          type="checkbox"
          checked={accepted}
          onChange={(event) => onChange(event.target.checked)}
          aria-label="I have read and agree to the Terms & Conditions and Privacy Policy."
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <p>
          <label htmlFor={id}>I have read and agree to the</label>{' '}
          <a href="#terms-and-conditions" onClick={(event) => openDocument(event, 'terms')}>
            Terms &amp; Conditions
          </a>{' '}and{' '}
          <a href="#privacy-policy" onClick={(event) => openDocument(event, 'privacy')}>
            Privacy Policy
          </a>.
        </p>
      </div>
      {error && <div id={`${id}-error`} className="consent-error" role="alert">{error}</div>}
    </div>
  );
}

function PolicyDialog({ documentKey, onClose }: { documentKey: ConsentDocumentKey; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const document = CONSENT_DOCUMENTS[documentKey];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    dialog.showModal();
    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="policy-dialog"
      aria-labelledby="policy-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="policy-dialog-inner">
        <header className="policy-dialog-header">
          <div>
            <p className="policy-version">FinEdge Bank · Draft {CONSENT_VERSION}</p>
            <h2 id="policy-dialog-title">{document.title}</h2>
          </div>
          <button type="button" className="policy-close" onClick={onClose} aria-label={`Close ${document.title}`}>
            Close
          </button>
        </header>
        <p className="policy-notice">
          This demonstration wording is not legal advice or an approved bank policy. Legal and compliance review is required before production use.
        </p>
        <div className="policy-content">
          {document.sections.map((section) => (
            <section key={section.heading}>
              <h3>{section.heading}</h3>
              {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </section>
          ))}
        </div>
        <div className="policy-dialog-footer">
          <button type="button" className="primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </dialog>
  );
}

type UserLoginState = {
  mobile: string;
  otp: string;
  otpSent: boolean;
  otpError: string;
  authError: string;
  termsAccepted: boolean;
  termsError: string;
};

type AdminLoginState = {
  username: string;
  password: string;
  authError: string;
  termsAccepted: boolean;
  termsError: string;
};

export function LoginPage({ onAuthenticated }: { onAuthenticated: (session: AuthSession) => void }) {
  const [mode, setMode] = useState<LoginMode>(initialMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [activePolicy, setActivePolicy] = useState<ConsentDocumentKey | null>(null);
  const [userState, setUserState] = useState<UserLoginState>({
    mobile: '9876543210',
    otp: '',
    otpSent: false,
    otpError: '',
    authError: '',
    termsAccepted: false,
    termsError: ''
  });
  const [adminState, setAdminState] = useState<AdminLoginState>({
    username: 'admin',
    password: 'admin',
    authError: '',
    termsAccepted: false,
    termsError: ''
  });

  const authSummary = useMemo(() => readStoredAuth(), []);

  const updateUserConsent = (accepted: boolean) => {
    setUserState((prev) => ({
      ...prev,
      termsAccepted: accepted,
      termsError: accepted ? '' : prev.termsAccepted || prev.otpSent ? CONSENT_ERROR : prev.termsError
    }));
  };

  const updateAdminConsent = (accepted: boolean) => {
    setAdminState((prev) => ({
      ...prev,
      termsAccepted: accepted,
      termsError: accepted ? '' : prev.termsAccepted ? CONSENT_ERROR : prev.termsError
    }));
  };

  const onUserSendOtp = async () => {
    if (isSubmitting) {
      return;
    }
    if (!userState.termsAccepted) {
      setUserState((prev) => ({ ...prev, termsError: CONSENT_ERROR }));
      return;
    }
    const mobile = userState.mobile;
    if (/\D/.test(mobile)) {
      setUserState((prev) => ({ ...prev, otpError: 'Mobile number must contain digits only.' }));
      return;
    }
    if (!/^\d{10}$/.test(mobile)) {
      setUserState((prev) => ({ ...prev, otpError: 'Please enter a valid 10-digit mobile number.' }));
      return;
    }

    setUserState((prev) => ({ ...prev, otpSent: true, otpError: '', authError: '', termsError: '' }));
  };

  const onUserVerifyOtp = async () => {
    if (isSubmitting) {
      return;
    }
    if (!userState.termsAccepted) {
      setUserState((prev) => ({ ...prev, termsError: CONSENT_ERROR }));
      return;
    }
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
    if (isSubmitting) {
      return;
    }
    if (!adminState.termsAccepted) {
      setAdminState((prev) => ({ ...prev, termsError: CONSENT_ERROR }));
      return;
    }
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

            <ConsentControl
              id="user-terms-consent"
              accepted={userState.termsAccepted}
              error={userState.termsError}
              onChange={updateUserConsent}
              onOpenDocument={setActivePolicy}
            />

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

            {userState.otpError && <div className="auth-error" role="alert">{userState.otpError}</div>}
            {userState.authError && <div className="auth-error" role="alert">{userState.authError}</div>}
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

              <ConsentControl
                id="admin-terms-consent"
                accepted={adminState.termsAccepted}
                error={adminState.termsError}
                onChange={updateAdminConsent}
                onOpenDocument={setActivePolicy}
              />
                </button>
              </div>
            </label>

            <button type="button" className="primary auth-submit" onClick={onAdminLogin} disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Login'}
            </button>
            {adminState.authError && <div className="auth-error" role="alert">{adminState.authError}</div>}
          </div>
        )}

        {activePolicy && <PolicyDialog documentKey={activePolicy} onClose={() => setActivePolicy(null)} />}

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

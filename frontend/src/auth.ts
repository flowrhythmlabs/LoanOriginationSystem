export type AuthRole = 'USER' | 'ADMIN';

export type AuthSession = {
  authenticated: true;
  role: AuthRole;
  mobile?: string;
  username?: string;
};

export const AUTH_STORAGE_KEY = 'finedge-auth-session';
export const DEMO_USER_OTP = '123456';
export const DEMO_ADMIN = {
  username: 'admin',
  password: 'admin'
} as const;

export const readStoredAuth = (): AuthSession | null => {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (!parsed?.authenticated || !parsed?.role) {
      return null;
    }
    return {
      authenticated: true,
      role: parsed.role === 'ADMIN' ? 'ADMIN' : 'USER',
      mobile: parsed.mobile,
      username: parsed.username
    } satisfies AuthSession;
  } catch {
    return null;
  }
};

export const persistAuth = (session: AuthSession) => {
  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

export const clearAuth = () => {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
};

export const buildAuthHeaders = (session: AuthSession | null) => {
  const headers = new Headers();
  if (!session) {
    return headers;
  }

  headers.set('X-Role', session.role);
  if (session.role === 'USER' && session.mobile) {
    headers.set('X-Mobile', session.mobile);
  }
  if (session.role === 'ADMIN' && session.username) {
    headers.set('X-Username', session.username);
  }
  return headers;
};

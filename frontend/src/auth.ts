export type AuthRole = 'USER' | 'ADMIN';

export type AuthSession = {
  authenticated: true;
  role: AuthRole;
  accessToken: string;
  mobile?: string;
  username?: string;
};

export const AUTH_STORAGE_KEY = 'finedge-auth-session';

export const readStoredAuth = (): AuthSession | null => {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (!parsed?.authenticated || !parsed?.role || !parsed?.accessToken) return null;
    return {
      authenticated: true,
      role: parsed.role === 'ADMIN' ? 'ADMIN' : 'USER',
      accessToken: parsed.accessToken,
      mobile: parsed.mobile,
      username: parsed.username
};
  } catch { return null; }
};

export const persistAuth = (session: AuthSession) => sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
export const clearAuth = () => sessionStorage.removeItem(AUTH_STORAGE_KEY);

export const buildAuthHeaders = (session: AuthSession | null) => {
  const headers = new Headers();
  if (session?.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`);

  return headers;
};

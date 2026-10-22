'use client';

import * as React from 'react';

import { onSessionExpired } from '@/lib/api-client';
import { fetchMe, type AuthStatus, type AuthUser } from '@/lib/auth-session';

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  /** Re-fetches the current session from the API. */
  refresh: () => Promise<void>;
  /** Optimistically updates the cached user, e.g. after login/register/profile save. */
  setUser: (user: AuthUser | null) => void;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

/**
 * Minimal client-side session cache scoped to the account area.
 * This is a UX convenience only — every mutation is still authorized
 * server-side via the httpOnly session cookies on each API request.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = React.useState<AuthUser | null>(null);
  const [status, setStatus] = React.useState<AuthStatus>('loading');

  const refresh = React.useCallback(async () => {
    const me = await fetchMe();
    setUserState(me);
    setStatus(me ? 'authenticated' : 'unauthenticated');
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      const me = await fetchMe();
      if (cancelled) {
        return;
      }
      setUserState(me);
      setStatus(me ? 'authenticated' : 'unauthenticated');
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(
    () =>
      onSessionExpired(() => {
        setUserState(null);
        setStatus('unauthenticated');
      }),
    [],
  );

  const setUser = React.useCallback((next: AuthUser | null) => {
    setUserState(next);
    setStatus(next ? 'authenticated' : 'unauthenticated');
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({ user, status, refresh, setUser }),
    [user, status, refresh, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

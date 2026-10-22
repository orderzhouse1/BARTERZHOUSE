import { beforeEach, describe, expect, it } from 'vitest';

import type { RegisterRequest } from '@barterzhouse/shared';

import { isAppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';
import { MemoryEmailAdapter } from '../../security/email/memory-adapter.js';
import { AuthService } from './auth.service.js';
import { MemoryAuthStore } from './stores/memory-auth-store.js';

function buildRegisterInput(overrides: Partial<RegisterRequest> = {}): RegisterRequest {
  return {
    email: 'sam@example.com',
    password: 'a-very-secure-password',
    displayName: 'Sam Session',
    preferredLocale: 'ar',
    acceptTerms: true,
    ...overrides,
  };
}

describe('AuthService session lifecycle', () => {
  let store: MemoryAuthStore;
  let service: AuthService;

  beforeEach(() => {
    store = new MemoryAuthStore();
    service = new AuthService(store, new MemoryEmailAdapter());
  });

  it('rotates the refresh token on each successful refresh', async () => {
    const registered = await service.register(buildRegisterInput());
    const refreshed = await service.refresh(registered.tokens.refreshToken);

    expect(refreshed.tokens.refreshToken).not.toBe(registered.tokens.refreshToken);
    expect(refreshed.tokens.accessToken).toBeTruthy();
    expect(refreshed.user.email).toBe('sam@example.com');
  });

  it('detects reuse of an already-rotated refresh token and revokes the family', async () => {
    const registered = await service.register(buildRegisterInput());
    const firstRefresh = await service.refresh(registered.tokens.refreshToken);

    // Reusing the original (now-rotated) refresh token must fail.
    await expect(service.refresh(registered.tokens.refreshToken)).rejects.toSatisfy(
      (error: unknown) => isAppError(error) && error.code === ErrorCodes.INVALID_REFRESH_TOKEN,
    );

    // The whole family (including the token issued by the legitimate rotation) is revoked.
    await expect(service.refresh(firstRefresh.tokens.refreshToken)).rejects.toSatisfy(
      (error: unknown) => isAppError(error) && error.code === ErrorCodes.INVALID_REFRESH_TOKEN,
    );

    const auditEvents = store.auditLogs.map((entry) => entry.event);
    expect(auditEvents).toContain('REFRESH_REUSE_DETECTED');
  });

  it('rejects an invalid or garbage refresh token', async () => {
    await expect(service.refresh('not-a-real-jwt')).rejects.toSatisfy(
      (error: unknown) => isAppError(error) && error.code === ErrorCodes.INVALID_REFRESH_TOKEN,
    );
  });

  it('logout revokes the current session', async () => {
    const registered = await service.register(buildRegisterInput());
    const sessionId = getFirstSessionId(store);

    await service.logout(sessionId);

    const session = await store.findSessionById(sessionId);
    expect(session?.revokedAt).not.toBeNull();

    await expect(service.refresh(registered.tokens.refreshToken)).rejects.toSatisfy(
      (error: unknown) => isAppError(error) && error.code === ErrorCodes.INVALID_REFRESH_TOKEN,
    );
  });

  it('logout-all revokes every session for the user', async () => {
    const registered = await service.register(buildRegisterInput());
    const secondLogin = await service.login({
      email: 'sam@example.com',
      password: 'a-very-secure-password',
    });

    await service.logoutAll(registered.user.id);

    await expect(service.refresh(registered.tokens.refreshToken)).rejects.toSatisfy(
      (error: unknown) => isAppError(error) && error.code === ErrorCodes.INVALID_REFRESH_TOKEN,
    );
    await expect(service.refresh(secondLogin.tokens.refreshToken)).rejects.toSatisfy(
      (error: unknown) => isAppError(error) && error.code === ErrorCodes.INVALID_REFRESH_TOKEN,
    );
  });

  it('only allows one concurrent refresh using the same token to succeed', async () => {
    const registered = await service.register(buildRegisterInput());

    const results = await Promise.allSettled([
      service.refresh(registered.tokens.refreshToken),
      service.refresh(registered.tokens.refreshToken),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });
});

function getFirstSessionId(store: MemoryAuthStore): string {
  const [first] = store.listSessions();
  if (!first) throw new Error('No session found');
  return first.id;
}

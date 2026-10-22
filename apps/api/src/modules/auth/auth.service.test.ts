import { beforeEach, describe, expect, it } from 'vitest';

import type { RegisterRequest } from '@barterzhouse/shared';

import { isAppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';
import { MemoryEmailAdapter } from '../../security/email/memory-adapter.js';
import { sha256Hex } from '../../security/tokens.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { MemoryAuthStore } from './stores/memory-auth-store.js';

function buildRegisterInput(overrides: Partial<RegisterRequest> = {}): RegisterRequest {
  return {
    email: 'jane@example.com',
    password: 'correct-horse-battery',
    displayName: 'Jane Doe',
    preferredLocale: 'ar',
    acceptTerms: true,
    ...overrides,
  };
}

function extractToken(url: string): string {
  const token = new URL(url).searchParams.get('token');
  if (!token) throw new Error('No token found in URL');
  return token;
}

describe('AuthService', () => {
  let store: MemoryAuthStore;
  let emails: MemoryEmailAdapter;
  let service: AuthService;

  beforeEach(() => {
    store = new MemoryAuthStore();
    emails = new MemoryEmailAdapter();
    service = new AuthService(store, emails);
  });

  it('hashes the password and never stores it in plaintext', async () => {
    const input = buildRegisterInput();
    await service.register(input);

    const user = await store.findUserByNormalizedEmail('jane@example.com');
    expect(user).not.toBeNull();
    expect(user?.passwordHash).not.toBe(input.password);
    expect(user?.passwordHash.startsWith('$argon2id$')).toBe(true);
  });

  it('assigns the USER role by default', async () => {
    await service.register(buildRegisterInput());
    const user = await store.findUserByNormalizedEmail('jane@example.com');
    expect(user?.role).toBe('USER');
    expect(user?.status).toBe('ACTIVE');
  });

  it('normalizes and returns the public user shape with cookies-ready tokens', async () => {
    const result = await service.register(buildRegisterInput());
    expect(result.user.email).toBe('jane@example.com');
    expect(result.user.profile.displayName).toBe('Jane Doe');
    expect(result.tokens.accessToken).toBeTruthy();
    expect(result.tokens.refreshToken).toBeTruthy();
  });

  it('rejects duplicate email registration', async () => {
    await service.register(buildRegisterInput());

    await expect(
      service.register(buildRegisterInput({ displayName: 'Someone Else' })),
    ).rejects.toSatisfy(
      (error: unknown) => isAppError(error) && error.code === ErrorCodes.EMAIL_ALREADY_REGISTERED,
    );
  });

  it('treats email matching case-insensitively as duplicate', async () => {
    await service.register(buildRegisterInput({ email: 'Jane@Example.com' }));

    await expect(
      service.register(buildRegisterInput({ email: 'jane@example.com' })),
    ).rejects.toSatisfy(
      (error: unknown) => isAppError(error) && error.code === ErrorCodes.EMAIL_ALREADY_REGISTERED,
    );
  });

  it('logs in successfully with correct credentials', async () => {
    await service.register(buildRegisterInput());
    const result = await service.login({
      email: 'jane@example.com',
      password: 'correct-horse-battery',
    });
    expect(result.user.email).toBe('jane@example.com');
    expect(result.tokens.accessToken).toBeTruthy();
  });

  it('rejects login with an unknown email using a generic error', async () => {
    await expect(
      service.login({ email: 'nobody@example.com', password: 'whatever123' }),
    ).rejects.toSatisfy(
      (error: unknown) =>
        isAppError(error) &&
        error.code === ErrorCodes.INVALID_CREDENTIALS &&
        error.statusCode === 401,
    );
  });

  it('rejects login with a wrong password using the same generic error', async () => {
    await service.register(buildRegisterInput());

    await expect(
      service.login({ email: 'jane@example.com', password: 'totally-wrong' }),
    ).rejects.toSatisfy(
      (error: unknown) => isAppError(error) && error.code === ErrorCodes.INVALID_CREDENTIALS,
    );
  });

  it('rejects login for a suspended account', async () => {
    const { user } = await service.register(buildRegisterInput());
    await store.setUserStatus(user.id, 'SUSPENDED', new Date());

    await expect(
      service.login({ email: 'jane@example.com', password: 'correct-horse-battery' }),
    ).rejects.toSatisfy(
      (error: unknown) => isAppError(error) && error.code === ErrorCodes.ACCOUNT_SUSPENDED,
    );
  });

  it('rejects login for a deactivated account', async () => {
    const { user } = await service.register(buildRegisterInput());
    await store.deactivateUser(user.id, new Date());

    await expect(
      service.login({ email: 'jane@example.com', password: 'correct-horse-battery' }),
    ).rejects.toSatisfy(
      (error: unknown) => isAppError(error) && error.code === ErrorCodes.ACCOUNT_DEACTIVATED,
    );
  });

  it('sends a verification email on register and allows verifying once', async () => {
    const { user } = await service.register(buildRegisterInput());

    const message = emails.findLatestFor(user.email, 'verification');
    expect(message).toBeDefined();

    const token = extractToken(message!.url);
    const verified = await service.verifyEmail(token);
    expect(verified.emailVerifiedAt).not.toBeNull();

    await expect(service.verifyEmail(token)).rejects.toSatisfy(
      (error: unknown) => isAppError(error) && error.code === ErrorCodes.VERIFICATION_TOKEN_INVALID,
    );
  });

  it('rejects an expired verification token', async () => {
    const { user } = await service.register(buildRegisterInput());

    const rawToken = 'expired-raw-token-value-1234567890';
    await store.createEmailVerificationToken({
      userId: user.id,
      tokenHash: sha256Hex(rawToken),
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(service.verifyEmail(rawToken)).rejects.toSatisfy(
      (error: unknown) => isAppError(error) && error.code === ErrorCodes.VERIFICATION_TOKEN_EXPIRED,
    );
  });

  it('does not reveal account existence on forgotPassword', async () => {
    await service.register(buildRegisterInput());
    emails.clear();

    await expect(service.forgotPassword('nobody@example.com')).resolves.toBeUndefined();
    expect(emails.messages).toHaveLength(0);

    await expect(service.forgotPassword('jane@example.com')).resolves.toBeUndefined();
    expect(emails.messages).toHaveLength(1);
  });

  it('does not reveal account existence on resendVerification', async () => {
    await expect(service.resendVerification('nobody@example.com')).resolves.toBeUndefined();
    expect(emails.messages).toHaveLength(0);
  });

  it('resets the password and revokes all existing sessions', async () => {
    const { tokens } = await service.register(buildRegisterInput());
    emails.clear();

    await service.forgotPassword('jane@example.com');
    const message = emails.findLatestFor('jane@example.com', 'password-reset');
    expect(message).toBeDefined();

    const token = extractToken(message!.url);
    await service.resetPassword(token, 'a-brand-new-password');

    // Old refresh token must now be invalid because the session was revoked.
    await expect(service.refresh(tokens.refreshToken)).rejects.toSatisfy(
      (error: unknown) => isAppError(error) && error.code === ErrorCodes.INVALID_REFRESH_TOKEN,
    );

    // New password should work.
    const loginResult = await service.login({
      email: 'jane@example.com',
      password: 'a-brand-new-password',
    });
    expect(loginResult.user.email).toBe('jane@example.com');
  });

  it('rejects reset with an invalid token', async () => {
    await expect(
      service.resetPassword('not-a-real-token', 'a-brand-new-password'),
    ).rejects.toSatisfy(
      (error: unknown) => isAppError(error) && error.code === ErrorCodes.RESET_TOKEN_INVALID,
    );
  });

  it('deactivating a user revokes sessions and blocks future logins', async () => {
    const { user } = await service.register(buildRegisterInput());
    const usersService = new UsersService(store);

    await usersService.deactivate(user.id);

    const stored = await store.findUserById(user.id);
    expect(stored?.status).toBe('DEACTIVATED');

    await expect(
      service.login({ email: 'jane@example.com', password: 'correct-horse-battery' }),
    ).rejects.toSatisfy(
      (error: unknown) => isAppError(error) && error.code === ErrorCodes.ACCOUNT_DEACTIVATED,
    );
  });
});

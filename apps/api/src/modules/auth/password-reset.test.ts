import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { createApp } from '../../app.js';
import { logger } from '../../lib/logger.js';
import { MemoryEmailAdapter } from '../../security/email/memory-adapter.js';
import * as passwordSecurity from '../../security/password.js';
import { sha256Hex } from '../../security/tokens.js';
import { AuthService } from './auth.service.js';
import { MemoryAuthStore } from './stores/memory-auth-store.js';

const EMAIL = 'reset-atomic@example.invalid';
const OLD_PASSWORD = 'old-atomic-reset-password';
const NEW_PASSWORD = 'new-atomic-reset-password';

async function fixture() {
  const store = new MemoryAuthStore();
  const emails = new MemoryEmailAdapter();
  const service = new AuthService(store, emails);
  const registered = await service.register({
    email: EMAIL,
    password: OLD_PASSWORD,
    displayName: 'Reset Test',
    preferredLocale: 'ar',
    acceptTerms: true,
  });
  await service.forgotPassword(EMAIL);
  const message = emails.findLatestFor(EMAIL, 'password-reset');
  const token = message && new URL(message.url).searchParams.get('token');
  if (!token) throw new Error('Expected a captured reset token');
  return { store, emails, service, registered, token, tokenHash: sha256Hex(token) };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

async function state(f: Fixture) {
  return {
    user: await f.store.findUserById(f.registered.user.id),
    token: await f.store.findPasswordResetToken(f.tokenHash),
    sessions: f.store.listSessions().map((session) => ({ ...session })),
    audit: [...f.store.auditLogs],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('atomic password reset in memory', () => {
  it('commits Argon2id, consumes the token, revokes sessions and audits exactly once', async () => {
    const f = await fixture();
    await f.service.login({ email: EMAIL, password: OLD_PASSWORD });
    await f.service.resetPassword(f.token, NEW_PASSWORD);
    const after = await state(f);
    expect(after.user?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await passwordSecurity.verifyPassword(after.user!.passwordHash, NEW_PASSWORD)).toBe(
      true,
    );
    expect(await passwordSecurity.verifyPassword(after.user!.passwordHash, OLD_PASSWORD)).toBe(
      false,
    );
    expect(after.token?.usedAt).toBeInstanceOf(Date);
    expect(after.sessions).toHaveLength(2);
    expect(
      after.sessions.every(
        (session) => session.revokedAt && session.revokeReason === 'PASSWORD_RESET',
      ),
    ).toBe(true);
    expect(after.audit.filter((entry) => entry.event === 'PASSWORD_RESET')).toHaveLength(1);
    await expect(f.service.refresh(f.registered.tokens.refreshToken)).rejects.toMatchObject({
      code: 'INVALID_REFRESH_TOKEN',
    });
    await expect(f.service.login({ email: EMAIL, password: NEW_PASSWORD })).resolves.toHaveProperty(
      'tokens',
    );
  });

  it('rejects an unknown token before hashing and without changing state', async () => {
    const f = await fixture();
    const before = await state(f);
    const hash = vi.spyOn(passwordSecurity, 'hashPassword');
    await expect(
      f.service.resetPassword('unknown-synthetic-reset-token', NEW_PASSWORD),
    ).rejects.toMatchObject({
      code: 'RESET_TOKEN_INVALID',
      statusCode: 400,
    });
    expect(hash).not.toHaveBeenCalled();
    expect(await state(f)).toEqual(before);
  });

  it.each(['past', 'now'] as const)('rejects a token expiring in the %s', async (expiry) => {
    const f = await fixture();
    vi.useFakeTimers({ toFake: ['Date'] });
    const token = 'synthetic-expired-reset-token';
    await f.store.createPasswordResetToken({
      userId: f.registered.user.id,
      tokenHash: sha256Hex(token),
      expiresAt: new Date(Date.now() - (expiry === 'past' ? 1 : 0)),
    });
    const before = await state(f);
    const hash = vi.spyOn(passwordSecurity, 'hashPassword');
    await expect(f.service.resetPassword(token, NEW_PASSWORD)).rejects.toMatchObject({
      code: 'RESET_TOKEN_EXPIRED',
    });
    expect(hash).not.toHaveBeenCalled();
    expect(await state(f)).toEqual(before);
  });

  it('rejects replay without rehashing or modifying the completed reset', async () => {
    const f = await fixture();
    await f.service.resetPassword(f.token, NEW_PASSWORD);
    const before = await state(f);
    const hash = vi.spyOn(passwordSecurity, 'hashPassword');
    await expect(f.service.resetPassword(f.token, 'another-reset-password')).rejects.toMatchObject({
      code: 'RESET_TOKEN_INVALID',
    });
    expect(hash).not.toHaveBeenCalled();
    expect(await state(f)).toEqual(before);
  });

  it('allows exactly one of several concurrent requests for the same token', async () => {
    const f = await fixture();
    const results = await Promise.allSettled(
      [0, 1, 2, 3].map((index) => f.service.resetPassword(f.token, `${NEW_PASSWORD}-${index}`)),
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    for (const result of results) {
      if (result.status === 'rejected')
        expect(result.reason).toMatchObject({ code: 'RESET_TOKEN_INVALID' });
    }
    expect(f.store.auditLogs.filter((entry) => entry.event === 'PASSWORD_RESET')).toHaveLength(1);
    const winner = results.findIndex((result) => result.status === 'fulfilled');
    await expect(
      f.service.login({ email: EMAIL, password: `${NEW_PASSWORD}-${winner}` }),
    ).resolves.toHaveProperty('tokens');
  });

  it('serializes different tokens for one account and invalidates every older token', async () => {
    const f = await fixture();
    const other = 'synthetic-second-account-reset-token';
    await f.store.createPasswordResetToken({
      userId: f.registered.user.id,
      tokenHash: sha256Hex(other),
      expiresAt: new Date(Date.now() + 60_000),
    });
    const results = await Promise.allSettled([
      f.service.resetPassword(f.token, NEW_PASSWORD),
      f.service.resetPassword(other, 'second-new-reset-password'),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await f.store.findPasswordResetToken(f.tokenHash))?.usedAt).not.toBeNull();
    expect((await f.store.findPasswordResetToken(sha256Hex(other)))?.usedAt).not.toBeNull();
    expect(f.store.auditLogs.filter((entry) => entry.event === 'PASSWORD_RESET')).toHaveLength(1);
    await expect(f.service.resetPassword(other, NEW_PASSWORD)).rejects.toMatchObject({
      code: 'RESET_TOKEN_INVALID',
    });
  });

  it('allows a genuinely new reset request after a completed reset', async () => {
    const f = await fixture();
    await f.service.resetPassword(f.token, NEW_PASSWORD);
    await f.service.forgotPassword(EMAIL);
    const message = f.emails.findLatestFor(EMAIL, 'password-reset');
    const token = new URL(message!.url).searchParams.get('token')!;
    expect(token).not.toBe(f.token);
    await expect(f.service.resetPassword(token, 'later-reset-password')).resolves.toBeUndefined();
  });

  it('does not create a session from an old-password login that overlaps a reset', async () => {
    const f = await fixture();
    let verified!: () => void;
    let release!: () => void;
    const verifiedPromise = new Promise<void>((resolve) => {
      verified = resolve;
    });
    const releasePromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    const originalVerify = passwordSecurity.verifyPassword;
    vi.spyOn(passwordSecurity, 'verifyPassword').mockImplementationOnce(async (hash, password) => {
      const valid = await originalVerify(hash, password);
      verified();
      await releasePromise;
      return valid;
    });
    const login = f.service.login({ email: EMAIL, password: OLD_PASSWORD });
    const outcome = login.then(
      () => 'allowed',
      (error: unknown) => error,
    );
    await verifiedPromise;
    try {
      await f.service.resetPassword(f.token, NEW_PASSWORD);
    } finally {
      release();
    }
    expect(await outcome).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(f.store.listSessions().every((session) => session.revokedAt !== null)).toBe(true);
    await expect(f.service.login({ email: EMAIL, password: NEW_PASSWORD })).resolves.toHaveProperty(
      'tokens',
    );
  });

  it('leaves other users, their reset tokens and sessions untouched', async () => {
    const f = await fixture();
    const other = await f.service.register({
      email: 'other-reset@example.invalid',
      password: OLD_PASSWORD,
      displayName: 'Other Test',
      preferredLocale: 'en',
      acceptTerms: true,
    });
    await f.store.createPasswordResetToken({
      userId: other.user.id,
      tokenHash: 'other-user-token-hash',
      expiresAt: new Date(Date.now() + 60_000),
    });
    await f.service.resetPassword(f.token, NEW_PASSWORD);
    expect((await f.store.findPasswordResetToken('other-user-token-hash'))?.usedAt).toBeNull();
    expect(
      f.store.listSessions().find((session) => session.userId === other.user.id)?.revokedAt,
    ).toBeNull();
    await expect(f.service.refresh(other.tokens.refreshToken)).resolves.toHaveProperty('tokens');
  });

  it('keeps the token usable when Argon2 fails before the transaction', async () => {
    const f = await fixture();
    const before = await state(f);
    const log = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    vi.spyOn(passwordSecurity, 'hashPassword').mockRejectedValueOnce(
      new Error(`synthetic-private-${f.token}`),
    );
    await expect(f.service.resetPassword(f.token, NEW_PASSWORD)).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    });
    expect(await state(f)).toEqual(before);
    expect(JSON.stringify(log.mock.calls)).not.toContain(f.token);
    await expect(f.service.resetPassword(f.token, NEW_PASSWORD)).resolves.toBeUndefined();
  });

  it('rechecks expiry after hashing, before committing any state', async () => {
    const f = await fixture();
    const record = await f.store.findPasswordResetToken(f.tokenHash);
    const before = await state(f);
    const originalHash = passwordSecurity.hashPassword;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.spyOn(passwordSecurity, 'hashPassword').mockImplementationOnce(async (password) => {
      const hash = await originalHash(password);
      vi.setSystemTime(record!.expiresAt);
      return hash;
    });
    await expect(f.service.resetPassword(f.token, NEW_PASSWORD)).rejects.toMatchObject({
      code: 'RESET_TOKEN_EXPIRED',
    });
    expect(await state(f)).toEqual(before);
  });

  it('keeps memory state unchanged when the staged commit cannot append its audit entry', async () => {
    const f = await fixture();
    const before = await state(f);
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    vi.spyOn(f.store.auditLogs, 'push').mockImplementationOnce(() => {
      throw new Error('Synthetic audit failure');
    });
    await expect(f.service.resetPassword(f.token, NEW_PASSWORD)).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
    });
    expect(await state(f)).toEqual(before);
    await expect(f.service.resetPassword(f.token, NEW_PASSWORD)).resolves.toBeUndefined();
  });
});

describe('reset HTTP validation and safe failures', () => {
  it.each([
    ['/forgot-password', 'findUserByNormalizedEmail', 'PASSWORD_RESET_REQUEST_FAILED'],
    ['/forgot-password', 'createPasswordResetToken', 'PASSWORD_RESET_REQUEST_FAILED'],
    ['/resend-verification', 'findUserByNormalizedEmail', 'EMAIL_VERIFICATION_REQUEST_FAILED'],
    ['/resend-verification', 'createEmailVerificationToken', 'EMAIL_VERIFICATION_REQUEST_FAILED'],
  ] as const)('keeps %s generic when %s fails', async (path, method, event) => {
    const f = await fixture();
    const before = await state(f);
    const agent = request.agent(createApp({ authStore: f.store, emailDelivery: f.emails }));
    const csrf = (await agent.get('/api/v1/auth/csrf')).body.data.csrfToken as string;
    const log = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    vi.spyOn(f.store, method).mockRejectedValueOnce(
      new Error(`synthetic-private-url?token=${f.token}`),
    );
    const existing = await agent
      .post(`/api/v1/auth${path}`)
      .set('X-CSRF-Token', csrf)
      .send({ email: EMAIL });
    const missing = await agent
      .post(`/api/v1/auth${path}`)
      .set('X-CSRF-Token', csrf)
      .send({ email: 'missing@example.invalid' });
    expect(existing.status).toBe(200);
    expect(missing.status).toBe(200);
    expect(existing.body).toEqual({ data: { accepted: true } });
    expect(missing.body).toEqual(existing.body);
    expect(log).toHaveBeenCalledWith({ event }, expect.any(String));
    expect(JSON.stringify([existing.body, log.mock.calls])).not.toContain(f.token);
    expect(await state(f)).toEqual(before);
  });

  it.each([{}, { token: null }, { token: 'short' }])(
    'rejects malformed reset bodies without modifying credentials',
    async (body) => {
      const f = await fixture();
      const before = await state(f);
      const agent = request.agent(createApp({ authStore: f.store, emailDelivery: f.emails }));
      const csrf = (await agent.get('/api/v1/auth/csrf')).body.data.csrfToken as string;
      const response = await agent
        .post('/api/v1/auth/reset-password')
        .set('X-CSRF-Token', csrf)
        .send({ password: NEW_PASSWORD, ...body });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(await state(f)).toEqual(before);
    },
  );

  it('rejects a weak password even when the reset token is valid', async () => {
    const f = await fixture();
    const before = await state(f);
    const agent = request.agent(createApp({ authStore: f.store, emailDelivery: f.emails }));
    const csrf = (await agent.get('/api/v1/auth/csrf')).body.data.csrfToken as string;
    const response = await agent
      .post('/api/v1/auth/reset-password')
      .set('X-CSRF-Token', csrf)
      .send({ token: f.token, password: 'short' });
    expect(response.status).toBe(400);
    expect(response.body.error.fieldErrors.password).toBeDefined();
    expect(await state(f)).toEqual(before);
  });

  it.each(['findPasswordResetToken', 'completePasswordReset'] as const)(
    'sanitizes %s failures and does not change state',
    async (method) => {
      const f = await fixture();
      const before = await state(f);
      const agent = request.agent(createApp({ authStore: f.store, emailDelivery: f.emails }));
      const csrf = (await agent.get('/api/v1/auth/csrf')).body.data.csrfToken as string;
      const log = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
      vi.spyOn(f.store, method).mockRejectedValueOnce(
        new Error(`postgresql://synthetic:private@invalid/reset?token=${f.token}`),
      );
      const response = await agent
        .post('/api/v1/auth/reset-password')
        .set('X-CSRF-Token', csrf)
        .send({ token: f.token, password: NEW_PASSWORD });
      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
      expect(response.body.error.message).toBe('Unable to reset password. Please try again later.');
      expect(log).toHaveBeenCalledExactlyOnceWith(
        { event: 'PASSWORD_RESET_FAILED' },
        'Password reset failed.',
      );
      expect(JSON.stringify([response.body, log.mock.calls])).not.toContain(f.token);
      expect(JSON.stringify([response.body, log.mock.calls])).not.toContain('postgresql:');
      expect(await state(f)).toEqual(before);
    },
  );
});

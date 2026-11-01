import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { createApp } from '../../app.js';
import { logger } from '../../lib/logger.js';
import { MemoryEmailAdapter } from '../../security/email/memory-adapter.js';
import { sha256Hex } from '../../security/tokens.js';
import { MemoryAuthStore } from './stores/memory-auth-store.js';

const EMAIL = 'email-regression@example.invalid';
const PASSWORD = 'local-email-regression-password';

async function buildFixture() {
  const store = new MemoryAuthStore();
  const emails = new MemoryEmailAdapter();
  const app = createApp({ authStore: store, emailDelivery: emails });
  const agent = request.agent(app);
  const csrf = await agent.get('/api/v1/auth/csrf');
  expect(csrf.status).toBe(200);
  const csrfToken = csrf.body.data.csrfToken as string;
  return { store, emails, agent, csrfToken };
}

type Fixture = Awaited<ReturnType<typeof buildFixture>>;

function register(fixture: Fixture) {
  return fixture.agent.post('/api/v1/auth/register').set('X-CSRF-Token', fixture.csrfToken).send({
    email: EMAIL,
    password: PASSWORD,
    displayName: 'Email Test',
    preferredLocale: 'ar',
    acceptTerms: true,
  });
}

function latestToken(fixture: Fixture, kind: 'verification' | 'password-reset'): string {
  const message = fixture.emails.findLatestFor(EMAIL, kind);
  if (!message) throw new Error('Expected a captured local email');
  const token = new URL(message.url).searchParams.get('token');
  if (!token) throw new Error('Expected a synthetic email token');
  return token;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('email failures do not disclose tokens or account existence', () => {
  it.each(['error', 'string', 'object'] as const)(
    'sanitizes a provider %s failure during registration',
    async (shape) => {
      const fixture = await buildFixture();
      const detail = 'https://provider.invalid/reset?token=synthetic-provider-secret';
      const failure =
        shape === 'error' ? new Error(detail) : shape === 'string' ? detail : { detail, to: EMAIL };
      vi.spyOn(fixture.emails, 'sendVerificationEmail').mockRejectedValue(failure);
      const log = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
      // Exercise the production logging boundary with an isolated injected adapter.
      vi.stubEnv('NODE_ENV', 'production');
      const response = await register(fixture);
      expect(response.status).toBe(503);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
      expect(response.body.error.message).toBe('Email delivery is temporarily unavailable.');
      expect(response.body.error.requestId).toBeTruthy();
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(fixture.store.listSessions()).toHaveLength(0);
      expect(log).toHaveBeenCalledExactlyOnceWith(
        { event: 'EMAIL_DELIVERY_FAILED', kind: 'verification' },
        'Email delivery failed.',
      );
      const exposed = JSON.stringify([response.body, log.mock.calls]);
      expect(exposed).not.toContain('synthetic-provider-secret');
      expect(exposed).not.toContain('provider.invalid');
      expect(exposed).not.toContain(EMAIL);
      // Registration may persist an unverified account before transport fails.
      const user = await fixture.store.findUserByNormalizedEmail(EMAIL);
      expect(user?.emailVerifiedAt).toBeNull();
    },
  );

  it.each([
    ['/auth/forgot-password', 'sendPasswordResetEmail', 'password-reset'],
    ['/auth/resend-verification', 'sendVerificationEmail', 'verification'],
  ] as const)(
    '%s keeps the same acknowledgement when delivery fails',
    async (path, method, kind) => {
      const fixture = await buildFixture();
      expect((await register(fixture)).status).toBe(201);
      vi.spyOn(fixture.emails, method).mockRejectedValue(
        new Error('https://provider.invalid/?token=synthetic-transport-secret'),
      );
      const log = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
      vi.stubEnv('NODE_ENV', 'production');

      const existing = await fixture.agent
        .post(`/api/v1${path}`)
        .set('X-CSRF-Token', fixture.csrfToken)
        .send({ email: EMAIL });
      const missing = await fixture.agent
        .post(`/api/v1${path}`)
        .set('X-CSRF-Token', fixture.csrfToken)
        .send({ email: 'missing@example.invalid' });
      expect(existing.status).toBe(200);
      expect(missing.status).toBe(200);
      expect(existing.body).toEqual({ data: { accepted: true } });
      expect(missing.body).toEqual(existing.body);
      expect(existing.body.data.sent).toBeUndefined();
      expect(log).toHaveBeenCalledExactlyOnceWith(
        { event: 'EMAIL_DELIVERY_FAILED', kind },
        'Email delivery failed.',
      );
      expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic-transport-secret');
      expect(JSON.stringify(log.mock.calls)).not.toContain(EMAIL);
    },
  );

  it('uses the same resend acknowledgement for already-verified and unknown accounts', async () => {
    const fixture = await buildFixture();
    const registered = await register(fixture);
    expect(registered.status).toBe(201);
    await fixture.store.setEmailVerified(registered.body.data.id as string, new Date());
    const send = vi.spyOn(fixture.emails, 'sendVerificationEmail');
    for (const email of [EMAIL, 'unknown@example.invalid']) {
      const response = await fixture.agent
        .post('/api/v1/auth/resend-verification')
        .set('X-CSRF-Token', fixture.csrfToken)
        .send({ email });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: { accepted: true } });
    }
    expect(send).not.toHaveBeenCalled();
  });
});

describe('local email verification and password reset remain functional', () => {
  it('recovers verification after registration delivery fails without creating another account', async () => {
    const fixture = await buildFixture();
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    vi.spyOn(fixture.emails, 'sendVerificationEmail').mockRejectedValueOnce(
      new Error('Synthetic temporary delivery failure'),
    );
    expect((await register(fixture)).status).toBe(503);
    const user = await fixture.store.findUserByNormalizedEmail(EMAIL);
    expect(user).not.toBeNull();
    const resend = await fixture.agent
      .post('/api/v1/auth/resend-verification')
      .set('X-CSRF-Token', fixture.csrfToken)
      .send({ email: EMAIL });
    expect(resend.status).toBe(200);
    expect(resend.body).toEqual({ data: { accepted: true } });
    const token = latestToken(fixture, 'verification');
    const verified = await fixture.agent
      .post('/api/v1/auth/verify-email')
      .set('X-CSRF-Token', fixture.csrfToken)
      .send({ token });
    expect(verified.status).toBe(200);
    expect(verified.body.data.id).toBe(user!.id);
    const login = await fixture.agent
      .post('/api/v1/auth/login')
      .set('X-CSRF-Token', fixture.csrfToken)
      .send({ email: EMAIL, password: PASSWORD });
    expect(login.status).toBe(200);
  });

  it('hashes verification tokens, preserves expiry and accepts each token only once', async () => {
    const fixture = await buildFixture();
    const createToken = vi.spyOn(fixture.store, 'createEmailVerificationToken');
    const before = Date.now();
    expect((await register(fixture)).status).toBe(201);
    const token = latestToken(fixture, 'verification');
    const stored = createToken.mock.calls[0]![0];
    expect(stored.tokenHash).toBe(sha256Hex(token));
    expect(stored.tokenHash).not.toBe(token);
    expect(stored.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 24 * 60 * 60_000);
    expect(stored.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 24 * 60 * 60_000);

    const verified = await fixture.agent
      .post('/api/v1/auth/verify-email')
      .set('X-CSRF-Token', fixture.csrfToken)
      .send({ token });
    expect(verified.status).toBe(200);
    expect(verified.body.data.emailVerifiedAt).not.toBeNull();
    const reused = await fixture.agent
      .post('/api/v1/auth/verify-email')
      .set('X-CSRF-Token', fixture.csrfToken)
      .send({ token });
    expect(reused.status).toBe(400);
    expect(reused.body.error.code).toBe('VERIFICATION_TOKEN_INVALID');
  });

  it('hashes reset tokens, preserves expiry, resets once and revokes existing refresh sessions', async () => {
    const fixture = await buildFixture();
    expect((await register(fixture)).status).toBe(201);
    const createToken = vi.spyOn(fixture.store, 'createPasswordResetToken');
    const before = Date.now();
    const forgot = await fixture.agent
      .post('/api/v1/auth/forgot-password')
      .set('X-CSRF-Token', fixture.csrfToken)
      .send({ email: EMAIL });
    expect(forgot.status).toBe(200);
    expect(forgot.body).toEqual({ data: { accepted: true } });
    const token = latestToken(fixture, 'password-reset');
    const stored = createToken.mock.calls[0]![0];
    expect(stored.tokenHash).toBe(sha256Hex(token));
    expect(stored.tokenHash).not.toBe(token);
    expect(stored.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 60 * 60_000);
    expect(stored.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 60 * 60_000);
    const password = 'new-local-email-regression-password';

    const reset = await fixture.agent
      .post('/api/v1/auth/reset-password')
      .set('X-CSRF-Token', fixture.csrfToken)
      .send({ token, password });
    expect(reset.status).toBe(200);
    expect(fixture.store.listSessions().every((session) => session.revokedAt !== null)).toBe(true);
    const refresh = await fixture.agent
      .post('/api/v1/auth/refresh')
      .set('X-CSRF-Token', fixture.csrfToken);
    expect(refresh.status).toBe(401);
    const reused = await fixture.agent
      .post('/api/v1/auth/reset-password')
      .set('X-CSRF-Token', fixture.csrfToken)
      .send({ token, password });
    expect(reused.status).toBe(400);
    expect(reused.body.error.code).toBe('RESET_TOKEN_INVALID');
    const login = await fixture.agent
      .post('/api/v1/auth/login')
      .set('X-CSRF-Token', fixture.csrfToken)
      .send({ email: EMAIL, password });
    expect(login.status).toBe(200);
  });

  it.each([
    ['verification', '/auth/verify-email', 'VERIFICATION_TOKEN_EXPIRED'],
    ['password-reset', '/auth/reset-password', 'RESET_TOKEN_EXPIRED'],
  ] as const)('rejects expired %s tokens', async (kind, path, code) => {
    const fixture = await buildFixture();
    const registered = await register(fixture);
    expect(registered.status).toBe(201);
    const token = 'synthetic-expired-email-token';
    const input = {
      userId: registered.body.data.id as string,
      tokenHash: sha256Hex(token),
      expiresAt: new Date(Date.now() - 1000),
    };
    if (kind === 'verification') await fixture.store.createEmailVerificationToken(input);
    else await fixture.store.createPasswordResetToken(input);
    const response = await fixture.agent
      .post(`/api/v1${path}`)
      .set('X-CSRF-Token', fixture.csrfToken)
      .send({ token, password: PASSWORD });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(code);
  });

  it('resends a locally captured verification link successfully', async () => {
    const fixture = await buildFixture();
    expect((await register(fixture)).status).toBe(201);
    fixture.emails.clear();
    const response = await fixture.agent
      .post('/api/v1/auth/resend-verification')
      .set('X-CSRF-Token', fixture.csrfToken)
      .send({ email: EMAIL });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { accepted: true } });
    const token = latestToken(fixture, 'verification');
    const verified = await fixture.agent
      .post('/api/v1/auth/verify-email')
      .set('X-CSRF-Token', fixture.csrfToken)
      .send({ token });
    expect(verified.status).toBe(200);
  });
});

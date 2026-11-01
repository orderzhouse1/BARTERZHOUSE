import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { createApp } from '../../app.js';
import { getEnv } from '../../config/index.js';
import { MemoryEmailAdapter } from '../../security/email/memory-adapter.js';
import { signAccessToken } from '../../security/jwt.js';
import { MemoryAuthStore } from './stores/memory-auth-store.js';

const EMAIL = 'session-revocation@example.com';
const PASSWORD = 'session-regression-password';

function cookieFrom(response: { headers: Record<string, unknown> }, name: string): string {
  const cookies = response.headers['set-cookie'] as string[] | undefined;
  const cookie = cookies?.find((value) => value.startsWith(`${name}=`));
  if (!cookie) throw new Error(`Expected ${name} cookie`);
  return cookie.split(';')[0]!;
}

async function buildFixture() {
  const store = new MemoryAuthStore();
  const emails = new MemoryEmailAdapter();
  const app = createApp({ authStore: store, emailDelivery: emails });
  const agent = request.agent(app);
  const env = getEnv();
  const csrf = await agent.get('/api/v1/auth/csrf');
  expect(csrf.status).toBe(200);
  const csrfToken = csrf.body.data.csrfToken as string;
  const csrfCookie = cookieFrom(csrf, env.COOKIE_CSRF_NAME);
  const registered = await agent.post('/api/v1/auth/register').set('X-CSRF-Token', csrfToken).send({
    email: EMAIL,
    password: PASSWORD,
    displayName: 'Session Test',
    preferredLocale: 'ar',
    acceptTerms: true,
  });
  expect(registered.status).toBe(201);

  const [session] = store.listSessions();
  if (!session) throw new Error('Expected a persisted session');

  return {
    app,
    agent,
    store,
    emails,
    session,
    csrfToken,
    csrfCookie,
    accessCookie: cookieFrom(registered, env.COOKIE_ACCESS_NAME),
    refreshCookie: cookieFrom(registered, env.COOKIE_REFRESH_NAME),
    userId: registered.body.data.id as string,
  };
}

type Fixture = Awaited<ReturnType<typeof buildFixture>>;

async function login(fixture: Fixture, password = PASSWORD) {
  const response = await fixture.agent
    .post('/api/v1/auth/login')
    .set('X-CSRF-Token', fixture.csrfToken)
    .send({ email: EMAIL, password });
  expect(response.status).toBe(200);
  return cookieFrom(response, getEnv().COOKIE_ACCESS_NAME);
}

async function expectBlocked(
  fixture: Fixture,
  accessCookie = fixture.accessCookie,
  status = 401,
  code = 'SESSION_REVOKED',
) {
  const updateProfile = vi.spyOn(fixture.store, 'updateProfile');
  // Replay the saved cookie explicitly: clearing the browser cookie is not revocation.
  const me = await request(fixture.app).get('/api/v1/auth/me').set('Cookie', accessCookie);
  expect(me.status).toBe(status);
  expect(me.body.error.code).toBe(code);
  expect(me.body.data).toBeUndefined();

  const patch = await request(fixture.app)
    .patch('/api/v1/users/me')
    .set('Cookie', [accessCookie, fixture.csrfCookie])
    .set('X-CSRF-Token', fixture.csrfToken)
    .send({ displayName: 'Unauthorized change' });
  expect(patch.status).toBe(status);
  expect(patch.body.error.code).toBe(code);
  expect(patch.body.data).toBeUndefined();
  expect(updateProfile).not.toHaveBeenCalled();
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('persisted sessions authorize protected reads and mutations', () => {
  it('allows a valid session to read and update its own profile', async () => {
    const fixture = await buildFixture();
    const me = await fixture.agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.id).toBe(fixture.userId);

    const patch = await fixture.agent
      .patch('/api/v1/users/me')
      .set('X-CSRF-Token', fixture.csrfToken)
      .send({ displayName: 'Updated session owner' });
    expect(patch.status).toBe(200);
    const saved = await fixture.store.findUserById(fixture.userId);
    expect(saved?.profile.displayName).toBe('Updated session owner');
  });

  it('rejects a validly signed access token for a missing session', async () => {
    const fixture = await buildFixture();
    const access = await signAccessToken({
      userId: fixture.userId,
      sessionId: 'missing-session',
      role: 'USER',
    });
    await expectBlocked(fixture, `${getEnv().COOKIE_ACCESS_NAME}=${access.token}`);
  });

  it('rejects a revoked session even while its JWT is unexpired', async () => {
    const fixture = await buildFixture();
    await fixture.store.revokeSession(fixture.session.id, 'TEST_REVOCATION', new Date());
    await expectBlocked(fixture);
  });

  it.each(['past', 'now'] as const)('rejects a session expiring in the %s', async (expiry) => {
    const fixture = await buildFixture();
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    vi.spyOn(fixture.store, 'findSessionById').mockResolvedValue({
      ...fixture.session,
      expiresAt: new Date(expiry === 'past' ? now - 1 : now),
    });
    await expectBlocked(fixture);
  });

  it('rejects a session belonging to a different user', async () => {
    const fixture = await buildFixture();
    vi.spyOn(fixture.store, 'findSessionById').mockResolvedValue({
      ...fixture.session,
      userId: 'different-session-owner',
    });
    await expectBlocked(fixture);
  });

  it.each(['SUSPENDED', 'DEACTIVATED'] as const)(
    'preserves the account-status error for a %s account',
    async (status) => {
      const fixture = await buildFixture();
      await fixture.store.setUserStatus(fixture.userId, status, new Date());
      // Account status still takes precedence, including when sessions are revoked.
      await fixture.store.revokeAllUserSessions(fixture.userId, 'ACCOUNT_DISABLED', new Date());
      await expectBlocked(fixture, fixture.accessCookie, 403, `ACCOUNT_${status}`);
    },
  );

  it.each(['findUserById', 'findSessionById'] as const)(
    'fails closed when %s rejects',
    async (method) => {
      const fixture = await buildFixture();
      vi.spyOn(fixture.store, method).mockRejectedValue(new Error('Test storage unavailable'));
      await expectBlocked(fixture, fixture.accessCookie, 500, 'INTERNAL_ERROR');
    },
  );

  it('rejects an invalid JWT before querying sessions', async () => {
    const fixture = await buildFixture();
    const findSession = vi.spyOn(fixture.store, 'findSessionById');
    await expectBlocked(
      fixture,
      `${getEnv().COOKIE_ACCESS_NAME}=not-a-valid-jwt`,
      401,
      'AUTH_REQUIRED',
    );
    expect(findSession).not.toHaveBeenCalled();
  });

  it('preserves ACCESS_TOKEN_EXPIRED before querying sessions', async () => {
    const fixture = await buildFixture();
    const findSession = vi.spyOn(fixture.store, 'findSessionById');
    const now = Date.now();
    // Sign an already-expired JWT without waiting or advancing the test server clock.
    const signingTime = now - (getEnv().JWT_ACCESS_TTL_MINUTES + 1) * 60_000;
    const clock = vi.spyOn(Date, 'now').mockReturnValue(signingTime);
    const access = await signAccessToken({
      userId: fixture.userId,
      sessionId: fixture.session.id,
      role: 'USER',
    });
    clock.mockRestore();
    await expectBlocked(
      fixture,
      `${getEnv().COOKIE_ACCESS_NAME}=${access.token}`,
      401,
      'ACCESS_TOKEN_EXPIRED',
    );
    expect(findSession).not.toHaveBeenCalled();
  });
});

describe('access tokens are rejected after session invalidation', () => {
  it('logout rejects saved access while another session remains valid', async () => {
    const fixture = await buildFixture();
    const otherAccessCookie = await login(fixture);
    const response = await request(fixture.app)
      .post('/api/v1/auth/logout')
      .set('Cookie', [fixture.accessCookie, fixture.csrfCookie])
      .set('X-CSRF-Token', fixture.csrfToken);
    expect(response.status).toBe(204);
    await expectBlocked(fixture);

    const other = await request(fixture.app)
      .get('/api/v1/auth/me')
      .set('Cookie', otherAccessCookie);
    expect(other.status).toBe(200);
  });

  it('logout-all immediately rejects access cookies from multiple sessions', async () => {
    const fixture = await buildFixture();
    const secondAccessCookie = await login(fixture);
    const response = await fixture.agent
      .post('/api/v1/auth/logout-all')
      .set('X-CSRF-Token', fixture.csrfToken);
    expect(response.status).toBe(204);
    await expectBlocked(fixture);
    await expectBlocked(fixture, secondAccessCookie);
  });

  it('password reset revokes saved access and permits login with the new password', async () => {
    const fixture = await buildFixture();
    const secondAccessCookie = await login(fixture);
    const forgot = await fixture.agent
      .post('/api/v1/auth/forgot-password')
      .set('X-CSRF-Token', fixture.csrfToken)
      .send({ email: EMAIL });
    expect(forgot.status).toBe(200);
    const message = fixture.emails.findLatestFor(EMAIL, 'password-reset');
    if (!message) throw new Error('Expected a test password reset email');
    const token = new URL(message.url).searchParams.get('token');
    if (!token) throw new Error('Expected a test password reset token');
    const newPassword = 'a-new-session-regression-password';
    const reset = await fixture.agent
      .post('/api/v1/auth/reset-password')
      .set('X-CSRF-Token', fixture.csrfToken)
      .send({ token, password: newPassword });
    expect(reset.status).toBe(200);
    await expectBlocked(fixture);
    await expectBlocked(fixture, secondAccessCookie);

    const accessCookie = await login(fixture, newPassword);
    const me = await request(fixture.app).get('/api/v1/auth/me').set('Cookie', accessCookie);
    expect(me.status).toBe(200);
  });

  it('normal refresh rotation preserves access and issues usable new cookies', async () => {
    const fixture = await buildFixture();
    const refreshed = await fixture.agent
      .post('/api/v1/auth/refresh')
      .set('X-CSRF-Token', fixture.csrfToken);
    expect(refreshed.status).toBe(200);
    expect(cookieFrom(refreshed, getEnv().COOKIE_REFRESH_NAME)).not.toBe(fixture.refreshCookie);
    for (const accessCookie of [
      fixture.accessCookie,
      cookieFrom(refreshed, getEnv().COOKIE_ACCESS_NAME),
    ]) {
      const me = await request(fixture.app).get('/api/v1/auth/me').set('Cookie', accessCookie);
      expect(me.status).toBe(200);
    }
    const patch = await fixture.agent
      .patch('/api/v1/users/me')
      .set('X-CSRF-Token', fixture.csrfToken)
      .send({ city: 'Amman' });
    expect(patch.status).toBe(200);
  });

  it('refresh reuse revokes the family and preserves other families', async () => {
    const fixture = await buildFixture();
    const sibling = await fixture.store.createSession({
      id: 'same-family-sibling',
      userId: fixture.userId,
      familyId: fixture.session.familyId,
      refreshTokenHash: 'unused-test-refresh-hash',
      expiresAt: fixture.session.expiresAt,
    });
    const siblingAccess = await signAccessToken({
      userId: fixture.userId,
      sessionId: sibling.id,
      role: 'USER',
    });
    const refreshed = await fixture.agent
      .post('/api/v1/auth/refresh')
      .set('X-CSRF-Token', fixture.csrfToken);
    expect(refreshed.status).toBe(200);
    const rotatedAccessCookie = cookieFrom(refreshed, getEnv().COOKIE_ACCESS_NAME);
    const independentAccessCookie = await login(fixture);

    const reuse = await request(fixture.app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [fixture.refreshCookie, fixture.csrfCookie])
      .set('X-CSRF-Token', fixture.csrfToken);
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    await expectBlocked(fixture);
    await expectBlocked(fixture, rotatedAccessCookie);
    await expectBlocked(fixture, `${getEnv().COOKIE_ACCESS_NAME}=${siblingAccess.token}`);

    const independent = await request(fixture.app)
      .get('/api/v1/auth/me')
      .set('Cookie', independentAccessCookie);
    expect(independent.status).toBe(200);
  });
});

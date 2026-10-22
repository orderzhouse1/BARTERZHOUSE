import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { publicAuthenticatedUserSchema } from '@barterzhouse/shared';

import { createApp } from '../../app.js';
import { MemoryEmailAdapter } from '../../security/email/memory-adapter.js';
import { MemoryAuthStore } from './stores/memory-auth-store.js';

function buildApp() {
  return createApp({ authStore: new MemoryAuthStore(), emailDelivery: new MemoryEmailAdapter() });
}

function registrationPayload(overrides: Record<string, unknown> = {}) {
  return {
    email: 'http-test@example.com',
    password: 'a-strong-password-123',
    displayName: 'Http Test',
    preferredLocale: 'ar',
    acceptTerms: true,
    ...overrides,
  };
}

describe('GET /api/v1/auth/csrf', () => {
  it('issues a csrf token and sets a readable csrf cookie', async () => {
    const app = buildApp();
    const response = await request(app).get('/api/v1/auth/csrf');

    expect(response.status).toBe(200);
    expect(typeof response.body.data.csrfToken).toBe('string');

    const setCookies = (response.headers['set-cookie'] ?? []) as string[];
    expect(setCookies.some((cookie) => cookie.startsWith('barter_csrf='))).toBe(true);
  });
});

describe('CSRF protection on mutating auth routes', () => {
  it('rejects a POST with no CSRF header', async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await agent.get('/api/v1/auth/csrf');

    const response = await agent.post('/api/v1/auth/register').send(registrationPayload());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_INVALID');
  });

  it('rejects a POST with a CSRF header that does not match the cookie', async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await agent.get('/api/v1/auth/csrf');

    const response = await agent
      .post('/api/v1/auth/register')
      .set('x-csrf-token', 'totally-invalid-token')
      .send(registrationPayload());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_INVALID');
  });

  it('accepts a POST when the CSRF header matches a valid cookie', async () => {
    const app = buildApp();
    const agent = request.agent(app);
    const csrfResponse = await agent.get('/api/v1/auth/csrf');
    const csrfToken = csrfResponse.body.data.csrfToken as string;

    const response = await agent
      .post('/api/v1/auth/register')
      .set('x-csrf-token', csrfToken)
      .send(registrationPayload());

    expect(response.status).toBe(201);
  });
});

describe('POST /api/v1/auth/register', () => {
  it('sets access and refresh cookies and returns the public user shape', async () => {
    const app = buildApp();
    const agent = request.agent(app);
    const csrfToken = (await agent.get('/api/v1/auth/csrf')).body.data.csrfToken as string;

    const response = await agent
      .post('/api/v1/auth/register')
      .set('x-csrf-token', csrfToken)
      .send(registrationPayload({ email: 'cookies@example.com' }));

    expect(response.status).toBe(201);

    const parsed = publicAuthenticatedUserSchema.safeParse(response.body.data);
    expect(parsed.success).toBe(true);

    const setCookies = (response.headers['set-cookie'] ?? []) as string[];
    expect(setCookies.some((cookie) => cookie.startsWith('barter_access='))).toBe(true);
    expect(setCookies.some((cookie) => cookie.startsWith('barter_refresh='))).toBe(true);
  });

  it('returns a structured validation error for a malformed body', async () => {
    const app = buildApp();
    const agent = request.agent(app);
    const csrfToken = (await agent.get('/api/v1/auth/csrf')).body.data.csrfToken as string;

    const response = await agent
      .post('/api/v1/auth/register')
      .set('x-csrf-token', csrfToken)
      .send({ email: 'not-an-email', password: 'short', displayName: '', acceptTerms: false });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.fieldErrors).toBeTruthy();
    expect(Object.keys(response.body.error.fieldErrors).length).toBeGreaterThan(0);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('rejects unauthenticated requests', async () => {
    const app = buildApp();
    const response = await request(app).get('/api/v1/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('returns the current user for an authenticated session', async () => {
    const app = buildApp();
    const agent = request.agent(app);
    const csrfToken = (await agent.get('/api/v1/auth/csrf')).body.data.csrfToken as string;

    await agent
      .post('/api/v1/auth/register')
      .set('x-csrf-token', csrfToken)
      .send(registrationPayload({ email: 'me-route@example.com' }));

    const meResponse = await agent.get('/api/v1/auth/me');

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data.email).toBe('me-route@example.com');
  });
});

describe('existing Phase 0 behavior is preserved', () => {
  it('still serves /health', async () => {
    const app = buildApp();
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('ok');
  });

  it('still returns a typed 404 for unknown routes', async () => {
    const app = buildApp();
    const response = await request(app).get('/api/v1/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

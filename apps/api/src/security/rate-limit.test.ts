import { afterEach, describe, expect, it, vi } from 'vitest';
import express, { type RequestHandler } from 'express';
import { MemoryStore } from 'express-rate-limit';
import request from 'supertest';

import { createApp } from '../app.js';
import { loadEnv } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { errorHandler } from '../middleware/error-handler.js';
import { requestIdMiddleware } from '../middleware/request-id.js';
import { MemoryAuthStore } from '../modules/auth/stores/memory-auth-store.js';
import { MemoryEmailAdapter } from './email/memory-adapter.js';
import {
  AUTH_RATE_LIMITS,
  forgotPasswordEmailRateLimiter,
  forgotPasswordRateLimiter,
  loginRateLimiter,
  refreshRateLimiter,
  registerRateLimiter,
  resendVerificationEmailRateLimiter,
  resendVerificationRateLimiter,
  resetPasswordRateLimiter,
  verifyEmailRateLimiter,
} from './rate-limit.js';

function limiterApp(limiter: RequestHandler, trustedTestProxy = false) {
  const app = express();
  // Only this isolated harness trusts its loopback test proxy to simulate client IPs.
  app.set('trust proxy', trustedTestProxy ? 'loopback' : false);
  app.use(express.json());
  app.use(requestIdMiddleware);
  app.post('/test', limiter, (_req, res) => {
    res.status(200).json({ data: { accepted: true } });
  });
  app.use(errorHandler);
  return app;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('active IP limits in the test environment', () => {
  it.each([
    ['register', registerRateLimiter, AUTH_RATE_LIMITS.register],
    ['login', loginRateLimiter, AUTH_RATE_LIMITS.login],
    ['refresh', refreshRateLimiter, AUTH_RATE_LIMITS.refresh],
    ['forgot-password', forgotPasswordRateLimiter, AUTH_RATE_LIMITS.forgotPassword],
    ['resend-verification', resendVerificationRateLimiter, AUTH_RATE_LIMITS.resendVerification],
    ['reset-password', resetPasswordRateLimiter, AUTH_RATE_LIMITS.resetPassword],
    ['verify-email', verifyEmailRateLimiter, AUTH_RATE_LIMITS.verifyEmail],
  ] as const)(
    '%s allows exactly its threshold and then returns the API 429 contract',
    async (_name, create, policy) => {
      const app = limiterApp(create());
      for (let attempt = 0; attempt < policy.limit; attempt++) {
        expect((await request(app).post('/test').send({})).status).toBe(200);
      }
      const blocked = await request(app).post('/test').send({});
      expect(blocked.status).toBe(429);
      expect(blocked.body.error.code).toBe('RATE_LIMITED');
      expect(blocked.body.error.requestId).toBeTruthy();
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
      expect(Number(blocked.headers['retry-after'])).toBeLessThanOrEqual(policy.windowMs / 1000);
      expect(blocked.headers['ratelimit']).toContain(`limit=${policy.limit}`);
      expect(blocked.headers['x-ratelimit-limit']).toBeUndefined();
    },
  );

  it('resets at the exact window boundary and reports Retry-After in seconds', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const start = new Date('2030-01-01T00:00:00.000Z');
    vi.setSystemTime(start);
    const app = limiterApp(resetPasswordRateLimiter());
    const policy = AUTH_RATE_LIMITS.resetPassword;
    for (let attempt = 0; attempt < policy.limit; attempt++) await request(app).post('/test');
    const blocked = await request(app).post('/test');
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBe('900');
    vi.setSystemTime(start.getTime() + policy.windowMs - 1);
    const lastMillisecond = await request(app).post('/test');
    expect(lastMillisecond.status).toBe(429);
    expect(lastMillisecond.headers['retry-after']).toBe('1');
    vi.setSystemTime(start.getTime() + policy.windowMs);
    expect((await request(app).post('/test')).status).toBe(200);
  });

  it('keeps distinct IPv4 clients independent in an explicitly trusted test harness', async () => {
    const app = limiterApp(loginRateLimiter(), true);
    for (let attempt = 0; attempt < AUTH_RATE_LIMITS.login.limit; attempt++) {
      await request(app).post('/test').set('X-Forwarded-For', '192.0.2.1');
    }
    expect((await request(app).post('/test').set('X-Forwarded-For', '192.0.2.1')).status).toBe(429);
    expect((await request(app).post('/test').set('X-Forwarded-For', '192.0.2.2')).status).toBe(200);
  });

  it('groups rotating IPv6 addresses within the default /56 subnet', async () => {
    const app = limiterApp(loginRateLimiter(), true);
    for (let attempt = 0; attempt < AUTH_RATE_LIMITS.login.limit; attempt++) {
      const response = await request(app)
        .post('/test')
        .set('X-Forwarded-For', `2001:db8:abcd:1200::${attempt + 1}`);
      expect(response.status).toBe(200);
    }
    expect(
      (await request(app).post('/test').set('X-Forwarded-For', '2001:db8:abcd:12ff::99')).status,
    ).toBe(429);
    expect(
      (await request(app).post('/test').set('X-Forwarded-For', '2001:db8:abcd:1300::99')).status,
    ).toBe(200);
  });

  it('fails closed and sanitizes a rate-store exception', async () => {
    const app = limiterApp(resetPasswordRateLimiter());
    const log = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    vi.spyOn(MemoryStore.prototype, 'increment').mockRejectedValueOnce(
      new Error('synthetic-store-secret?token=private'),
    );
    const response = await request(app).post('/test');
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(log).toHaveBeenCalledExactlyOnceWith(
      { event: 'AUTH_RATE_LIMIT_FAILED' },
      'Authentication rate limiter failed.',
    );
    expect(JSON.stringify([response.body, log.mock.calls])).not.toContain('synthetic-store-secret');
  });
});

describe('normalized account/email abuse protection', () => {
  it.each([forgotPasswordEmailRateLimiter, resendVerificationEmailRateLimiter])(
    'limits a normalized email across distinct client IPs',
    async (create) => {
      const app = limiterApp(create(), true);
      const variants = [
        'Target@Example.invalid',
        ' target@example.invalid ',
        'TARGET@EXAMPLE.INVALID',
      ];
      for (let attempt = 0; attempt < AUTH_RATE_LIMITS.email.limit; attempt++) {
        const response = await request(app)
          .post('/test')
          .set('X-Forwarded-For', `192.0.2.${attempt + 1}`)
          .send({ email: variants[attempt % variants.length] });
        expect(response.status).toBe(200);
      }
      const blocked = await request(app)
        .post('/test')
        .set('X-Forwarded-For', '198.51.100.1')
        .send({ email: 'target@example.invalid' });
      expect(blocked.status).toBe(429);
      expect(blocked.body.error.code).toBe('RATE_LIMITED');
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
      expect(
        (await request(app).post('/test').send({ email: 'other@example.invalid' })).status,
      ).toBe(200);
    },
  );

  it('uses HMAC keys rather than storing a raw email identifier', async () => {
    const app = limiterApp(forgotPasswordEmailRateLimiter());
    const increment = vi.spyOn(MemoryStore.prototype, 'increment');
    await request(app).post('/test').send({ email: 'private-email@example.invalid' });
    expect(increment).toHaveBeenCalledTimes(1);
    const key = increment.mock.calls[0]![0];
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key).not.toContain('private-email');
  });

  it('skips malformed email values for the email bucket while retaining IP protection', async () => {
    const app = limiterApp(forgotPasswordEmailRateLimiter());
    const increment = vi.spyOn(MemoryStore.prototype, 'increment');
    for (const email of [undefined, null, {}, 'invalid'])
      await request(app).post('/test').send({ email });
    expect(increment).not.toHaveBeenCalled();
  });

  it.each(['/forgot-password', '/resend-verification'])(
    '%s produces identical successful and limited responses for existing and missing accounts',
    async (path) => {
      const attempts = async (existing: boolean) => {
        const store = new MemoryAuthStore();
        if (existing)
          await store.createUserWithProfile({
            email: 'target@example.invalid',
            normalizedEmail: 'target@example.invalid',
            passwordHash: 'unused-test-hash',
            displayName: 'Target Test',
            preferredLocale: 'ar',
          });
        const agent = request.agent(
          createApp({ authStore: store, emailDelivery: new MemoryEmailAdapter() }),
        );
        const csrf = (await agent.get('/api/v1/auth/csrf')).body.data.csrfToken as string;
        const results = [];
        for (let attempt = 0; attempt <= AUTH_RATE_LIMITS.email.limit; attempt++) {
          const response = await agent
            .post(`/api/v1/auth${path}`)
            .set('X-CSRF-Token', csrf)
            .set('X-Request-Id', 'rate-enumeration-test')
            .send({ email: 'target@example.invalid' });
          results.push({ status: response.status, body: response.body });
        }
        return results;
      };
      const existing = await attempts(true);
      const missing = await attempts(false);
      expect(existing).toEqual(missing);
      expect(existing[0]).toEqual({ status: 200, body: { data: { accepted: true } } });
      expect(existing.at(-1)?.status).toBe(429);
      expect(JSON.stringify(existing)).not.toContain('target@example.invalid');
    },
  );

  it('keeps forgot-password and resend-verification buckets independent', async () => {
    const agent = request.agent(
      createApp({ authStore: new MemoryAuthStore(), emailDelivery: new MemoryEmailAdapter() }),
    );
    const csrf = (await agent.get('/api/v1/auth/csrf')).body.data.csrfToken as string;
    for (let attempt = 0; attempt <= AUTH_RATE_LIMITS.email.limit; attempt++) {
      await agent
        .post('/api/v1/auth/forgot-password')
        .set('X-CSRF-Token', csrf)
        .send({ email: 'target@example.invalid' });
    }
    const response = await agent
      .post('/api/v1/auth/resend-verification')
      .set('X-CSRF-Token', csrf)
      .send({ email: 'target@example.invalid' });
    expect(response.status).toBe(200);
  });
});

describe('route wiring and deployment assumptions', () => {
  it.each([
    ['/reset-password', AUTH_RATE_LIMITS.resetPassword],
    ['/verify-email', AUTH_RATE_LIMITS.verifyEmail],
    ['/forgot-password', AUTH_RATE_LIMITS.forgotPassword],
    ['/resend-verification', AUTH_RATE_LIMITS.resendVerification],
  ] as const)('%s enforces IP limits even before CSRF succeeds', async (path, policy) => {
    const app = createApp({
      authStore: new MemoryAuthStore(),
      emailDelivery: new MemoryEmailAdapter(),
    });
    expect(app.get('trust proxy')).toBe(false);
    for (let attempt = 0; attempt < policy.limit; attempt++) {
      const response = await request(app)
        .post(`/api/v1/auth${path}`)
        .set('X-Forwarded-For', `192.0.2.${attempt + 1}`)
        .set('Forwarded', `for=198.51.100.${attempt + 1}`)
        .send({ token: 'synthetic-private-token' });
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('CSRF_INVALID');
    }
    const blocked = await request(app)
      .post(`/api/v1/auth${path}`)
      .set('X-Forwarded-For', '203.0.113.99')
      .send({ token: 'synthetic-private-token' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(JSON.stringify(blocked.body)).not.toContain('synthetic-private-token');
  });

  it('blocks declared multi-process deployment until a shared store is implemented', () => {
    const input = {
      NODE_ENV: 'test',
      WEB_ORIGIN: 'http://localhost:3000',
      JWT_ACCESS_SECRET: 'test-access-'.repeat(5),
      JWT_REFRESH_SECRET: 'test-refresh-'.repeat(5),
      CSRF_SECRET: 'test-csrf-'.repeat(5),
      EMAIL_DELIVERY_MODE: 'memory',
    };
    expect(loadEnv(input).API_INSTANCE_COUNT).toBe(1);
    expect(() => loadEnv({ ...input, API_INSTANCE_COUNT: '2' })).toThrow(
      'shared store is required before scaling',
    );
  });
});

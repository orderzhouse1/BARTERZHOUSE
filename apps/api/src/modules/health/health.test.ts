import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { healthResponseSchema } from '@barterzhouse/shared';

import { createApp } from '../../app.js';
import { envSchemaForTests } from '../../config/env.js';

describe('GET /health and /api/v1/health', () => {
  const app = createApp();

  it('returns a valid health payload at /health', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBeTruthy();

    const parsed = healthResponseSchema.safeParse(response.body);
    expect(parsed.success).toBe(true);
    expect(response.body.data.status).toBe('ok');
    expect(response.body.data.service).toBe('barterhouse-api');
  });

  it('returns a valid health payload at /api/v1/health', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    const parsed = healthResponseSchema.safeParse(response.body);
    expect(parsed.success).toBe(true);
  });
});

describe('not-found handler', () => {
  const app = createApp();

  it('returns a typed 404 for unknown routes', async () => {
    const response = await request(app).get('/api/v1/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        code: 'NOT_FOUND',
        message: expect.stringContaining('GET /api/v1/does-not-exist'),
      },
    });
    expect(response.body.error.requestId).toBeTruthy();
  });
});

const REQUIRED_TEST_SECRETS = {
  JWT_ACCESS_SECRET: 'a-valid-test-access-secret-that-is-long-enough',
  JWT_REFRESH_SECRET: 'a-valid-test-refresh-secret-that-is-long-enough',
  CSRF_SECRET: 'a-valid-test-csrf-secret-that-is-long-enough',
};

describe('environment schema', () => {
  it('accepts valid Phase 0 configuration plus Phase 1 secrets', () => {
    const result = envSchemaForTests.safeParse({
      NODE_ENV: 'development',
      PORT: '4000',
      WEB_ORIGIN: 'http://localhost:3000',
      ...REQUIRED_TEST_SECRETS,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(4000);
      expect(result.data.AUTH_PERSISTENCE).toBe('memory');
    }
  });

  it('rejects a malformed WEB_ORIGIN', () => {
    const result = envSchemaForTests.safeParse({
      NODE_ENV: 'development',
      PORT: '4000',
      WEB_ORIGIN: 'not-a-url',
      ...REQUIRED_TEST_SECRETS,
    });

    expect(result.success).toBe(false);
  });

  it('does not require DATABASE_URL when AUTH_PERSISTENCE defaults to memory', () => {
    const result = envSchemaForTests.safeParse({
      WEB_ORIGIN: 'http://localhost:3000',
      ...REQUIRED_TEST_SECRETS,
    });

    expect(result.success).toBe(true);
  });

  it('rejects missing JWT secrets', () => {
    const result = envSchemaForTests.safeParse({
      WEB_ORIGIN: 'http://localhost:3000',
    });

    expect(result.success).toBe(false);
  });
});

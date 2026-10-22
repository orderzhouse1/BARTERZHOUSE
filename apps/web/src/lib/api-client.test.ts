import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NEXT_PUBLIC_API_URL ??= 'http://localhost:4000/api/v1';
process.env.NEXT_PUBLIC_APP_URL ??= 'http://localhost:3000';

import { __resetApiClientStateForTests, apiClient, onSessionExpired } from '@/lib/api-client';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function noContentResponse(): Response {
  return new Response(null, { status: 204 });
}

describe('apiClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __resetApiClientStateForTests();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches a CSRF token once and reuses it across mutating requests', async () => {
    let csrfCalls = 0;

    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/auth/csrf')) {
        csrfCalls += 1;
        return jsonResponse(200, { data: { csrfToken: 'csrf-token-1' } });
      }
      if (url.endsWith('/auth/logout')) {
        return noContentResponse();
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await apiClient.logout();
    await apiClient.logout();

    expect(csrfCalls).toBe(1);
  });

  it('sends the cached CSRF token as the X-CSRF-Token header', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/csrf')) {
        return jsonResponse(200, { data: { csrfToken: 'csrf-secret' } });
      }
      if (url.endsWith('/auth/logout')) {
        const headers = new Headers(init?.headers);
        expect(headers.get('X-CSRF-Token')).toBe('csrf-secret');
        return noContentResponse();
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await apiClient.logout();
  });

  it('does not attach a CSRF header for GET requests', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/me')) {
        const headers = new Headers(init?.headers);
        expect(headers.has('X-CSRF-Token')).toBe(false);
        return jsonResponse(200, { data: { id: 'u1' } });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await apiClient.getMe();
  });

  it('refreshes once on ACCESS_TOKEN_EXPIRED and retries the original request exactly once', async () => {
    let meCalls = 0;
    let refreshCalls = 0;

    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/auth/csrf')) {
        return jsonResponse(200, { data: { csrfToken: 'csrf-token' } });
      }
      if (url.endsWith('/auth/me')) {
        meCalls += 1;
        if (meCalls === 1) {
          return jsonResponse(401, { error: { code: 'ACCESS_TOKEN_EXPIRED', message: 'expired' } });
        }
        return jsonResponse(200, { data: { id: 'u1' } });
      }
      if (url.endsWith('/auth/refresh')) {
        refreshCalls += 1;
        return jsonResponse(200, { data: { id: 'u1' } });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const result = await apiClient.getMe();

    expect(result).toEqual({ id: 'u1' });
    expect(refreshCalls).toBe(1);
    expect(meCalls).toBe(2);
  });

  it('dedupes concurrent refreshes triggered by parallel 401s and never loops', async () => {
    let refreshCalls = 0;
    let meCalls = 0;

    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/auth/csrf')) {
        return jsonResponse(200, { data: { csrfToken: 'csrf-token' } });
      }
      if (url.endsWith('/auth/me')) {
        meCalls += 1;
        // Access remains invalid even after refresh, to prove we don't loop.
        return jsonResponse(401, { error: { code: 'ACCESS_TOKEN_EXPIRED', message: 'expired' } });
      }
      if (url.endsWith('/auth/refresh')) {
        refreshCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return jsonResponse(200, { data: { id: 'u1' } });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const results = await Promise.allSettled([apiClient.getMe(), apiClient.getMe()]);

    expect(refreshCalls).toBe(1);
    // Two original attempts + exactly one retry each = 4, not more.
    expect(meCalls).toBe(4);
    for (const result of results) {
      expect(result.status).toBe('rejected');
    }
  });

  it('clears session state and notifies listeners without looping when refresh fails', async () => {
    let refreshCalls = 0;
    let meCalls = 0;
    let sessionExpiredCount = 0;
    const unsubscribe = onSessionExpired(() => {
      sessionExpiredCount += 1;
    });

    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/auth/csrf')) {
        return jsonResponse(200, { data: { csrfToken: 'csrf-token' } });
      }
      if (url.endsWith('/auth/me')) {
        meCalls += 1;
        return jsonResponse(401, { error: { code: 'ACCESS_TOKEN_EXPIRED', message: 'expired' } });
      }
      if (url.endsWith('/auth/refresh')) {
        refreshCalls += 1;
        return jsonResponse(401, { error: { code: 'INVALID_REFRESH_TOKEN', message: 'invalid' } });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await expect(apiClient.getMe()).rejects.toMatchObject({ code: 'ACCESS_TOKEN_EXPIRED' });

    expect(refreshCalls).toBe(1);
    expect(meCalls).toBe(1);
    expect(sessionExpiredCount).toBe(1);

    unsubscribe();
  });

  it('does not attempt a refresh for non-auth errors', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/auth/me')) {
        return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'missing' } });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await expect(apiClient.getMe()).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });

  it('maps transport failures to a NETWORK_ERROR code', async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError('fetch failed');
    });

    await expect(apiClient.getMe()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('surfaces field errors from validation failures', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/auth/csrf')) {
        return jsonResponse(200, { data: { csrfToken: 'csrf-token' } });
      }
      if (url.endsWith('/auth/register')) {
        return jsonResponse(422, {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input.',
            fieldErrors: { email: ['Enter a valid email address.'] },
          },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await expect(
      apiClient.register({
        email: 'bad',
        password: 'password1234',
        displayName: 'Test User',
        preferredLocale: 'en',
        acceptTerms: true,
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      fieldErrors: { email: ['Enter a valid email address.'] },
    });
  });
});

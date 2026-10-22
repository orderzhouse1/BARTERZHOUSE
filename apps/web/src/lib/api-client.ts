import type {
  AuthErrorCode,
  LoginRequest,
  PublicAuthenticatedUser,
  RegisterRequest,
  UpdateProfileRequest,
} from '@barterzhouse/shared';

import { getWebEnv } from '@/config/env';

/**
 * Error codes the client can surface. Extends the server's AuthErrorCode union
 * with client-only codes for transport failures / unparsable responses.
 */
export type ClientErrorCode = AuthErrorCode | 'NETWORK_ERROR' | 'UNKNOWN_ERROR';

export class ApiError extends Error {
  readonly code: ClientErrorCode;
  readonly status: number;
  readonly fieldErrors?: Record<string, string[]>;
  readonly requestId?: string;

  constructor(params: {
    code: ClientErrorCode;
    status: number;
    message: string;
    fieldErrors?: Record<string, string[]>;
    requestId?: string;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.code = params.code;
    this.status = params.status;
    this.fieldErrors = params.fieldErrors;
    this.requestId = params.requestId;
  }
}

type SessionExpiredListener = () => void;

const sessionExpiredListeners = new Set<SessionExpiredListener>();

/** Subscribe to "the server rejected our session and refresh failed" events. */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

function notifySessionExpired(): void {
  for (const listener of sessionExpiredListeners) {
    listener();
  }
}

function getApiBaseUrl(): string {
  return getWebEnv().NEXT_PUBLIC_API_URL.replace(/\/$/, '');
}

type CsrfState = { token: string; fetchedAt: number };

let csrfState: CsrfState | null = null;
const CSRF_CACHE_TTL_MS = 5 * 60_000;

async function safeJson(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function fetchCsrfToken(): Promise<string> {
  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}/auth/csrf`, {
      method: 'GET',
      credentials: 'include',
    });
  } catch {
    throw new ApiError({ code: 'NETWORK_ERROR', status: 0, message: 'Network request failed.' });
  }

  const json = (await safeJson(response)) as { data?: { csrfToken?: string } } | null;
  const token = json?.data?.csrfToken;

  if (!response.ok || !token) {
    throw new ApiError({
      code: 'UNKNOWN_ERROR',
      status: response.status,
      message: 'Failed to obtain a CSRF token.',
    });
  }

  csrfState = { token, fetchedAt: Date.now() };
  return token;
}

/** Never store access/refresh tokens client-side; only this short-lived CSRF token is cached. */
async function getCsrfToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && csrfState && Date.now() - csrfState.fetchedAt < CSRF_CACHE_TTL_MS) {
    return csrfState.token;
  }

  return fetchCsrfToken();
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

const MUTATING_METHODS: ReadonlySet<HttpMethod> = new Set(['POST', 'PATCH', 'DELETE']);

type RequestOptions<TBody> = {
  method?: HttpMethod;
  body?: TBody;
  /** Internal flag to prevent a refresh-retry loop. */
  skipAuthRetry?: boolean;
};

type ApiSuccessEnvelope<T> = { data: T; meta?: Record<string, unknown> };
type ApiErrorEnvelope = {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
    requestId?: string;
  };
};

async function rawRequest<TResponse, TBody = unknown>(
  path: string,
  options: RequestOptions<TBody> = {},
): Promise<TResponse> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {};

  if (MUTATING_METHODS.has(method)) {
    headers['X-CSRF-Token'] = await getCsrfToken();
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      credentials: 'include',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError({ code: 'NETWORK_ERROR', status: 0, message: 'Network request failed.' });
  }

  const json = (await safeJson(response)) as
    ApiSuccessEnvelope<TResponse> | ApiErrorEnvelope | null;

  if (!response.ok) {
    const errorBody = json && 'error' in json ? json.error : undefined;
    throw new ApiError({
      code: (errorBody?.code as ClientErrorCode | undefined) ?? 'UNKNOWN_ERROR',
      status: response.status,
      message: errorBody?.message ?? response.statusText ?? 'Request failed.',
      fieldErrors: errorBody?.fieldErrors,
      requestId: errorBody?.requestId,
    });
  }

  if (json && 'data' in json) {
    return json.data;
  }

  return undefined as TResponse;
}

let refreshPromise: Promise<boolean> | null = null;

/** Dedupes concurrent refresh attempts so parallel 401s only hit /auth/refresh once. */
function refreshSession(): Promise<boolean> {
  refreshPromise ??= rawRequest<PublicAuthenticatedUser>('/auth/refresh', {
    method: 'POST',
    skipAuthRetry: true,
  })
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

const RETRYABLE_CODES: ReadonlySet<string> = new Set(['ACCESS_TOKEN_EXPIRED', 'AUTH_REQUIRED']);

async function request<TResponse, TBody = unknown>(
  path: string,
  options: RequestOptions<TBody> = {},
): Promise<TResponse> {
  try {
    return await rawRequest<TResponse, TBody>(path, options);
  } catch (error) {
    const canRetryWithRefresh =
      error instanceof ApiError &&
      error.status === 401 &&
      RETRYABLE_CODES.has(error.code) &&
      !options.skipAuthRetry &&
      path !== '/auth/refresh';

    if (!canRetryWithRefresh) {
      throw error;
    }

    const refreshed = await refreshSession();

    if (!refreshed) {
      csrfState = null;
      notifySessionExpired();
      throw error;
    }

    // At most one retry of the original request, after a single successful refresh.
    return rawRequest<TResponse, TBody>(path, { ...options, skipAuthRetry: true });
  }
}

export const apiClient = {
  getCsrfToken,

  register: (body: RegisterRequest) =>
    request<PublicAuthenticatedUser, RegisterRequest>('/auth/register', { method: 'POST', body }),

  login: (body: LoginRequest) =>
    request<PublicAuthenticatedUser, LoginRequest>('/auth/login', { method: 'POST', body }),

  logout: () => request<void>('/auth/logout', { method: 'POST' }),

  logoutAll: () => request<void>('/auth/logout-all', { method: 'POST' }),

  verifyEmail: (token: string) =>
    request<PublicAuthenticatedUser, { token: string }>('/auth/verify-email', {
      method: 'POST',
      body: { token },
    }),

  resendVerification: (email: string) =>
    request<{ sent: boolean }, { email: string }>('/auth/resend-verification', {
      method: 'POST',
      body: { email },
    }),

  forgotPassword: (email: string) =>
    request<{ sent: boolean }, { email: string }>('/auth/forgot-password', {
      method: 'POST',
      body: { email },
    }),

  resetPassword: (token: string, password: string) =>
    request<{ reset: boolean }, { token: string; password: string }>('/auth/reset-password', {
      method: 'POST',
      body: { token, password },
    }),

  getMe: () => request<PublicAuthenticatedUser>('/auth/me', { method: 'GET' }),

  updateProfile: (body: UpdateProfileRequest) =>
    request<PublicAuthenticatedUser, UpdateProfileRequest>('/users/me', { method: 'PATCH', body }),

  deactivateAccount: () => request<void>('/users/me/deactivate', { method: 'POST' }),
};

/** Test-only escape hatch to reset module-level caches between test cases. */
export function __resetApiClientStateForTests(): void {
  csrfState = null;
  refreshPromise = null;
}

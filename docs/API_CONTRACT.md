# API Contract

Documents **only** endpoints that currently exist.

Primary product context: [`CURSOR_PROJECT_CONTEXT.md`](./CURSOR_PROJECT_CONTEXT.md).  
Auth security details: [`AUTH_SECURITY.md`](./AUTH_SECURITY.md).

## Base URL

Local development (default; override with `PORT` / `NEXT_PUBLIC_API_URL`):

```text
http://localhost:4000
```

Versioned API prefix:

```text
/api/v1
```

## Conventions

### Success

```json
{
  "data": {},
  "meta": {}
}
```

### Error

```json
{
  "error": {
    "code": "STABLE_ERROR_CODE",
    "message": "Safe user-facing message",
    "fieldErrors": {},
    "requestId": "uuid"
  }
}
```

### Headers

| Header         | Notes                                                        |
| -------------- | ------------------------------------------------------------ |
| `x-request-id` | Echoed on responses                                          |
| `X-CSRF-Token` | Required for cookie-authenticated / cookie-setting mutations |
| `Content-Type` | `application/json` for JSON bodies                           |
| `Cookie`       | HttpOnly access/refresh + CSRF cookies                       |

CORS is restricted to `WEB_ORIGIN` with `credentials: true`.

### Stable error codes

`VALIDATION_ERROR`, `NOT_FOUND`, `INTERNAL_ERROR`, `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`, `ACCOUNT_SUSPENDED`, `ACCOUNT_DEACTIVATED`, `AUTH_REQUIRED`, `ACCESS_TOKEN_EXPIRED`, `INVALID_REFRESH_TOKEN`, `SESSION_REVOKED`, `CSRF_INVALID`, `EMAIL_ALREADY_REGISTERED`, `VERIFICATION_TOKEN_INVALID`, `VERIFICATION_TOKEN_EXPIRED`, `RESET_TOKEN_INVALID`, `RESET_TOKEN_EXPIRED`, `RATE_LIMITED`

## Health

### `GET /health` and `GET /api/v1/health`

```json
{
  "data": {
    "status": "ok",
    "service": "barterhouse-api",
    "timestamp": "2026-08-02T11:00:00.000Z"
  }
}
```

Does not require a database.

## Authentication

All auth mutations require a prior `GET /api/v1/auth/csrf` and must send `X-CSRF-Token` matching the CSRF cookie.

### `GET /api/v1/auth/csrf`

Returns `{ "data": { "csrfToken": "..." } }` and sets the CSRF cookie.

### `POST /api/v1/auth/register`

Body: `email`, `password`, `displayName`, `preferredLocale`, `acceptTerms: true`.

Creates `USER` + profile, starts email verification, sets access/refresh cookies.

### `POST /api/v1/auth/login`

Body: `email`, `password`. Generic `INVALID_CREDENTIALS` on failure. Rejects suspended/deactivated accounts.

### `POST /api/v1/auth/refresh`

Rotates refresh token; sets new cookies. Reuse of an old refresh token revokes the session family.

### `POST /api/v1/auth/logout`

Revokes current session; clears auth cookies. Idempotent success.

### `POST /api/v1/auth/logout-all`

Revokes all user sessions; clears cookies.

### `GET /api/v1/auth/me`

Returns the authenticated public user payload.

### `POST /api/v1/auth/verify-email`

Body: `{ "token": "..." }`.

### `POST /api/v1/auth/resend-verification`

Body: `{ "email": "..." }`. Always returns a generic success (no account enumeration).

### `POST /api/v1/auth/forgot-password`

Body: `{ "email": "..." }`. Always returns a generic success.

### `POST /api/v1/auth/reset-password`

Body: `{ "token": "...", "password": "..." }`. Consumes token, updates password, revokes all sessions.

## Users (authenticated)

### `GET /api/v1/users/me`

Same public user shape as `/auth/me`.

### `PATCH /api/v1/users/me`

Body (all optional): `displayName`, `bio`, `city`, `area`, `preferredLocale`.

### `POST /api/v1/users/me/deactivate`

Sets status `DEACTIVATED`, revokes all sessions, clears cookies. Soft-delete only.

## Authenticated user shape

```json
{
  "data": {
    "id": "...",
    "email": "user@example.com",
    "role": "USER",
    "status": "ACTIVE",
    "emailVerifiedAt": null,
    "createdAt": "2026-08-02T11:00:00.000Z",
    "profile": {
      "displayName": "...",
      "bio": null,
      "city": null,
      "area": null,
      "preferredLocale": "ar"
    }
  }
}
```

Passwords, hashes, and raw tokens are never returned.

## Out of scope

Listings, offers, conversations, trades, reviews, notifications, reports, admin, payments, and OAuth are not implemented.

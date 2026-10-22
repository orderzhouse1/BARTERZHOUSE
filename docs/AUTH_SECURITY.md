# Authentication Security — Phase 1

## Overview

Authentication is cookie-based. The Express API is the security boundary. The browser never stores access or refresh tokens in `localStorage`, `sessionStorage`, or application JavaScript state.

## Tokens

| Token   | Lifetime (default) | Storage                                        |
| ------- | ------------------ | ---------------------------------------------- |
| Access  | 15 minutes         | HttpOnly cookie (`barter_access`)              |
| Refresh | 30 days            | HttpOnly cookie (`barter_refresh`)             |
| CSRF    | session-oriented   | Cookie (`barter_csrf`) + `X-CSRF-Token` header |

JWT claims are minimal: `sub`, `sid`, `jti`, `type`, `role`, `iat`, `exp`, `iss`, `aud`.

Separate secrets: `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.

Protected routes re-check account `status` from the store — a JWT alone cannot keep a suspended/deactivated user authenticated.

After JWT and account checks, every protected request also loads the session identified
by the verified `sid`. The session must exist, belong to the verified `sub`, have no
`revokedAt`, and have `expiresAt` strictly later than the current time. Otherwise the
API returns `401 SESSION_REVOKED`, even if the access JWT has not expired. This uses
the same `AuthStore` contract for memory and Prisma persistence, without a session cache.
Store failures propagate to the error handler and never authorize the request.

Once logout, logout-all, password reset, or refresh-token reuse detection has persisted
session revocation, subsequent protected GETs and mutations reject access tokens for
those sessions immediately. Requests already authorized before revocation are not
cancelled. Normal refresh rotation keeps the session active and does not revoke its
unexpired access tokens.

## Cookies

- Access and refresh: `HttpOnly`, `SameSite` from `COOKIE_SAME_SITE` (default `lax`), `Secure` from `COOKIE_SECURE` (must be true in production deployments over HTTPS).
- Path `/`, optional `COOKIE_DOMAIN`.
- Clearing uses identical cookie options.

## CSRF

Double-submit design:

1. Client calls `GET /api/v1/auth/csrf`.
2. Server sets CSRF cookie and returns the token in JSON.
3. Mutations send `X-CSRF-Token` matching the cookie.
4. Server validates with timing-safe comparison (HMAC-backed token).

CSRF is required for register, login, refresh, logout, logout-all, verify/resend, forgot/reset password, profile update, and deactivation.

CORS and `SameSite` are complementary, not sufficient alone.

## Refresh rotation and reuse

On successful refresh:

1. Verify JWT signature, issuer, audience, type, expiry, session id, jti.
2. Load session; compare stored refresh-token **hash**.
3. Atomically rotate hash; issue new access + refresh cookies.

If a previously rotated refresh token is presented (hash mismatch):

- Reject with `INVALID_REFRESH_TOKEN` / session revoked
- Revoke the session family
- Clear cookies
- Audit `REFRESH_REUSE_DETECTED`

## Passwords

- Argon2id with configurable memory/time/parallelism
- Policy: 10–128 characters; no forced symbol/uppercase/number rules
- Passwords are never logged or returned

## Email verification and password reset

- Opaque random tokens; only SHA-256 hashes stored
- One-time use + expiry
- Successful password reset revokes **all** sessions

### Development email workflow

Set `EMAIL_DELIVERY_MODE=development`.

The development adapter prints a clearly labeled **DEV-ONLY** verification or reset URL to the local console. Tokens are never returned in normal API JSON responses and must not be logged in production mode (`EMAIL_DELIVERY_MODE=production` refuses casual token exposure).

With `AUTH_PERSISTENCE=memory`, no Neon database is required for local auth testing.

## Persistence

| Mode     | Use                               |
| -------- | --------------------------------- |
| `memory` | Tests and local runs without Neon |
| `prisma` | Real PostgreSQL / Neon via Prisma |

Production requires `AUTH_PERSISTENCE=prisma` and `DATABASE_URL`.

## Rate limiting

Sensitive routes (login, register, refresh, resend verification, forgot/reset password) use IP-targeted Express rate limits. Exceeding limits returns `RATE_LIMITED`.

## Migration status

An initial SQL migration exists at:

```text
prisma/migrations/20260802120000_phase1_auth/migration.sql
```

It is **generated but not applied** unless an operator runs Prisma migrate against a real database with valid credentials and explicit permission.

## Manual QA (auth)

1. Obtain CSRF → register → confirm cookies set (Application → Cookies).
2. Call `/auth/me` with credentials.
3. Refresh; confirm rotation; reuse old refresh → rejected.
4. Follow DEV-ONLY verification URL from console.
5. Forgot/reset password via DEV-ONLY URL; confirm sessions revoked.
6. Update profile; deactivate account; confirm cookies cleared.
7. Mutation without CSRF → `CSRF_INVALID`.
8. Confirm Arabic/English auth pages and initial HTML `lang`/`dir`.
9. Confirm no tokens in browser storage.

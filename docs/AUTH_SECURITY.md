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

### Supported email modes and production blocker

| Mode          | Behavior                                                           | Allowed environment             |
| ------------- | ------------------------------------------------------------------ | ------------------------------- |
| `development` | Prints clearly labeled DEV-ONLY links to the local console         | Development or tests only       |
| `memory`      | Captures messages in process memory without sending                | Local development or tests only |
| `production`  | Unavailable; startup fails because no real provider is implemented | Blocked in every environment    |

`NODE_ENV=production` rejects omitted, development, and memory email modes. Selecting
`EMAIL_DELIVERY_MODE=production` also rejects startup with a clear provider-not-implemented
error. Configuration validation and the email factory both fail closed. The development
adapter checks its declared environment at construction and the runtime production flag
before every send, so a token-bearing link cannot be logged after switching to production.
The production placeholder rejects direct calls instead of reporting a successful send.

Production email readiness is **BLOCKED**. Before deployment, an approved transactional
provider integration, its credentials, sender/domain configuration, and isolated delivery
tests are required. `EMAIL_FROM` alone is not a provider integration; commented SMTP
examples are not implemented. Do not bypass the guards to deploy. A future integration
must replace the explicit unavailable-mode guard as part of its reviewed implementation,
retain local-mode rejection, and never log message bodies, token URLs, or provider secrets.

With `AUTH_PERSISTENCE=memory` and a local email mode, no Neon database is required.
Development links remain intentionally sensitive and belong only in a private local console.

### Delivery failures and public responses

The auth service discards raw adapter exceptions, including their messages, properties,
and causes. It records only `EMAIL_DELIVERY_FAILED` and the message kind, without the
recipient, token, or URL. Unknown configuration enum values are not echoed in errors.

Registration returns a sanitized `503 INTERNAL_ERROR` if delivery fails and does not
issue session cookies. The unverified account and hashed verification token may already
have been persisted; retry verification through the resend endpoint after delivery is
restored. This does not add a transactional outbox or retry queue.

Forgot-password and resend-verification return the same `200` acknowledgement,
`{ "data": { "accepted": true } }`, for eligible, missing, or already-verified accounts,
including adapter failures. This acknowledges a valid request, not successful delivery
or a queued retry. It replaces the misleading `sent: true` field. Provider failures remain
visible to operators through the sanitized event. Response timing is not guaranteed to
be constant. Token hashing, expiry, and one-time consumption are unchanged.

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

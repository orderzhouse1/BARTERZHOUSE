# QA Checklist

Do not claim Neon, email-provider, or production integrations unless they were actually configured and tested.

## Phase 0 foundation (still required)

- [ ] `pnpm install` succeeds
- [ ] Node matches `.nvmrc` (22)
- [ ] Health endpoints return `barterhouse-api`
- [ ] `/ar` and `/en` render with correct initial HTML `lang` / `dir`
- [ ] `pnpm format:check`, `lint`, `typecheck`, `test`, `build` pass
- [ ] `pnpm prisma:validate` / `prisma:generate` pass
- [ ] No secrets committed

## Phase 1 authentication

### API

- [ ] `GET /api/v1/auth/csrf` returns token and sets CSRF cookie
- [ ] Register creates user + cookies; role is always `USER`
- [ ] Duplicate normalized email rejected
- [ ] Login success / generic invalid credentials
- [ ] Suspended/deactivated users rejected
- [ ] `/auth/me` requires auth
- [ ] Refresh rotates; reused refresh rejected
- [ ] Logout / logout-all revoke sessions
- [ ] Missing/invalid CSRF rejected on mutations
- [ ] Verify email (dev console URL) works once
- [ ] Forgot/reset password (dev console URL); sessions revoked after reset
- [ ] Profile PATCH works; deactivate revokes sessions and clears cookies
- [ ] Active IP/email limits return `429 RATE_LIMITED`, Retry-After and rate-limit headers

### Web

- [ ] `/[locale]/login` and `/register` usable in ar/en
- [ ] Verify / forgot / reset password pages work
- [ ] Account area redirects when logged out
- [ ] Profile and security pages work
- [ ] No access/refresh tokens in localStorage/sessionStorage
- [ ] Mobile and desktop form layouts usable

### Persistence / email claims

- [ ] If `AUTH_PERSISTENCE=memory`: confirm suite does not need Neon
- [ ] If migration SQL exists: confirm whether `migrate deploy` was applied (default: **not applied**)
- [ ] Confirm whether a real email provider was used (default: **not used**; development adapter only)

## Security hygiene

- [ ] Passwords/tokens not present in logs
- [ ] Cookie flags appropriate for the environment
- [ ] No Git write operations by automated agents

## Task 03 regression and deployment checks

- [ ] Valid reset commits Argon2id password, token consumption, all older token invalidations, sessions and audit together
- [ ] Invalid/missing/expired/replayed tokens do not change credentials; invalid tokens are rejected before hashing
- [ ] Same-token and different-token concurrent resets for one account produce exactly one success
- [ ] Expiry during hashing is rejected; a later, newly issued token still works
- [ ] Hash/staging failures leave memory state unchanged and allow retry
- [ ] Prisma contract tests use only transaction-bound writes; actual PostgreSQL rollback is verified separately
- [ ] An old-password login overlapping reset cannot create a post-reset session
- [ ] Password-reset/database errors and limiter failures expose no raw secrets in logs or responses
- [ ] Rate limits are exercised while NODE_ENV=test; no bypass is enabled
- [ ] IP and email thresholds, exact window boundary, Retry-After, IPv6 grouping and normalization are tested
- [ ] Existing/missing accounts have identical email-limit and acknowledgement behavior
- [ ] Forged forwarding headers cannot bypass limits; production trust proxy remains false unless separately reviewed
- [ ] API_INSTANCE_COUNT matches the real worker/process count; more than one process is blocked pending a shared store
- [ ] Disposable local PostgreSQL schema is initialized without production credentials
- [ ] Opt-in PostgreSQL integration suite passes; otherwise database atomicity readiness remains BLOCKED
- [ ] After TASK 01 merges, saved pre-reset access cookies fail on protected GET and PATCH routes
- [ ] TASK 02 production-email startup guards and accepted acknowledgements remain intact

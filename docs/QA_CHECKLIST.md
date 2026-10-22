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
- [ ] Rate limit returns `RATE_LIMITED` when exceeded (optional stress)

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

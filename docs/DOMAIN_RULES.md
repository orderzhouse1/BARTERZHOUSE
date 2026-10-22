# Domain Rules — High-Level

Primary source of truth: [`CURSOR_PROJECT_CONTEXT.md`](./CURSOR_PROJECT_CONTEXT.md).

## Immutable MVP rules

1. **Product-for-product barter** — the central exchange is items for items.
2. **No payment checkout in MVP** — no required monetary transaction value, wallet, or payment gateway for the core experience.
3. **One registered user role for trading** — a normal user can both own items and request/exchange items; there is no separate buyer/seller role. `SUPER_ADMIN` exists for operators only and is never assignable via public registration or a promotion API.
4. **Backend ownership and authorization enforcement** — ownership, status, and authorization checks must be enforced in the API, not only in the UI.
5. **Atomic reservation after acceptance** — accepting an offer reserves all involved items atomically (Phase 3+).
6. **Arabic-first** — default locale is Arabic (`ar`) with `dir="rtl"`; English (`en`) is supported with `dir="ltr"`.
7. **App-like mobile experience** — mobile layouts may differ from desktop while sharing backend and URLs where practical.
8. **Privacy** — public pages show city/general area only; never exact private addresses or public contact exposure.
9. **Status transitions** — critical mutations use explicit service-layer rules and transactions.
10. **No invented product rules** — do not add payments or conflicting domain behavior without explicit approval.

## Phase 1 account rules (implemented)

- Public registration always creates `USER` with status `ACTIVE`.
- Email verification is tracked via `emailVerifiedAt` (separate from account status).
- Suspended and deactivated users cannot retain normal authenticated access (login, refresh, protected routes).
- Account deactivation is soft (`DEACTIVATED`); records are retained; reactivation is out of scope.
- Profiles expose only display name, bio, city, area, preferred locale — no exact address or phone.

## Implementation note

Listings, offers, trades, and related marketplace domain entities begin in Phase 2+.

# Baddelha / بدّلها (BARTERZHOUSE)

Arabic-first barter marketplace monorepo. Working title: **Baddelha / بدّلها**.

Users list items, describe what they want in exchange, browse listings, offer their own items, negotiate, and complete product-for-product swaps — without MVP payment checkout.

## Current phase

**Phase 1 — Authentication and User Profiles** is implemented on top of the Phase 0 foundation.

Phase 1 adds registration, login, refresh rotation, logout, email verification, password reset, CSRF-protected cookie auth, and basic profile management. It does **not** implement listings, offers, chat, trades, reviews, admin, or payments.

## Stack

| Layer     | Technology                                                                                     |
| --------- | ---------------------------------------------------------------------------------------------- |
| Web       | Next.js App Router, React, TypeScript, Tailwind CSS v4, shadcn/ui, Radix UI, lucide-react, Zod |
| API       | Express.js, TypeScript, Zod, Argon2id, JWT (jose), HttpOnly cookies                            |
| Data      | Neon PostgreSQL (optional locally), Prisma ORM; in-memory auth store for tests/local           |
| Workspace | pnpm monorepo                                                                                  |

## Prerequisites

- **Node.js** `22` (see `.nvmrc`)
- **pnpm** `10` (`packageManager`: `pnpm@10.30.3`)

## Installation

```bash
pnpm install
cp .env.example .env
cp .env.example apps/api/.env
# apps/web needs at least NEXT_PUBLIC_* values
cp .env.example apps/web/.env
```

Replace JWT and CSRF placeholders with long random secrets in local gitignored `.env` files. Do not commit real secrets.

Default local auth persistence is `AUTH_PERSISTENCE=memory` (no Neon required). Set `AUTH_PERSISTENCE=prisma` and real `DATABASE_URL` when using Postgres.

## Development

```bash
pnpm dev
```

| App          | Default URL                       |
| ------------ | --------------------------------- |
| Web (Arabic) | http://localhost:3000/ar          |
| Login        | http://localhost:3000/ar/login    |
| Register     | http://localhost:3000/ar/register |
| Account      | http://localhost:3000/ar/account  |
| API health   | http://localhost:4000/health      |
| API v1       | http://localhost:4000/api/v1      |

Ports come from `PORT` / Next defaults — keep them environment-configurable.

### Local email verification / password reset

With `EMAIL_DELIVERY_MODE=development`, the API prints a **DEV-ONLY** URL to the console containing the opaque token. Open that URL in the browser (or paste the token into the verify/reset page). Production mode must not expose tokens this way. See [`docs/AUTH_SECURITY.md`](docs/AUTH_SECURITY.md).

## Scripts

| Command                                      | Purpose                          |
| -------------------------------------------- | -------------------------------- |
| `pnpm dev`                                   | Web + API                        |
| `pnpm build` / `lint` / `typecheck` / `test` | Quality gates                    |
| `pnpm format` / `format:check`               | Prettier                         |
| `pnpm prisma:validate`                       | Validate schema                  |
| `pnpm prisma:generate`                       | Generate client                  |
| `pnpm prisma:migrate:diff`                   | Print SQL diff from empty schema |

## Database migrations

Migration SQL for Phase 1 auth models:

```text
prisma/migrations/20260802120000_phase1_auth/migration.sql
```

**Not applied automatically.** Do not run against Neon unless credentials and explicit permission exist.

## Documentation

- [`docs/CURSOR_PROJECT_CONTEXT.md`](docs/CURSOR_PROJECT_CONTEXT.md) — product source of truth
- [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) — implemented endpoints
- [`docs/AUTH_SECURITY.md`](docs/AUTH_SECURITY.md) — cookie/JWT/CSRF/session design
- [`docs/DOMAIN_RULES.md`](docs/DOMAIN_RULES.md) — immutable rules
- [`docs/QA_CHECKLIST.md`](docs/QA_CHECKLIST.md) — QA checklist

## Git restrictions for automated agents

Do **not** run `git init`, `git add`, `git commit`, `git push`, PR, or tag commands. The human operator owns Git writes.
# BARTERZHOUSE

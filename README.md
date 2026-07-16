# TipTop365

Two-sided cleaning marketplace for Bosnia & Herzegovina — "Uber for cleaning".
Customers (households and Airbnb hosts) book vetted cleaners with fixed upfront
prices; the platform handles escrow, contracts, and payouts.

**The build is governed by [docs/TECHNICAL_PLAN.md](docs/TECHNICAL_PLAN.md)** —
decisions D1–D22, work plan §13, verification gates §18. Progress = CHANGELOG.md
+ the ✅ ticks in §13. Design reference (marketing-era screens):
[Figma](https://www.figma.com/design/R40i0zCyGWzdj8m9BGoFt9/TipTop365?node-id=0%3A1&t=K3vQ86aWzMXPPvjt-1).

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind + Headless UI · **PostgreSQL
(Neon) + Prisma = system of record** · Firebase = Auth + FCM only (D3) ·
next-intl (bs default, en) · Vitest + Playwright · Sentry · Vercel Cron jobs.
Money is **integer fenings** (1 KM = 100 f) everywhere; the double-entry ledger
in `lib/domain/ledger` + `lib/server/ledger` is the source of financial truth.

## Setup

```bash
git clone https://github.com/Cevra/TipTop365 && cd TipTop365
npm install                 # runs prisma generate via postinstall
cp .env.example .env.local  # fill in the values below
npm run db:migrate          # apply migrations to your DATABASE_URL
npm run db:seed             # §12.7 demo data (idempotent)
npm run dev                 # http://localhost:3000
```

### Environment (.env.local)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Neon Postgres (pooled / unpooled for migrations) |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase client config (Auth) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` or `..._PATH` | firebase-admin credentials (sessions, backfill) |
| `BUNNY_STORAGE_ZONE` / `BUNNY_STORAGE_PASSWORD` / `BUNNY_CDN_HOST` | media storage (server-only) |
| `CRON_SECRET` | Bearer auth for `/api/jobs/*` (Vercel Cron) |
| `PAYMENT_PROVIDER` | `mock` (default) until Monri lands (E6) |
| `SENTRY_DSN` + `SENTRY_*` | error reporting (optional — inert when unset) |
| `FLAG_<NAME>` | env override for any feature flag (D12), e.g. `FLAG_CASH_PAYMENTS_ENABLED=false` |

## Commands

```bash
npm run dev                # local app
npm run lint && npm run typecheck
npm run test               # vitest UNIT (fast, no DB)
npm run test:integration   # vitest vs Postgres (needs DATABASE_URL)
npm run test:e2e           # playwright (prod build)
npm run db:migrate         # prisma migrate dev (wrapped with .env.local)
npm run db:studio          # inspect data
npm run db:seed            # full §12.7 seed (idempotent)
npm run db:backfill:identity   # legacy Firestore → Postgres (dry-run; add -- --commit)
```

Definition of done for every task: gate commands green + CHANGELOG entry +
§13 tick (see [CLAUDE.md](CLAUDE.md) for the working rules).

## Seed & demo accounts

`npm run db:seed` creates: Sarajevo + Banja Luka, the service/addon catalog,
pricing config v1 (8–15 KM/h, 20 % fee), contract templates (DRAFT-watermarked),
promo `DOBRODOSLI10`, 10 demo bookings across all statuses, and:

| Account | Email | Role |
|---|---|---|
| Amar Admin | `admin@demo.tiptop365.ba` | admin |
| Lejla Kovač | `lejla@demo.tiptop365.ba` | customer |
| Adnan Hadžić | `adnan@demo.tiptop365.ba` | customer (Airbnb host, 3 properties) |
| Amina / Selma / Dragana / Jasmin | `<name>@demo.tiptop365.ba` | cleaner (verified; FBiH / student / RS / obrt) |
| Emir / Mirsad | `<name>@demo.tiptop365.ba` | cleaner (unverified; Mirsad carries a 48 KM cash debt) |

Demo users carry fake `demo-*` Firebase UIDs — they exist for fixtures and
screens. To sign in as one, create a Firebase Auth user with the same email and
the Postgres row links on first API call (`requireDbUser`).

## Architecture pointers

- **Plan & decisions:** [docs/TECHNICAL_PLAN.md](docs/TECHNICAL_PLAN.md) (start at §2 decisions, §13 work plan)
- **Testing layers:** [docs/TESTING.md](docs/TESTING.md) · **Ops/observability:** [docs/OPS.md](docs/OPS.md)
- **Domain logic (pure, unit-tested):** `lib/domain/*` — pricing, booking FSM, ledger postings, day limits, cancellation, chat masking, recurring dates
- **Server glue:** `lib/server/*` — auth/session, posting engine, broadcast matching, payouts, jobs
- **API surface:** `app/api/*` (zod-validated, `ok`/`fail` envelope) · **Admin:** `/admin` (role-gated, audited)
- **UI primitives:** `app/components/ui` — see `/styleguide` in dev

## Deployment

Vercel (Next.js) + Neon (Postgres) + Bunny (media) + Firebase (Auth/FCM).
CI (GitHub Actions) runs lint/typecheck/unit/build + integration against a
service-container Postgres with `prisma migrate deploy && prisma db seed`.
Nightly DB dump and E2E workflows are on-schedule; `/api/jobs/*` endpoints are
driven by Vercel Cron with `CRON_SECRET`.

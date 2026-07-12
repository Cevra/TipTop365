# Testing

Three layers (plan D17 / §14):

| Layer | Command | Needs | Runs |
|---|---|---|---|
| **Unit** (pure domain) | `npm run test` | nothing | every gate + PR CI |
| **Integration** (Prisma ↔ Postgres) | `npm run test:integration` | `DATABASE_URL` | PR CI (`integration` job, Postgres service) |
| **E2E** (Playwright) | `npm run test:e2e` | app boots (+ secrets for auth flows) | nightly + on-demand (`e2e.yml`), and at gates G3/G4/G6 |

## Unit
`vitest.config.ts`, globs `tests/unit/**`. No DB, no network — fast. This is the feedback loop while coding.

## Integration
`vitest.integration.config.ts`, globs `tests/integration/**`. Point `DATABASE_URL` (in `.env.local`) at a **disposable** Postgres and run migrations first:

```bash
npm run db:migrate      # or: npx prisma migrate deploy
npm run test:integration
```

Locally the simplest disposable DB is a **Neon branch** (`npx neonctl branches create`) — no Docker needed. CI uses a `postgres:16` service container (see `.github/workflows/ci.yml`).

> **Deviation from the plan:** the plan named *Testcontainers*. This dev machine has no Docker daemon and CI on Linux gets a Postgres **service container** for free, so we use a plain `DATABASE_URL` + service container instead. The tests are agnostic to how Postgres is provided; Testcontainers can be layered in later behind the same `DATABASE_URL` with zero test changes.

## E2E
`playwright.config.ts`, specs in `tests/e2e/**`. Locally it boots `npm run dev` automatically:

```bash
npm run test:e2e:install   # one-time: download chromium
npm run test:e2e
```

Point at a deployed environment with `E2E_BASE_URL=https://staging… npm run test:e2e` (skips the local web server). Auth-dependent flows need Firebase secrets configured in the `e2e.yml` workflow; the locale-routing smoke suite only needs the app to boot.

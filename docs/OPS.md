# Ops baseline (plan D21)

What's code-complete vs. what needs an account/secret. Nothing here blocks dev.

## 1. Error monitoring — Sentry

**Code:** `sentry.{client,server,edge}.config.ts` + `instrumentation.ts` + `lib/server/observability.ts` (wired into the HTTP error mapper for unhandled 500s). All **inert unless `NEXT_PUBLIC_SENTRY_DSN` is set** — builds/dev without it are unaffected. `next.config.mjs` only wraps `withSentryConfig` when `SENTRY_AUTH_TOKEN` is present (source-map upload).

**Manual (you):**
1. Create a Sentry project → copy the DSN.
2. Set env: `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_RELEASE` (or rely on `VERCEL_GIT_COMMIT_SHA`), and for source maps `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT`.
3. Redeploy — errors + release tags flow automatically.

## 2. Backups & point-in-time recovery

**PITR (Neon):** every Neon branch keeps a history window (restore to any point within it). Free tier ≈ 6 h; raise `history_retention_seconds` on a paid plan for production. Restore: `neonctl branches restore <branch> --to-timestamp <iso>` (or the console). **Verify quarterly.**

**Logical dumps (second line):** `scripts/db-dump.mjs` runs `pg_dump` → uploads to Bunny (`backups/tiptop-<stamp>.sql`). Nightly via `.github/workflows/backup.yml`.

**Manual (you):** add repo secrets `DIRECT_URL` (prod unpooled), `BUNNY_STORAGE_ZONE`, `BUNNY_STORAGE_PASSWORD`. Without the Bunny secrets the workflow still dumps but doesn't upload (safe no-op).

## 3. Staging environment

Target: a staging Vercel deployment + a dedicated Neon branch, refreshed from seed.

**Manual (you):**
1. `npx neonctl branches create --name staging` → use its connection string as staging `DATABASE_URL`/`DIRECT_URL`.
2. Vercel: create a `staging` environment / preview with those env vars + `NEXT_PUBLIC_APP_ENV=staging`.
3. Refresh seed: `npx prisma migrate deploy && npm run db:seed:flags` (full seed lands in E1.6, then `prisma db seed`).

## 4. Uptime & dead-man checks

**Code:** `GET /api/health` returns 200 `{status:ok,db:ok}` or 503 if the DB is unreachable.

**Manual (you):**
1. Point an uptime monitor (healthchecks.io, Better Uptime, cron-job.org) at `/api/health` — alert on non-200.
2. Each cron job (E8+) will ping a dead-man URL on success; if a scheduled job stops checking in, the monitor alerts. This catches the worst failure mode: a **silent** retention/payout job that stopped running (plan D21).

## Status
| Item | Code | Needs account/secret |
|---|---|---|
| Sentry client+server+edge, release tags, 500→Sentry | ✅ | DSN (+ auth token for source maps) |
| `/api/health` | ✅ live-verified | uptime monitor to poll it |
| Nightly pg_dump → Bunny | ✅ script + workflow | `DIRECT_URL`, `BUNNY_STORAGE_*` secrets |
| Neon PITR | ✅ available (built-in) | verify + raise retention on paid plan |
| Staging + seed refresh | ✅ documented | Neon branch + Vercel env |

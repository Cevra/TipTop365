# Changelog

One entry per merged PR. Newest first. Format: `## <date> — <branch>` then what changed / breaking / migration notes.

## 2026-07-13 — tiptop-e1.1-identity-model (E1.1)

- **Identity block (plan §4):** 6 models — `users`, `cities`, `cleaner_profiles`, `cleaner_legal_profiles`, `verification_applications`, `properties` — + 8 enums, migration `20260713145632_identity_block` (applied to Neon). Money integer fenings (`hourly_rate_f`, D5); `engagement_model` enum default `marketplace` (D19 seam, values only); `locale` is a plain string mirroring `i18n/routing.ts` (no enum). `cleaner_legal_profiles.cleaner_id` FKs `users` directly per the §4 ERD.
- **Deferred by design:** `cleaner_services` join lands in E1.2 with `service_types` (would be a dangling FK today). `jmbg_encrypted` is an opaque column — AES-GCM writer is E7. `cleaner_legal_profiles`/`verification_applications` start empty (no legacy source; populated by E7.4/E9.3).
- **Firestore backfill:** `adminFirestore()` added to the lazy firebase-admin singleton (reads only — D3 tombstone unaffected). Pure mappers in `lib/server/backfill/mapIdentity.ts` (role `provider`→`cleaner`, KM→fenings, city slugify incl. č/ć/đ, doc→create-input shapes); I/O adapter `scripts/backfill-identity.mjs` (`npm run db:backfill:identity`, **dry-run by default**, `-- --commit` to write, idempotent upserts that never clobber app-owned rows).
- **Dry run reviewed against live Firestore:** 5 users → 4 mapped (1 skipped: no email), 22 provider docs → 2 profiles (matching by in-doc `uid` field rescued 18 `addDoc`-era duplicates; 2 true orphans without a `users` doc reported, not migrated), 3 addresses → 2 properties, cities Sarajevo + Čapljina. `--commit` not yet executed — operator decision.
- Dev deps: `tsx` (runs the TS mappers from the Node script). Tests: +17 unit (mappers) = 94, +3 integration (identity graph round-trip, unique constraints, referral self-relation).
- ⚠️ `prisma migrate reset` gate check not run this session (permission-gated destructive op) — run manually in review; formally due with full G1 at E1.6.

## 2026-07-12 — tiptop-e0.9-ops-baseline (E0.9)

- **Ops baseline (plan D21), documented in `docs/OPS.md` (code vs. account-needed matrix).**
- **Sentry** client+server+edge (`sentry.*.config.ts` + `instrumentation.ts`) — **inert unless `NEXT_PUBLIC_SENTRY_DSN` set**; release tagged from deploy SHA. `next.config.mjs` wraps `withSentryConfig` only when `SENTRY_AUTH_TOKEN` present. `lib/server/observability.ts` `reportError` wired into the HTTP mapper (unhandled 500 → Sentry). Verified: build passes with Sentry installed and **no DSN**.
- **`GET /api/health`** — liveness + DB ping (200 `{status,db:ok}` / 503). Live-verified. For an external uptime monitor + cron dead-man checks.
- **Backups**: `scripts/db-dump.mjs` (pg_dump → Bunny via storage API, no-op-safe without creds) + nightly `.github/workflows/backup.yml`. Neon PITR documented as the second line.
- **Staging + seed refresh**: documented (Neon branch + Vercel env; refresh via migrate deploy + seed).
- `.env.example`: Sentry + Bunny keys (all optional).
- **Deferred (needs your accounts, tracked in OPS.md):** Sentry DSN, Bunny secrets, staging deployment, uptime-monitor wiring. All code is inert/no-op until those exist — nothing blocks dev or the build.

## 2026-07-12 — tiptop-e0.10-ui-primitives (E0.10)

- **Design tokens locked (plan §20.3):** booking-status color tokens (`status.matching/active/review/done/alert/idle`) added to `tailwind.config.ts` — used only by StatusBadge/StatusTimeline.
- **Money/date formatting (D5, §12.1):** `lib/shared/format.ts` — `formatKM` (integer fenings → "57,60 KM", dot-thousands, minus for debt), `formatKMFromDecimal`, `formatDateBs`/`formatDateTimeBs` (d.M.yyyy). Pure + tested (worked examples 57,60 / 51,84 KM).
- **Booking status registry** `lib/shared/bookingStatus.ts` (status set + token map; the FSM in E3.4 reuses it).
- **Component library** `app/components/ui/` (Tailwind + Headless UI only): Button (4 variants × states), Input/Textarea/Select (label/hint/error), StatusBadge, StatusTimeline, PriceBreakdown (Airbnb collapse/expand), RatingStars (display+interactive), TagPicker, CountdownPill, Stepper, EmptyState, Toast (provider+hook), ConfirmDialog (Headless UI), BottomTabBar, PhotoUploader (presentational — offline queue is E4.9), MapView (placeholder — real map E4.6). Barrel `index.ts`.
- **`/styleguide`** dev-only route (`§20.2` living Figma) rendering every primitive in its states. **Gated in middleware** at runtime (prod → 404) — a page-level env check bakes into the static prerender and still serves; verified PROD /styleguide=404, dev=200.
- Tests: +17 (format + bookingStatus), 77 total.
- **Out-of-scope finding:** confirmed & fixed within task — the initial page-level `notFound()` guard did NOT gate a statically-prerendered route in prod (served 200); moved the gate to middleware.

## 2026-07-12 — tiptop-e0.8-test-harness (E0.8)

- **Test harness across all three layers (plan D17/§14), documented in `docs/TESTING.md`.**
- **Unit** (`vitest.config.ts`) narrowed to `tests/unit/**` — DB-free, stays the fast gate loop (63 tests).
- **Integration** (`vitest.integration.config.ts`, `tests/integration/**`): Prisma↔Postgres via `DATABASE_URL`; `npm run test:integration`. First test round-trips `FeatureFlag` + asserts the seeded launch flags (verified live against Neon). CI gained an `integration` job (Postgres 16 service container + `prisma migrate deploy`).
- **E2E** (Playwright, `tests/e2e/**`): `playwright.config.ts` boots a **production build** (no dev-compile flakiness); 4 locale-routing smoke tests, all green locally with Chromium. New `e2e.yml` workflow — nightly + on-demand only (not per-PR), uploads the HTML report.
- Scripts: `test:integration`, `test:e2e`, `test:e2e:install`. `.gitignore` for `test-results`/`playwright-report`.
- **Deviation logged:** plan named *Testcontainers*; no Docker on this machine + CI service containers are simpler, so integration uses a plain `DATABASE_URL` (Neon branch locally / service container in CI). Tests are agnostic — Testcontainers can slot in later unchanged.
- **Out-of-scope finding:** next-intl `Accept-Language` auto-detection is ON — a real browser hits `/`→`/en`, header-less clients →`/bs`. Product decision to confirm (force `bs` default vs. detect); untouched here.

## 2026-07-12 — tiptop-e0.7-api-primitives (E0.7)

- **API primitives (plan §10, §12.5, D13).** `zod` added.
- `lib/server/http.ts`: response envelope `ok(data)` / `fail(code,status,details)` → `{ data }` / `{ error: { code, details? } }`; `ApiError`; `toErrorResponse` mapping (ApiError→code, AuthError→401/403, ZodError→400 VALIDATION_ERROR, unknown→clean 500 no-leak); `handler()` wrapper.
- `lib/server/validation.ts`: `parseBody`/`parseQuery` (zod; failures become 400 via the wrapper).
- Rate limiting: pure token-bucket `lib/shared/rateLimit.ts` (`consumeToken`, clock injected) + `lib/server/rateLimit.ts` in-memory store with `RATE_LIMITS` presets. ⚠️ store is **per-instance** — swap for Redis/Postgres behind the same interface for multi-instance prod (noted in file).
- `lib/server/audit.ts`: `audit(entry)` with a pluggable sink (default = structured console log; E9 registers a Prisma sink via `setAuditSink` once the `audit_log` table exists in E1.5). Never throws into the caller. Pure `buildAuditRecord` unit-tested.
- Adopted the envelope in the two existing routes; **added per-IP rate limiting to `POST /api/auth/session`** (auth preset, live-verified: 429 after 10 rapid calls; 400 VALIDATION_ERROR on bad body).
- Test infra: aliased `server-only`/`client-only` to an empty stub in `vitest.config.ts` so server modules load in the node test env. Tests +14 (63 total).

## 2026-07-12 — tiptop-e0.6-realtime-polling (E0.6)

- **Firestore data access decommissioned (plan D3 v1.1).** `firestore.rules` deny-all tombstone + `firebase.json`. ⚠️ These rules are **not deployed** by committing them (Firebase rules deploy separately) — they record the target state. Do NOT `firebase deploy` them until the remaining client-side Firestore reads (home, become-provider, profile, navbar) are migrated to Postgres in E1/E3/E4, or the current prototype's reads break.
- **RealtimeChannel adapter**: `lib/client/useLiveChannel.ts` — polls `/live`, tracks a cursor, pauses while the tab is hidden and resumes on focus. The single seam for realtime; SSE/WebSocket later means reimplementing only this hook.
- **Endpoint skeleton**: `GET /api/bookings/:id/live?cursor=` — enforces auth (401 verified live), returns a correctly-shaped empty `LiveSnapshot`. Real status/location/messages wired in E4.5 (chat) / E4.6 (map) once the tables exist (E1.3).
- `lib/shared/realtime.ts`: shared `LiveSnapshot`/`LiveMessage`/`LiveLocation` types, poll-cadence constants, pure `resolvePollInterval` (pauses when hidden).
- Tests: +3 (49 total).

## 2026-07-12 — tiptop-e0.5-feature-flags (E0.5)

- **Feature flags (plan D12).** First Prisma model `FeatureFlag` (`feature_flags` table) + migration `20260712141839_feature_flags` (applied to Neon).
- `lib/shared/featureFlags.ts`: typed flag registry (`ALLOW_UNVERIFIED_BOOKINGS`, `CASH_PAYMENTS_ENABLED`, `LIVE_MAP_ENABLED`, `SMS_ENABLED`) + pure `resolveFlag` (precedence: **env `FLAG_<KEY>` override > DB > coded default**).
- `lib/server/featureFlags.ts`: `isEnabled(key)` (DB read is best-effort — falls back to env/default if DB unreachable, never throws) + `setFlag` upsert (admin UI in E9).
- Seeded the two launch flags in Neon (both `true`); `npm run db:seed:flags` for reproducibility.
- Tests: +16 covering precedence, bool parsing (true/false synonyms), unrecognized-value fallthrough, registry integrity (46 total).
- Migration note: first migration in the repo — run `npm run db:migrate` (or `prisma migrate deploy` in CI/prod) after pulling.

## 2026-07-12 — tiptop-e0.4-locale-routing (E0.4)

- **next-intl locale routing (plan D9).** `bs` default + `en`, path-prefixed (`/bs/*`, `/en/*`). Added `i18n/{routing,navigation,request}.ts`, `messages/{bs,en}.json` (scaffold namespaces: Nav/Common/Auth/Home — full string extraction is E11), and the next-intl plugin in `next.config.mjs`.
- **Route groups**: every page moved under `app/[locale]/` into `(public)` (home, aboutUs, faq, usluge, login, signUp), `(app)` (book-service, become-provider, upload-image, profile), `(admin)` (admin stub, gated by `requireRole('admin')`). Root `app/layout.tsx` reduced to a passthrough; real `<html lang>` + providers + Nav/Footer now in `app/[locale]/layout.tsx` with `generateStaticParams` + `setRequestLocale`.
- **`Profile/` → `profile/`** — normalized the folder casing, fixing the E0.3 finding where `router.push('/profile/...')` (lowercase) didn't match the `Profile` folder (breaks on Vercel/Linux).
- **Middleware composed**: auth gate (cookie-presence) now strips the locale prefix before the access check and re-adds it on redirect (`/en/admin` → `/en/login?next=…`), then delegates to next-intl. New pure `stripLocalePrefix` helper in `lib/shared/access.ts` (unit-tested).
- **Locale-aware navigation**: all internal `Link` + `useRouter`/`usePathname` swapped from `next/*` to `@/i18n/navigation` (keeps active locale on navigation); `useParams` stays on `next/navigation`. NavBar labels now use `useTranslations('Nav')`; added `LocaleSwitcher` (desktop + mobile).
- Tests: +7 for `stripLocalePrefix` (30 total). Live-verified: `/`→`/bs`, `/bs` & `/en` render, locale-prefixed auth redirects, nav labels differ by locale (Usluge/Services).
- **Follow-ups (out of scope, noted below):** page bodies still contain hardcoded bs/en strings (E11 does the full extraction); `/help` and `/settings` links still point to non-existent routes (pre-existing).

## 2026-07-12 — tiptop-e0.3-session-auth (E0.3)

- **Server-side session auth (plan D4).** `firebase-admin` added with a **lazy singleton** (`lib/server/firebaseAdmin.ts`) that never initializes at import — `next build`/CI need no credentials; it reads `FIREBASE_SERVICE_ACCOUNT_JSON` (inline) or `FIREBASE_SERVICE_ACCOUNT_PATH` (file) only on first use.
- `POST /api/auth/session` exchanges a Firebase ID token for an httpOnly `__session` cookie (`Secure` in prod, `SameSite=Lax`, 5-day); `DELETE` clears it. Node runtime.
- `lib/server/auth/session.ts`: `createSessionCookie`, `verifySession` (checkRevoked), `getSessionUser`, `requireSession`/`requireRole` guards + `AuthError`. `lib/server/auth/claims.ts`: `setUserClaims(uid, {role, verified})` — single authoritative claims writer (used by E9 verification pipeline later).
- **`middleware.ts` rewritten**: gates protected prefixes on `__session` cookie *presence* only (Edge can't verify — crypto verification is Node-only in the server guards); redirects anon → `/login?next=`. Removed the old `auth.currentUser`/`user.role` code that never worked and pulled the whole Firebase client SDK into the edge bundle (**middleware 154kB → 27kB**).
- Access model extracted to pure `lib/shared/access.ts` (`resolveAccess`, `isProtectedPath`, `SESSION_COOKIE`, `AppRole`) so middleware logic is unit-tested without a running server.
- Client wiring: `utils/session.ts` (`startSession`/`endSession`); login + signup now establish the cookie after Firebase sign-in (login honors `?next=`); NavBar logout clears it.
- Tests: `tests/unit/access.spec.ts` (14) — path matching + redirect logic. Live-verified: endpoint 400/401/200, middleware 307 redirect, admin SDK initializes from the real service account and rejects a bogus cookie.
- **Follow-up for E0.4:** custom claims are set by `setUserClaims` but no signup path assigns a role yet (defaults to `customer` in `verifySession`); role assignment on registration lands with the role-choice UI in E0.4/E1.

## 2026-07-12 — tiptop-e0.2-prisma-ci (E0.2)

- **Prisma 6 initialized** against Neon Postgres (EU Frankfurt): `prisma/schema.prisma` (datasource w/ pooled `DATABASE_URL` + `DIRECT_URL` for migrations, no models yet — E1), `lib/server/db.ts` client singleton, `npm run db:ping` connectivity check (verified live: PostgreSQL 18.4).
- **CI pipeline** `.github/workflows/ci.yml`: lint → typecheck → vitest → build on PRs and master pushes (dummy Firebase env for prerender). Proves itself on first push.
- **Vitest** wired (`npm run test`); first guard test: `.env.example` must document every required env key.
- **Typecheck now 0 errors** — fixed all 8 pre-existing: missing `query`/`where` imports + dead `fillDummyData` button (become-provider), `Transition as="div"` for Headless UI v2 (NavBar), `Availability` index signature (Profile/[id]), removed impossible `user.role` check in middleware (TODO E0.3), deduped `background` key (tailwind.config), escaped apostrophe (login — was the only lint *error*).
- New scripts: `typecheck`, `test`, `db:ping`, `db:migrate`, `db:studio`, `postinstall` (prisma generate). Prisma CLI reads `.env`, so db scripts wrap with `dotenv -e .env.local`.
- First successful `next build` of the repo (12 routes).

## 2026-07-12 — tiptop-e0.1-repo-hygiene (E0.1)

- Removed whitespace-only `next.config.js` that shadowed `next.config.mjs` (the real config never loaded).
- Consolidated the two conflicting `ServiceProvider` interfaces into `lib/shared/types.ts` (canonical shape = what `become-provider` actually writes to Firestore `providers/{uid}`); deleted `app/models/` entirely (`Profile.ts` was dead code, `User.ts` variant used stale `name/surname` fields).
- Renamed typo route `app/uplaodImage` → `app/upload-image` (no inbound references existed).
- Added `.env.example` (Firebase web keys; full env list in plan §16).
- Tagged `archive/main` locally — the diverged `main` branch is retired; `master` is canonical. Remote branch deletion pending push access.
- Known pre-existing `tsc` errors left for E0.2 (CI task — typecheck must go green there): missing `query`/`where` imports + dead `fillDummyData` call in `become-provider`, Headless UI v2 `Transition className` in `NavBar`, local `Availability` index-signature in `Profile/[id]`, `user.role` in `middleware.ts` (properly fixed in E0.3), duplicate key in `tailwind.config.ts`.

## 2026-07-12 — master (docs)

- `docs/TECHNICAL_PLAN.md` v1.1: full architecture, decision log D1–D22, data model, work plan E0–E12 with verification gates, UX/UI working plan, Batmaid-trio growth path (§21).
- `CLAUDE.md`: session guardrails (integer fenings, server-authoritative writes, Firebase = Auth+FCM only, next-intl, Tailwind+Headless UI only, gate ritual).

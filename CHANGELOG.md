# Changelog

One entry per merged PR. Newest first. Format: `## <date> — <branch>` then what changed / breaking / migration notes.

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

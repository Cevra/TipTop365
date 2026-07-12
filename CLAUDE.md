# TipTop365 — Claude Code instructions

Two-sided cleaning marketplace for Bosnia ("Uber for cleaning"). Next.js 14 App Router + TS + Tailwind + Firebase Auth, Postgres/Prisma system of record.

**The build is governed by `docs/TECHNICAL_PLAN.md`.** Work one task ID (§13) at a time; read only the plan sections the kickoff prompt names. Decisions D1–D18 (§2) are binding — if a change contradicts one, stop and say so instead of improvising; new decisions get appended to §2 with a new D-number, never silently.

## Hard guardrails

- **Money is integer fenings** (1 KM = 100 f). Never float, never client-computed. Ledger postings are append-only, idempotency-keyed, balanced (Σdebit = Σcredit per tx).
- **Server-authoritative writes.** Firebase = Auth + FCM push ONLY — no Firestore data access in new code (D3 v1.1). Realtime = polling `GET /api/bookings/:id/live` behind the `RealtimeChannel` adapter. All API input zod-validated.
- **`engagement_model` stays `marketplace`.** The payroll-service and employed tiers (plan §21) are schema seams only — do not implement them unless the task explicitly says so.
- **No new UI libraries.** Tailwind + Headless UI only; don't add MUI/styled-components/flowbite usage to new code.
- **All user-facing strings via next-intl** (`messages/bs.json` + `messages/en.json`, keys in parity). Bosnian is the default locale. Prices "X,XX KM", dates `d.M.yyyy`.
- **Schema changes only via `prisma migrate`** — never edit the DB or migrations by hand.
- **Secrets stay server-side**; photo/media access only through signed short-TTL URLs from our API.
- Contract/legal templates are lawyer-owned content: build the workflow, keep the "DRAFT — requires legal review" watermark logic intact.

## Commands (established in E0; keep this list current)

```
npm run dev            # local app
npm run lint && npm run typecheck
npm run test           # vitest unit + integration
npm run test:e2e       # playwright (gates only, not per-edit)
npx prisma migrate dev / npx prisma db seed / npx prisma studio
```

## Workflow

- Branch per task: `tiptop-<epic.task>-<slug>` off `master` (canonical branch; `main` is dead). Conventional commits. Do not push unless asked.
- Definition of done: task acceptance (§13) + epic gate commands (§18) green + `CHANGELOG.md` entry + tick `✅ <date>` on the §13 task row.
- Feedback loop = unit tests, not the dev server/browser.
- Out-of-scope findings go in the end-of-session summary, not into the diff.
- End every session: run gate commands → CHANGELOG → tick §13 → one-paragraph summary → stop.

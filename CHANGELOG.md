# Changelog

One entry per merged PR. Newest first. Format: `## <date> — <branch>` then what changed / breaking / migration notes.

## 2026-07-15 — tiptop-e7.3-day-limits (E7.3)

- **Day-limit domain `lib/domain/dayLimits/` (plan §8.1/§8.3) — pure, statutory numbers pinned by test:** FBiH 60 / student 180 (+ ≤2 contracts/yr) / RS 90 / Brčko 60 (admin-overridable) / obrt unlimited (self-billing path). `usedDays` counts DISTINCT days (multi-visit day = 1), `evaluateDayLimit` → 80 % warn / 100 % block + remaining days, `wouldConsumeDay` for acceptance pre-checks. ⚠ Regulatory numbers carry the same "verify with accountant/lawyer" watermark as the contract layer.
- `lib/server/dayLimits.ts`: `recordWorkDay` (idempotent via the DB unique — second same-day visit returns `counted: false`), `checkDayLimit`. **Regime-switch semantics (documented decision):** all engaged days that year count against the CURRENT regime's limit — a mid-year paperwork change never resets days worked. Wiring into offer visibility/acceptance + the warning job is E7.5, per the task split.
- Tests: +9 unit (191 total — statutory table, unique-day + year boundary, all thresholds incl. Brčko override, student contract cap, obrt unlimited), +1 integration (DB idempotency + regime-switch readout).

## 2026-07-15 — tiptop-e5.2-fsm-postings (E5.2)

- **FSM side effects → §7 postings.** `lib/server/bookings/effects.ts` executes the descriptors after the status transaction commits: `ledger.release` (card: escrow→wallet + escrow→revenue; cash: the §7 commission-debt row instead), `ledger.refund` (route-computed refund escrow→cash + kept penalty escrow→revenue; skipped for cash — nothing was captured), `rematch` (re-broadcasts offers on cleaner cancel), `payout_freeze` (correctly nothing — release simply never fires while disputed). `ledger.partial` deliberately deferred to E5.6 (needs `resolution_amount_f`).
- Confirm endpoint posts the §7 **capture** row keyed on the payment id; cancel passes its computed `refundF` through the new `effectCtx`. **The single `release:<bookingId>` idempotency key makes double-payment structurally impossible** — dispute-release after a normal release replays as a no-op.
- Tests: +4 integration (confirm/cancel/FSM suites regress green) — release balances to the fening, cash commission debt, refund+kept split, dispute freeze-then-release exactly once.

## 2026-07-15 — tiptop-e5.1-ledger-engine (E5.1)

- **Posting engine (plan §7) — the escrow ledger's core, test-first.** Pure layer `lib/domain/ledger/`: `accounts.ts` (the five §7 account types with real double-entry **normal balance sides** — payable grows on credit, receivable on debit, so §7's `net = payable − receivable` reads straight off materialized balances; unknown types throw, D19 growth = extend the map) and `postings.ts` (one balanced-by-construction plan builder per §7 posting-map row: capture, release card/cash, refund+kept-penalty, topup, payout; `validatePlan` enforces positive-integer amounts and Σdebit=Σcredit — the invariants Prisma's DSL can't).
- **`lib/server/ledger/engine.ts` `post(plan)`:** idempotent replay on the unique key (multi-entry plans replay atomically via derived `key#i`), entries + atomic balance increments in one transaction. **Finding:** account get-or-create must live OUTSIDE the posting tx — in Postgres a caught unique-violation still aborts the enclosing transaction (Prisma exposes no savepoints), so the create-race recovery deadlocked the first implementation; pre-created identity rows are harmless on rollback.
- **Money-policy note (flagged, not invented):** §7's "late-cancel penalty split cleaner/revenue per config" has no config column yet — the kept penalty conservatively books to `platform_revenue` as an `adjustment`; compensating the cleaner later is an explicit adjustment posting once the split is decided. Never invents a payout.
- Tests: +10 unit (182 total — every §7 row's accounts/amounts/kinds, validation invariants), +8 integration (capture→release drains escrow to the fening, replay no-ops single+multi-entry, cash commission debt + negative net, refund/kept split, same-key race → exactly one applies, parallel different postings lose nothing, Σ-per-tx + positive-integer invariant over everything written).

## 2026-07-15 — tiptop-e3.10-recurring-generator (E3.10)

- **Recurring plans materializer (§5 note: daily job, 14 days ahead, one `bookings` row per occurrence).** Pure `lib/domain/recurring.ts` (`nextRunDate` — monthly clamps Jan 31 → Feb 28 instead of skipping into March; `isDue` horizon check) + `lib/server/bookings/generateRecurring.ts`: due plans get a draft (server-repriced range ceiling with the recurring discount, addon template snapshotted), plan advances only after a successful occurrence — **idempotent two ways** ((plan, scheduledAt) existence check + forward-only nextRunDate), incomplete properties are reported and never advanced past, per-plan hop cap guards corrupt dates.
- `POST /api/jobs/generate-recurring` (Vercel Cron daily, same `CRON_SECRET` auth as expire-offers).
- Tests: +4 unit (172 total — date math incl. month-clamp + year rollover, horizon edges), +2 integration (69 total — materialize + advance + discount math + double-run no-op; incomplete property reported, plan frozen).

## 2026-07-15 — tiptop-e3.8-cancellation (E3.8)

- **Cancellation with config rules + refund calc (§6 tiers, mock refunds).** Pure `lib/domain/cancellation.ts`: `parseCancellationRules` (zod, loud on malformed admin jsonb), `resolveRefundPct` (most generous applicable timed rule wins; no-show resolved by its own flag per the §5 admin-determination note), `computeRefundF` (integer fenings).
- **`POST /api/bookings/:id/cancel`:** `matching` cancels free (§5 edge annotation — 100 % regardless of timing); `accepted` uses the **snapshotted config version's** tiers by hours-before-slot. FSM `customer_cancelled` records `refundPct/refundF` on the event + reason on the booking; card refunds go through the PaymentProvider (idempotency key `refund:<bookingId>`) and land as `payments` rows — §7 ledger postings arrive with E5. Cash has nothing captured to refund.
- Tests: +7 unit (168 total), +3 integration (free matching cancel, 100/50 % tiers with exact fening amounts + refund payment rows, non-cancellable/foreign rejections).

## 2026-07-15 — tiptop-e3.6-broadcast-matching (E3.6)

- **Broadcast matching (§3 step 5, first-accept wins).** `lib/server/bookings/broadcast.ts`: `broadcastOffers` (same eligibility rules as search — city/service/verified/radius; idempotent per cleaner; offers expire at slot − 6 h per §5), `acceptOffer` (**race decided by the FSM's status-guarded update** — G3's concurrency test proves exactly one winner; winner is exact-repriced from their rate against the **snapshotted** config version, always ≤ the draft ceiling; siblings flip `lost_race`), `expireMatching` (stale offers → `expired`; stuck matchings → the `offers_expired` FSM edge).
- Routes: `GET /api/offers` (inbox for E4.2 — address withheld per H5 privacy), `POST /api/offers/:id/accept|decline`, `POST /api/jobs/expire-offers` (Vercel Cron, `CRON_SECRET` bearer auth via new `lib/server/jobs.ts`; jobs fail loudly 503 when unset). Confirm endpoint now best-effort dispatches offers on entering matching (failure never undoes a successful payment).
- Tests: +4 integration incl. the G3 race (parallel accepts → exactly 1 winner) and the expiry job end-to-end. (This entry was restored in the E3.8 commit — a shell-quoting bug dropped it from the E3.6 commit itself.)

## 2026-07-15 — tiptop-e3.2-booking-wizard (E3.2)

- **Booking wizard steps 1–3 (§11/H1), rebuilt over `book-service`** — the legacy direct-to-Firestore form is gone (D3). Property step (cards from `/api/properties`, incomplete properties flagged not bookable), service+addons step (multiplier badges, qty steppers for per-window/per-hour), date/slot/recurring step (discount badges from live config). Sticky bottom bar with the live `useQuote` range re-quote; **prototype v2 feedback applied: back button in the header, overflow-safe totals.** New `Wizard` i18n namespace (bs/en parity).
- **`POST /api/bookings`** — creates the draft server-side with a from-scratch reprice (§6). **Scope decision: pre-cleaner drafts store the range-maximum as a provisional ceiling** (schema money columns are non-null; the ceiling is the only number that can't surprise the customer upward) with `pricing_snapshot.kind='range'` carrying both bounds — the exact reprice lands when a cleaner is attached (E3.6 accept / direct select). Recurring choice creates + links the `recurring_plans` row (template addons included; generator = E3.10). Addon rows snapshot hours/price; human-readable `TT-XXXXXX` codes with collision retry. `GET /api/bookings` list included for E3.9.
- ⚠️ Open plan gap flagged: §5 sequences payment before matching, but §6 prices from the cleaner's rate — what exactly a broadcast booking captures at confirm (ceiling vs. fixed platform price) needs a product decision before E3.6 wires accept-time repricing into confirm.
- Tests: +3 integration (60 total) — ceiling reprice with exact §6 numbers, recurring plan linkage + discounted totals, incomplete/past/foreign rejections.

## 2026-07-14 — tiptop-e3.3-cleaner-search (E3.3)

- **Cleaner search & ranking (plan §3 step 5).** Pure comparator `lib/domain/cleanerRanking.ts` — §13 order verified → rating desc → distance asc (haversine) → price asc, with missing data always ranking below known data within a criterion (unrated under rated, unknown distance last — never interleaved by accident). `withinServiceRadius` assumes in-range when coordinates/radius are missing (legacy roster data is sparse; excluding on missing data would hide it).
- **`GET /api/cleaners/search?city=&serviceType=&lat=&lng=`** — public (guests browse, §2), rate-limited (new `search` preset). Airbnb service types force verified-only; `ALLOW_UNVERIFIED_BOOKINGS=false` (D12 flag) does too. Response carries `broadcastAvailable` for the H2 "prvi slobodan" pinned card (the broadcast mechanics are E3.6). **Anti-disintermediation (§12.4): payload has first name + last initial only, no contact fields** — asserted by test.
- Tests: +9 unit (161 total — comparator laws, haversine sanity, radius edge cases), +5 integration (62 total — seed-roster ranking with no tier interleaving, Airbnb verified-only, flag override via env, city scoping, validation).

## 2026-07-14 — tiptop-e3.5-mock-provider (E3.5)

- **`PaymentProvider` interface (D6, `lib/server/payments/provider.ts`):** Stripe-shaped — `capture/refund/void/tokenize/verifyWebhook`, integer fenings, idempotency-keyed. Registry behind `PAYMENT_PROVIDER` env (default `mock`); Monri (E6) slots in without touching anything above the interface.
- **`MockProvider`:** deterministic, dependency-free; magic tokens simulate declines (`tok_declined`, `tok_3ds_fail`) so E2E can drive failure paths without a PSP sandbox; replay-safe idempotency cache (same key → same result, like a real PSP — even for declines); sha256 webhook signature convention.
- **`POST /api/bookings/:id/confirm` (§10):** contract e-accept (stub per task row — the FSM edge + event meta are what E7.2 keeps; the PDF layer arrives there) → D7 immediate capture → `payment_secured` → `matching`. **Scope decision:** a declined card returns 402 `PAYMENT_DECLINED` and leaves the booking in `pending_payment` for retry (per-attempt idempotency keys so retries aren't swallowed by the replay cache) — §5's `payment_failed`/`payment_abandoned` edges belong to the 1 h abandonment job (E5.4), not first declines. Cash bookings are `CASH_PAYMENTS_ENABLED`-gated and skip capture ("cash allowed", §5).
- Tests: +6 unit (152 total — provider idempotency, magic tokens, webhook verify, tokenize, registry), +5 integration (card happy path with event trail, decline→retry, cash path, ownership + acceptance guards, past-payment 409).

## 2026-07-14 — tiptop-e3.4-booking-fsm (E3.4)

- **Booking FSM `lib/domain/bookingFsm/` (plan §5) — the transition table is a 1:1 transcription of the §5 diagram + notes: 20 edges, no invented states.** `transition(from, action, actor)` throws typed `IllegalTransitionError` / `WrongActorError` (admin is NOT a wildcard — only its §5 edges: no-show, dispute resolution); `actionsFor(status, actor)` drives which buttons screens render; side effects are **descriptors** (`ledger.release/refund/partial`, `payout_freeze`, `rematch`, `purge_prejob_photos`) returned to the caller — E5/E3.6/E12.1 register executors later, nothing is silently half-implemented.
- **`lib/server/bookings/applyTransition.ts`:** status update + append-only `booking_events` row in one transaction, **race-safe via status-guarded `updateMany`** — two competing transitions → exactly one wins, loser gets 409 (`BOOKING_STATE_CHANGED`), proven by a concurrency test. Cancelling edges persist `cancelled_by` + reason on the booking; FSM violations map to stable API codes (409 `ILLEGAL_TRANSITION`, 403 `FORBIDDEN_ACTOR`).
- Table-integrity tests pin the edge count (20) and graph reachability from `draft`, so any future edge change is a visible diff, not drift. Happy path, auto-confirm twin, dispute resolutions, re-matching on cleaner cancel, no-show scoping, and 8 illegal-transition cases all asserted.
- Tests: +21 unit (146 total), +4 integration (47 total) incl. gapless event-chain assertion (each `from_status` = previous `to_status`) and GPS meta on the check-in event.

## 2026-07-14 — tiptop-e3.1-properties-crud (E3.1)

- **Properties CRUD (plan §3 hosts):** `GET/POST /api/properties`, `GET/PATCH/DELETE /api/properties/:id` — all owner-scoped from the verified session (foreign ids 404, no existence oracle); zod schemas in `lib/server/properties.ts` incl. the turnover `checklist` shape (linens/restock[]/damageReport). DELETE pre-checks bookings → 409 `PROPERTY_IN_USE`, with a duck-typed FK backstop (**finding:** Prisma 6 surfaces `ON DELETE RESTRICT` violations as `PrismaClientUnknownRequestError` with raw PG code 23001, NOT `P2003` — `isForeignKeyViolation` handles both).
- **`lib/server/users.ts` `requireDbUser`:** bridges a verified Firebase session to the Postgres `users` row, provisioning it on first authenticated API use (legacy accounts predate the backfill `--commit`); role from the verified custom claim. `SessionClaims` now carries `email` from the token for exactly this.
- **`/properties` UI** (`(app)` route group, added to `PROTECTED_PREFIXES`): list/create/edit/delete built entirely from E0.10 primitives (Input/Select/Textarea/Button/EmptyState/ConfirmDialog/Toast), checklist editor (restock chips) shown for vacation rentals / Airbnb-flagged properties, new `Properties` i18n namespace (bs/en parity, 39 keys).
- Tests: +6 integration (44 total) — session mocked at the cookie-verification seam only (needs live Firebase); user provisioning, owner scoping, partial PATCH validation, checklist round-trip, delete + 409-in-use are all real DB.

## 2026-07-14 — tiptop-e2.4-rate-bounds (E2.4)

- **Cleaner-rate bounds enforcement + hint UI (plan §6 "min/max from city cfg").** Pure helpers `lib/domain/pricing/rateBounds.ts` (`isRateWithinBounds` inclusive integer-fening check, `rateBoundsHint` → "8,00 KM–15,00 KM", `kmInputToFenings`).
- `become-provider` rate field now validates against the **live city bounds** from `GET /api/catalog` (replaces the hardcoded 1–100 BAM check) with a visible allowed-range hint + HTML min/max; falls back to the legacy sanity check if the catalog is unreachable — the pricing engine remains the server-side backstop (out-of-bounds rate throws at quote/booking, E2.1). Strings stay hardcoded-bs like the rest of this legacy page (full extraction is E11; page rebuild is E4.1).
- Tests: +4 unit (125 total).

## 2026-07-14 — tiptop-e2.2-quote-endpoint (E2.2)

- **`POST /api/pricing/quote` (§10)** — public, server-computed only (§6: client prices never trusted), per-IP rate-limited (quote preset). With `rateF` (chosen cleaner) → exact `PricingSnapshot`; without → **min–max range** from the city's rate bounds (scope decision: pre-selection/broadcast quotes can't know the cleaner's rate, and the config has no "default rate" — a range is honest and §6-faithful). Stable error codes: `CITY_NOT_FOUND`/`SERVICE_TYPE_NOT_FOUND`/`ADDON_NOT_FOUND`/`QUOTE_INVALID`; broken admin jsonb → 500 `PRICING_CONFIG_INVALID` (never NaN money).
- **`GET /api/catalog?city=`** (§10, same API-surface group) — active services + addons (bilingual names) + public pricing subset (rate bounds, fee %, discounts, cash fee, version). Feeds the wizard (E3.2), quote UI and E2.4.
- **`QuoteBreakdown`** client component (`app/components/quote/`) reusing the E0.10 `PriceBreakdown` primitive — exact mode = Airbnb-style expandable breakdown, range mode = "od X do Y KM" summary; new `Quote` i18n namespace (bs/en parity). Debounced `useQuote` hook (`lib/client/`). `lib/server/requestIp.ts` extracted for reuse.
- Tests: +9 integration (37 total) — §6 worked example through the HTTP layer, range math from seed bounds, cash+recurring composition, error codes, per-IP rate limiting (fast no-DB requests so the token bucket can't refill mid-test).

## 2026-07-14 — tiptop-e2.1-pricing-engine (E2.1)

- **Pricing engine `lib/domain/pricing/` (plan §6) — pure, zero I/O, test-first.** `config.ts` (zod-parses the admin-edited `pricing_configs` jsonb into a typed shape; malformed config throws `PricingConfigError` instead of producing NaN money), `estimateHours.ts` (§6 band lookup + beyond-band extrapolation per started 40 m², multiplier-before-addons order, `roundToQuarter` half-up), `price.ts` (integer-fenings D5 math; out-of-bounds cleaner rate **throws** — never silently clamps; E2.4 owns UI enforcement), `snapshot.ts` (`buildQuote` → the full `PricingSnapshot` trace that E2.2 returns and bookings store).
- **§6 worked examples are canonical fixtures:** 75 m² standard + oven @ 12 KM/h → 4.0 h, 4 800 + 960 = 5 760 f (`"57,60 KM"` via `formatKM`); weekly −10 % → 4 320 + 864 = 5 184 f (`"51,84 KM"`).
- **Property tests (fast-check, new devDependency; §13 E2.1 requirement):** breakdown sums to total, no negative/non-integer money, discount ≤ cleaner amount, hours monotone in m², card ≤ cash, recurring never raises the price — 500 randomized runs each.
- Tests: +20 unit (121 total; 28 integration untouched). This closes G2's automated half; the manual quote-UI check lands with E2.2.

## 2026-07-14 — bunny-key-server-side (security hotfix)

- **Removed the Bunny storage AccessKey from the client bundle.** `app/[locale]/(app)/profile/[id]/edit/page.tsx` hardcoded `BUNNY_API_KEY` and PUT/DELETEd `storage.bunnycdn.com` directly from the browser — a write credential shipped to every visitor. ⚠️ **The key is in git history: rotate the storage-zone password in the Bunny dashboard** (Storage → tiptop-storage → FTP & API Access), then update `BUNNY_STORAGE_PASSWORD` in `.env.local`, Vercel, and the backup workflow secret.
- New `POST /api/profile/image` (multipart `file` + optional `previousUrl`): auth (session cookie, with Bearer ID-token fallback until legacy pages call `startSession`), per-uid rate limit (new `upload` preset), image-only ≤5 MB, best-effort delete of the replaced avatar — only inside the caller's own `profile-images/<uid>/` folder (path-traversal / foreign-key deletes rejected, unit-tested).
- First cut of the **`StorageProvider` interface (plan §1.1)** in `lib/server/storage/` with a Bunny implementation reading `BUNNY_STORAGE_ZONE/PASSWORD/HOST` (same contract as `scripts/db-dump.mjs`) + new `BUNNY_CDN_HOST` (.env.example) for public URLs. Lazy env read, so builds don't need credentials.
- Edit page now uploads via the API; dead `firebase/storage` imports dropped. 101 unit tests (+7).

## 2026-07-14 — tiptop-e1.6-seed (E1.6)

- **Full seed `prisma/seed.ts` per §12.7**, wired as the `prisma db seed` command (replaces flags-only seeding; subsumes it — flags still seeded first). Idempotent: stable keys everywhere (`demo-*` firebaseUids, catalog `key`, city `slug`, booking `code`), verified by double-run.
- Seeds: Sarajevo + Banja Luka; service types (standard/deep/move_out/airbnb_turnover — Airbnb requires verified) + 7 addons with §6 hours/units; **pricing config v1** (bands ≤40→2.0 h … ≤170→5.5 h + extraPer40M2, 8–15 KM/h bounds, 20 % fee, recurring {10,7,5} %, 2 KM cash fee, §7 cancellation rules); admin + 2 customers (Adnan = Airbnb host, 3 properties with turnover checklists); **6 cleaners** (verified/unverified × FBiH/student/RS/obrt, legal profiles + approved verification apps); **10 bookings** `TT-DEMO-001…010`, one per FSM status (refunded/expired excluded — they need post-E5 flows) with full §6-worked-example pricing snapshots, incl. one cash job and a dispute row on the disputed one; §7 platform wallet singletons + Mirsad's 48 KM cash-commission debt (near the −50 KM limit) with its balanced ledger entry; promo `DOBRODOSLI10`.
- **G1 checklist automated:** new `tests/integration/seed.db.spec.ts` (+5) asserts the §12.7 shape (counts, regime coverage, host properties, status spread, pricing v1, near-limit wallet) — runs in CI right after `prisma db seed`, so the gate's "open Prisma Studio and eyeball" step is now a red/green test. 94 unit / 28 integration total.
- README: seed instructions + demo-account table (fake `demo-*` Firebase UIDs; real login linking is E11.3).
- New npm script `db:seed` (dotenv wrapper). `db:seed:flags` retained for the minimal case.
- Correction to the E1.5 entry below: the migration folder is `20260713221830_legal_media_ops_block` (date-stamped by Prisma), not `20260714_…` as written.

## 2026-07-14 — tiptop-e1.5-legal-media-ops (E1.5)

- **Legal/media/ops block (plan §4/§8/§9):** 13 models — `contract_templates`, `contracts`, `day_limit_entries`, `consents`, `deletion_requests`, `photos`, `reviews`, `disputes`, `notifications`, `promo_codes`, `promo_redemptions`, `audit_log`, `analytics_events` — + 9 enums. Migration `20260713221830_legal_media_ops_block` (applied to Neon). **Completes the §4 inventory except `location_pings` (E4.6).**
- `ContractTemplateRegime` is a separate enum from `LegalRegime` (`obrt_selfbill` is a template kind, not a residence regime); template `key` plain string per D19. `contracts.booking_id` unique (one per booking), `template_version` snapshot int (same pattern as `pricing_config_version`), `lawyer_approved` default false = the DRAFT-watermark gate.
- `day_limit_entries` unique `(cleaner_id, work_date, year)` — a multi-visit day counts once (§8.3); `year` denormalized for fast usedDays counts; FK to `cleaner_profiles` per the §4 ERD.
- `photos` carry the §9 retention machinery (`delete_after`, tombstone `deleted_at`/`delete_reason`, `enc_key_wrapped` for pre_job) with an index matching the hourly job's exact scan. `reviews` unique per `(booking, direction)`, `visible` default false (double-blind). `disputes` one per booking. `notifications` = the D10 outbox (`pending` default + `[status, createdAt]` dispatcher index).
- `audit_log` mirrors `AuditEntry` from `lib/server/audit.ts` field-for-field (E9 registers the sink); `analytics_events.user_id` is a **plain string, no FK** — events survive user deletion/anonymization (§8.5). `deletion_requests.status` plain string (E12.2 owns the vocabulary, same precedent as `payments.status`).
- Tests: +6 integration (`legalMediaOps.db.spec.ts` — template versioning, one-contract-per-booking + e-acceptance, day-limit uniqueness, photo retention scan + tombstone, review direction uniqueness + dispute uniqueness, outbox defaults, promo redemption uniqueness, audit-record shape mapping, consent/deletion/analytics). 94 unit / 23 integration total.

## 2026-07-13 — tiptop-e1.4-money-block (E1.4)

- **Money block (plan §4/§7):** `wallet_accounts`, `ledger_entries` (append-only, no `updated_at` — corrections are new `adjustment` postings), `payments`, `payout_runs`, `payouts` + 5 enums. Migration `20260713155847_money_block` (applied to Neon). Schema only — the posting engine with balanced-tx/idempotent-replay behavior is E5.1.
- **Decision-log conflict resolved in D19's favor:** §4 sketches `wallet_accounts.owner_type` as an enum, but binding D19 says ledger account types are **generic strings** (so payroll_service/employed bolt on without money-table migrations) — and §7's authoritative account names (`platform_cash`, `platform_revenue`, `customer_escrow`, `cleaner_payable`, `cleaner_receivable`) don't match §4's enum values anyway. Implemented as `String` with §7's vocabulary documented in the schema.
- `ledger_entries.idempotency_key` unique at the DB level (webhook-replay safety, §7); `@@unique(owner_type, owner_id)` on wallets (⚠️ Postgres NULL-distinct: singleton platform accounts are bootstrap-created in E5.1/E1.6, not concurrent-upserted — noted in schema). `Σdebit=Σcredit per tx_id` and `amount_f > 0` cannot be expressed in Prisma DSL and hand-editing migration SQL is forbidden (CLAUDE.md) — E5.1's module + CI invariant test own them, per the plan.
- `payments.status` is a plain string (provider-specific vocabulary, owned by the D6 interface in E3.5); `payments.booking_id` nullable (top-ups have no booking); Prisma enum named `PaymentProviderKind` to avoid colliding with the future `PaymentProvider` TS interface. `payouts` composite-unique per (run, cleaner); `payout_runs.week_label` unique; `iban_snapshot` frozen at run-prep time.
- Tests: +5 integration (`money.db.spec.ts` — §7 capture posting shape, idempotency-key replay rejected, payable/receivable coexistence + duplicate-pair rejection, booking-less topup payment, payout run with per-cleaner uniqueness and linked payout posting). 94 unit / 17 integration total.

## 2026-07-13 — tiptop-e1.3-booking-block (E1.3)

- **Booking block (plan §4/§5):** 7 models — `bookings`, `booking_addons`, `booking_events`, `booking_offers`, `recurring_plans`, `price_adjustments`, `chat_messages` — + 7 enums. Migration `20260713154736_booking_block` (applied to Neon). Schema only — the FSM transition table (E3.4), pricing math (E2.1), and matching logic (E3.3/E3.6) are separate tasks.
- `BookingStatus` values are exactly the §5 state-machine diagram's states (draft → pending_payment → matching → accepted → on_my_way → in_progress → pending_completion → completed, plus disputed/refunded/cancelled/expired branches) — no invented states.
- `bookings.pricing_config_version` is a plain int snapshot, **not an FK** to `pricing_configs` — historical bookings must never repoint at a live config row (§6). `bookings.contract_id` is a plain column with no relation yet (`contracts` lands in E1.5 — same deferred-FK pattern as `cleaner_services` was for E1.1/E1.2).
- `location_pings` intentionally **not** created here — it's E4.6's table, not listed in E1.3's row despite sitting in the same §4 table-inventory section.
- Tests: +3 integration (`booking.db.spec.ts` — full graph incl. addons/events/offers/adjustment/chat, unique booking code, recurring-plan → spawned-booking link). No new unit tests (no pure logic in this task). 94 unit / 12 integration total.

## 2026-07-13 — tiptop-e1.2-catalog-block (E1.2)

- **Catalog block (plan §4):** `service_types`, `addons`, `pricing_configs` (versioned) + the `cleaner_services` join deferred from E1.1. Migration `20260713152538_catalog_block` (applied to Neon).
- `service_types`/`addons`.`key` are plain unique strings, not enums — the section is explicitly "admin-editable, no hardcoding" (§4); only `addons.unit` (fixed/per_window/per_hour/per_m2) is a Prisma enum since the pricing engine (E2.1) branches on it structurally.
- `pricing_configs`: `m2_bands`/`recurring_discount_pct`/`cancellation_rules` as jsonb per the §5/§6 shapes; `rate_min_f`/`rate_max_f`/`cash_fee_f`/`negative_balance_limit_f` integer fenings (D5); `platform_fee_pct` plain Float (a rate, not a money amount). `@@unique([cityId, version])` guards duplicate versions — "exactly one active version per city" is left to E2.3's admin publish flow, not a DB constraint (would need a Postgres partial index outside Prisma's schema DSL; not worth it for a single-admin MVP).
- `cleaner_services`: many-to-many `cleaner_profiles` ↔ `service_types`, composite-unique on the pair.
- Tests: +4 integration (`catalog.db.spec.ts` — service/addon uniqueness, cleaner↔service-type linking, versioned pricing config incl. duplicate-version rejection). No new unit tests — no pure mapping/business logic in this task (that's E2.1); 94 unit / 9 integration total.

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

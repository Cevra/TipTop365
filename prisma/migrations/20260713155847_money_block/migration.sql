-- CreateEnum
CREATE TYPE "LedgerEntryKind" AS ENUM ('charge', 'capture', 'release', 'fee', 'refund', 'cash_commission', 'topup', 'payout', 'adjustment', 'dispute_hold', 'dispute_release');

-- CreateEnum
CREATE TYPE "PaymentProviderKind" AS ENUM ('mock', 'monri', 'wspay');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('auth', 'capture', 'refund', 'void', 'topup');

-- CreateEnum
CREATE TYPE "PayoutRunStatus" AS ENUM ('draft', 'exported', 'paid');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('pending', 'paid', 'failed');

-- CreateTable
CREATE TABLE "wallet_accounts" (
    "id" TEXT NOT NULL,
    "owner_type" TEXT NOT NULL,
    "owner_id" TEXT,
    "balance_f" INTEGER NOT NULL DEFAULT 0,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "tx_id" TEXT NOT NULL,
    "booking_id" TEXT,
    "payout_id" TEXT,
    "debit_account_id" TEXT NOT NULL,
    "credit_account_id" TEXT NOT NULL,
    "amount_f" INTEGER NOT NULL,
    "kind" "LedgerEntryKind" NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT,
    "provider" "PaymentProviderKind" NOT NULL,
    "provider_ref" TEXT,
    "kind" "PaymentKind" NOT NULL,
    "status" TEXT NOT NULL,
    "amount_f" INTEGER NOT NULL,
    "card_token" TEXT,
    "threeds_status" TEXT,
    "webhook_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_runs" (
    "id" TEXT NOT NULL,
    "week_label" TEXT NOT NULL,
    "status" "PayoutRunStatus" NOT NULL DEFAULT 'draft',
    "bank_file_url" TEXT,
    "totals_f" INTEGER NOT NULL DEFAULT 0,
    "executed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" TEXT NOT NULL,
    "payout_run_id" TEXT NOT NULL,
    "cleaner_id" TEXT NOT NULL,
    "amount_f" INTEGER NOT NULL,
    "iban_snapshot" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_accounts_owner_type_owner_id_key" ON "wallet_accounts"("owner_type", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_idempotency_key_key" ON "ledger_entries"("idempotency_key");

-- CreateIndex
CREATE INDEX "ledger_entries_tx_id_idx" ON "ledger_entries"("tx_id");

-- CreateIndex
CREATE INDEX "ledger_entries_booking_id_idx" ON "ledger_entries"("booking_id");

-- CreateIndex
CREATE INDEX "ledger_entries_debit_account_id_idx" ON "ledger_entries"("debit_account_id");

-- CreateIndex
CREATE INDEX "ledger_entries_credit_account_id_idx" ON "ledger_entries"("credit_account_id");

-- CreateIndex
CREATE INDEX "payments_booking_id_idx" ON "payments"("booking_id");

-- CreateIndex
CREATE INDEX "payments_provider_provider_ref_idx" ON "payments"("provider", "provider_ref");

-- CreateIndex
CREATE UNIQUE INDEX "payout_runs_week_label_key" ON "payout_runs"("week_label");

-- CreateIndex
CREATE INDEX "payouts_cleaner_id_idx" ON "payouts"("cleaner_id");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_payout_run_id_cleaner_id_key" ON "payouts"("payout_run_id", "cleaner_id");

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_debit_account_id_fkey" FOREIGN KEY ("debit_account_id") REFERENCES "wallet_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_credit_account_id_fkey" FOREIGN KEY ("credit_account_id") REFERENCES "wallet_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_runs" ADD CONSTRAINT "payout_runs_executed_by_id_fkey" FOREIGN KEY ("executed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_payout_run_id_fkey" FOREIGN KEY ("payout_run_id") REFERENCES "payout_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "cleaner_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "AddonUnit" AS ENUM ('fixed', 'per_window', 'per_hour', 'per_m2');

-- CreateTable
CREATE TABLE "service_types" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name_bs" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "duration_multiplier" DOUBLE PRECISION NOT NULL,
    "requires_verified" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addons" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name_bs" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "unit" "AddonUnit" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaner_services" (
    "id" TEXT NOT NULL,
    "cleaner_profile_id" TEXT NOT NULL,
    "service_type_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cleaner_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_configs" (
    "id" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "m2_bands" JSONB NOT NULL,
    "rate_min_f" INTEGER NOT NULL,
    "rate_max_f" INTEGER NOT NULL,
    "platform_fee_pct" DOUBLE PRECISION NOT NULL,
    "recurring_discount_pct" JSONB NOT NULL,
    "cash_fee_f" INTEGER,
    "cancellation_rules" JSONB NOT NULL,
    "vat_mode" TEXT,
    "negative_balance_limit_f" INTEGER NOT NULL DEFAULT -5000,
    "auto_confirm_hours" INTEGER NOT NULL DEFAULT 48,
    "min_after_photos_per_room" INTEGER NOT NULL DEFAULT 2,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_types_key_key" ON "service_types"("key");

-- CreateIndex
CREATE UNIQUE INDEX "addons_key_key" ON "addons"("key");

-- CreateIndex
CREATE UNIQUE INDEX "cleaner_services_cleaner_profile_id_service_type_id_key" ON "cleaner_services"("cleaner_profile_id", "service_type_id");

-- CreateIndex
CREATE INDEX "pricing_configs_city_id_active_idx" ON "pricing_configs"("city_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_configs_city_id_version_key" ON "pricing_configs"("city_id", "version");

-- AddForeignKey
ALTER TABLE "cleaner_services" ADD CONSTRAINT "cleaner_services_cleaner_profile_id_fkey" FOREIGN KEY ("cleaner_profile_id") REFERENCES "cleaner_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaner_services" ADD CONSTRAINT "cleaner_services_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_configs" ADD CONSTRAINT "pricing_configs_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

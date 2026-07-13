-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('customer', 'cleaner', 'admin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended', 'deleted');

-- CreateEnum
CREATE TYPE "CleanerTier" AS ENUM ('registered', 'verified');

-- CreateEnum
CREATE TYPE "EngagementModel" AS ENUM ('marketplace', 'payroll_service', 'employed');

-- CreateEnum
CREATE TYPE "LegalRegime" AS ENUM ('fbih', 'fbih_student', 'rs', 'brcko', 'obrt');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('applied', 'interview_scheduled', 'checklist', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "InterviewMode" AS ENUM ('video', 'in_person');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('apartment', 'house', 'office', 'vacation_rental');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "firebase_uid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'customer',
    "locale" TEXT NOT NULL DEFAULT 'bs',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "is_host" BOOLEAN NOT NULL DEFAULT false,
    "referral_code" TEXT,
    "referred_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "launch_stage" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaner_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "bio" TEXT,
    "photo_url" TEXT,
    "gender" TEXT,
    "hourly_rate_f" INTEGER,
    "city_id" TEXT,
    "service_radius_km" DOUBLE PRECISION,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "availability" JSONB,
    "tier" "CleanerTier" NOT NULL DEFAULT 'registered',
    "verified_at" TIMESTAMP(3),
    "id_checked" BOOLEAN NOT NULL DEFAULT false,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rating_avg" DOUBLE PRECISION,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "accepts_cash" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "engagement_model" "EngagementModel" NOT NULL DEFAULT 'marketplace',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cleaner_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaner_legal_profiles" (
    "id" TEXT NOT NULL,
    "cleaner_id" TEXT NOT NULL,
    "legal_regime" "LegalRegime",
    "entity_of_residence" TEXT,
    "is_student" BOOLEAN NOT NULL DEFAULT false,
    "student_proof_url" TEXT,
    "student_proof_valid_until" TIMESTAMP(3),
    "obrt_id_number" TEXT,
    "obrt_registered" BOOLEAN NOT NULL DEFAULT false,
    "jmbg_encrypted" TEXT,
    "bank_account_iban" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cleaner_legal_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_applications" (
    "id" TEXT NOT NULL,
    "cleaner_id" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'applied',
    "interview_at" TIMESTAMP(3),
    "interview_mode" "InterviewMode",
    "checklist" JSONB,
    "reviewed_by_id" TEXT,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "label" TEXT,
    "type" "PropertyType" NOT NULL DEFAULT 'apartment',
    "city_id" TEXT,
    "street" TEXT,
    "house_no" TEXT,
    "floor" TEXT,
    "has_elevator" BOOLEAN NOT NULL DEFAULT false,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "size_m2" INTEGER,
    "rooms" INTEGER,
    "bathrooms" INTEGER,
    "pets" BOOLEAN NOT NULL DEFAULT false,
    "access_notes" TEXT,
    "checklist" JSONB,
    "is_airbnb" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users"("firebase_uid");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");

-- CreateIndex
CREATE UNIQUE INDEX "cities_name_key" ON "cities"("name");

-- CreateIndex
CREATE UNIQUE INDEX "cities_slug_key" ON "cities"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "cleaner_profiles_user_id_key" ON "cleaner_profiles"("user_id");

-- CreateIndex
CREATE INDEX "cleaner_profiles_city_id_active_tier_idx" ON "cleaner_profiles"("city_id", "active", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "cleaner_legal_profiles_cleaner_id_key" ON "cleaner_legal_profiles"("cleaner_id");

-- CreateIndex
CREATE INDEX "verification_applications_status_idx" ON "verification_applications"("status");

-- CreateIndex
CREATE INDEX "verification_applications_cleaner_id_idx" ON "verification_applications"("cleaner_id");

-- CreateIndex
CREATE INDEX "properties_owner_id_idx" ON "properties"("owner_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_id_fkey" FOREIGN KEY ("referred_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaner_profiles" ADD CONSTRAINT "cleaner_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaner_profiles" ADD CONSTRAINT "cleaner_profiles_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaner_legal_profiles" ADD CONSTRAINT "cleaner_legal_profiles_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_applications" ADD CONSTRAINT "verification_applications_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_applications" ADD CONSTRAINT "verification_applications_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

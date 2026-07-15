// Seed per plan §12.7 (E1.6): admin, 2 customers (1 Airbnb host w/ 3
// properties + checklists), 6 cleaners (verified/unverified across
// FBiH/RS/student/obrt, one near the negative-balance limit), Sarajevo +
// Banja Luka, full pricing config, services/addons, promo code, 10 bookings
// across statuses, launch feature flags.
//
// Idempotent: everything is upserted on a stable key (firebaseUid `demo-*`,
// catalog `key`, city `slug`, booking `code`), so re-running is safe and
// `prisma migrate reset` + `prisma db seed` (gate G1) is deterministic.
// Demo users carry fake firebaseUids — linking real Firebase Auth logins is
// the E11.3 fresh-machine setup, not a schema concern.
//
// Runs via `prisma db seed` → `node --import tsx prisma/seed.ts` (package.json).

import { PrismaClient, type Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// --- feature flags (kept in sync with scripts/seed-flags.mjs / D12) ----------
async function seedFlags() {
  await prisma.featureFlag.upsert({
    where: { key: 'ALLOW_UNVERIFIED_BOOKINGS' },
    create: { key: 'ALLOW_UNVERIFIED_BOOKINGS', enabled: true },
    update: {},
  });
  await prisma.featureFlag.upsert({
    where: { key: 'CASH_PAYMENTS_ENABLED' },
    create: { key: 'CASH_PAYMENTS_ENABLED', enabled: true },
    update: {},
  });
}

// --- cities -------------------------------------------------------------------
async function seedCities() {
  const sarajevo = await prisma.city.upsert({
    where: { slug: 'sarajevo' },
    create: { name: 'Sarajevo', slug: 'sarajevo', launchStage: 'launch' },
    update: {},
  });
  const banjaLuka = await prisma.city.upsert({
    where: { slug: 'banja-luka' },
    create: { name: 'Banja Luka', slug: 'banja-luka', launchStage: 'next' },
    update: {},
  });
  return { sarajevo, banjaLuka };
}

// --- catalog (§4/§6 launch values — admin-editable at runtime) -----------------
async function seedCatalog() {
  const serviceTypes: Prisma.ServiceTypeCreateInput[] = [
    { key: 'standard', nameBs: 'Standardno čišćenje', nameEn: 'Standard cleaning', durationMultiplier: 1.0 },
    { key: 'deep', nameBs: 'Dubinsko čišćenje', nameEn: 'Deep cleaning', durationMultiplier: 1.6 },
    { key: 'move_out', nameBs: 'Čišćenje pri iseljenju', nameEn: 'Move-in/move-out', durationMultiplier: 1.8 },
    {
      key: 'airbnb_turnover',
      nameBs: 'Airbnb priprema',
      nameEn: 'Airbnb turnover',
      durationMultiplier: 0.9,
      requiresVerified: true,
    },
  ];
  const byKey: Record<string, string> = {};
  for (const st of serviceTypes) {
    const row = await prisma.serviceType.upsert({ where: { key: st.key }, create: st, update: {} });
    byKey[st.key] = row.id;
  }

  const addons: Prisma.AddonCreateInput[] = [
    { key: 'oven', nameBs: 'Unutrašnjost rerne', nameEn: 'Oven interior', hours: 1.0, unit: 'fixed' },
    { key: 'fridge', nameBs: 'Unutrašnjost frižidera', nameEn: 'Fridge interior', hours: 0.5, unit: 'fixed' },
    { key: 'windows', nameBs: 'Pranje prozora', nameEn: 'Window washing', hours: 0.25, unit: 'per_window' },
    { key: 'balcony', nameBs: 'Balkon/terasa', nameEn: 'Balcony/terrace', hours: 0.5, unit: 'fixed' },
    { key: 'cabinets', nameBs: 'Unutrašnjost ormara', nameEn: 'Inside cabinets', hours: 1.0, unit: 'fixed' },
    { key: 'ironing', nameBs: 'Peglanje', nameEn: 'Ironing', hours: 1.0, unit: 'per_hour' },
    { key: 'post_renovation', nameBs: 'Nakon renoviranja', nameEn: 'Post-renovation', hours: 1.0, unit: 'fixed' },
  ];
  for (const a of addons) {
    await prisma.addon.upsert({ where: { key: a.key }, create: a, update: {} });
  }
  return byKey;
}

async function seedPricingConfig(cityId: string) {
  await prisma.pricingConfig.upsert({
    where: { cityId_version: { cityId, version: 1 } },
    create: {
      cityId,
      version: 1,
      active: true,
      m2Bands: {
        bands: [
          { maxM2: 40, hours: 2.0 },
          { maxM2: 60, hours: 2.5 },
          { maxM2: 80, hours: 3.0 },
          { maxM2: 100, hours: 3.5 },
          { maxM2: 130, hours: 4.5 },
          { maxM2: 170, hours: 5.5 },
        ],
        extraPer40M2: 1.0,
      },
      rateMinF: 800, // 8 KM/h (§6 launch range)
      rateMaxF: 1500, // 15 KM/h
      platformFeePct: 20,
      recurringDiscountPct: { weekly: 10, biweekly: 7, monthly: 5 },
      cashFeeF: 200, // 2 KM cash-handling fee (§6 card incentive)
      cancellationRules: [
        { hoursBefore: 24, refundPct: 100 },
        { hoursBefore: 0, refundPct: 50 },
        { noShow: true, refundPct: 0 },
      ],
    },
    update: {},
  });
}

// --- people --------------------------------------------------------------------
async function upsertUser(
  uid: string,
  data: Omit<Prisma.UserCreateInput, 'firebaseUid'>,
): Promise<string> {
  const user = await prisma.user.upsert({
    where: { firebaseUid: `demo-${uid}` },
    create: { firebaseUid: `demo-${uid}`, ...data },
    update: {},
  });
  return user.id;
}

interface CleanerSpec {
  uid: string;
  first: string;
  last: string;
  cityId: string;
  rateF: number;
  verified: boolean;
  regime: 'fbih' | 'fbih_student' | 'rs' | 'obrt';
  services: string[]; // service_type keys
}

async function seedCleaner(spec: CleanerSpec, serviceIds: Record<string, string>) {
  const userId = await upsertUser(spec.uid, {
    email: `${spec.uid}@demo.tiptop365.ba`,
    firstName: spec.first,
    lastName: spec.last,
    role: 'cleaner',
    cleanerLegalProfile: {
      create: {
        legalRegime: spec.regime,
        isStudent: spec.regime === 'fbih_student',
        obrtRegistered: spec.regime === 'obrt',
        entityOfResidence: spec.regime === 'rs' ? 'RS' : 'FBiH',
      },
    },
  });

  const existing = await prisma.cleanerProfile.findUnique({ where: { userId } });
  const profile =
    existing ??
    (await prisma.cleanerProfile.create({
      data: {
        userId,
        bio: `${spec.first} — demo profil`,
        hourlyRateF: spec.rateF,
        cityId: spec.cityId,
        serviceRadiusKm: 10,
        languages: ['bs'],
        tier: spec.verified ? 'verified' : 'registered',
        verifiedAt: spec.verified ? new Date('2026-07-01T09:00:00Z') : null,
        idChecked: spec.verified,
        availability: { monday: [{ start: '08:00', end: '16:00' }], friday: [{ start: '08:00', end: '16:00' }] },
        services: { create: spec.services.map((key) => ({ serviceTypeId: serviceIds[key] })) },
      },
    }));

  if (spec.verified) {
    const hasApp = await prisma.verificationApplication.findFirst({ where: { cleanerId: userId } });
    if (!hasApp) {
      await prisma.verificationApplication.create({
        data: {
          cleanerId: userId,
          status: 'approved',
          interviewMode: 'video',
          checklist: { id_verified: true, references_checked: true },
        },
      });
    }
  }
  return profile.id;
}

// --- bookings -------------------------------------------------------------------
// One per FSM status (10 of 12 — refunded/expired need flows that only exist
// post-E5; G1 asks for "10 bookings across statuses"). Amounts follow the §6
// worked example (75 m² standard + oven @ 12 KM/h, 20 % fee → 57,60 KM total).
const BOOKING_STATUSES = [
  'draft',
  'pending_payment',
  'matching',
  'accepted',
  'on_my_way',
  'in_progress',
  'pending_completion',
  'completed',
  'disputed',
  'cancelled',
] as const;

async function seedBookings(args: {
  customerId: string;
  hostId: string;
  propertyIds: string[];
  hostPropertyId: string;
  cleanerProfileId: string;
  serviceIds: Record<string, string>;
}) {
  for (let i = 0; i < BOOKING_STATUSES.length; i++) {
    const status = BOOKING_STATUSES[i];
    const isHostBooking = i % 3 === 0;
    const cash = status === 'pending_completion'; // one cash job in the mix
    const withCleaner = !['draft', 'pending_payment', 'matching'].includes(status);
    await prisma.booking.upsert({
      where: { code: `TT-DEMO-${String(i + 1).padStart(3, '0')}` },
      create: {
        code: `TT-DEMO-${String(i + 1).padStart(3, '0')}`,
        customerId: isHostBooking ? args.hostId : args.customerId,
        propertyId: isHostBooking ? args.hostPropertyId : args.propertyIds[0],
        cleanerId: withCleaner ? args.cleanerProfileId : null,
        serviceTypeId: isHostBooking ? args.serviceIds.airbnb_turnover : args.serviceIds.standard,
        status,
        scheduledAt: new Date(Date.UTC(2026, 7, 1 + i, 10)),
        slotMinutes: 240,
        estHours: 4,
        cleanerRateF: 1200,
        cleanerAmountF: 4800,
        serviceFeeF: 960,
        cashFeeF: cash ? 200 : 0,
        discountF: 0,
        totalF: cash ? 5960 : 5760,
        paymentMethod: cash ? 'cash' : 'card',
        pricingSnapshot: {
          m2: 75,
          band: { maxM2: 80, hours: 3.0 },
          addons: [{ key: 'oven', hours: 1.0 }],
          estHours: 4.0,
          rateF: 1200,
          feePct: 20,
        },
        pricingConfigVersion: 1,
        matchingMode: i % 2 === 0 ? 'direct' : 'broadcast',
        engagementModel: 'marketplace',
        ...(status === 'cancelled'
          ? { cancelledBy: 'customer' as const, cancellationReason: 'Promjena termina' }
          : {}),
      },
      update: {},
    });
  }

  // The disputed booking gets its dispute row.
  const disputed = await prisma.booking.findUnique({ where: { code: 'TT-DEMO-009' } });
  if (disputed) {
    await prisma.dispute.upsert({
      where: { bookingId: disputed.id },
      create: { bookingId: disputed.id, openedById: disputed.customerId, reason: 'Kuhinja nije očišćena kako treba' },
      update: {},
    });
  }
}

// --- wallets (§7 accounts; E5.1 owns real posting flows) -------------------------
async function seedWallets(nearLimitCleanerProfileId: string) {
  for (const ownerType of ['platform_cash', 'platform_revenue', 'customer_escrow']) {
    const existing = await prisma.walletAccount.findFirst({ where: { ownerType, ownerId: null } });
    if (!existing) await prisma.walletAccount.create({ data: { ownerType } });
  }

  const revenue = await prisma.walletAccount.findFirst({ where: { ownerType: 'platform_revenue' } });
  const receivable = await prisma.walletAccount.upsert({
    where: { ownerType_ownerId: { ownerType: 'cleaner_receivable', ownerId: nearLimitCleanerProfileId } },
    // 48 KM cash-commission debt — near the −50 KM block limit (§7), so the
    // wallet UI/blocking logic has a realistic edge case to show.
    create: { ownerType: 'cleaner_receivable', ownerId: nearLimitCleanerProfileId, balanceF: 4800 },
    update: {},
  });
  await prisma.walletAccount.upsert({
    where: { ownerType_ownerId: { ownerType: 'cleaner_payable', ownerId: nearLimitCleanerProfileId } },
    create: { ownerType: 'cleaner_payable', ownerId: nearLimitCleanerProfileId, balanceF: 0 },
    update: {},
  });
  if (revenue) {
    await prisma.ledgerEntry.upsert({
      where: { idempotencyKey: 'seed:cash_commission:mirsad' },
      create: {
        txId: 'seed-tx-cash-commission-mirsad',
        debitAccountId: receivable.id,
        creditAccountId: revenue.id,
        amountF: 4800,
        kind: 'cash_commission',
        idempotencyKey: 'seed:cash_commission:mirsad',
        memo: 'Demo: nagomilana provizija za keš poslove',
      },
      update: {},
    });
  }
}

// --- main ------------------------------------------------------------------------
// E7.1: launch contract templates (5 regimes × bs/en, DRAFT-watermarked,
// lawyer_approved=false). Idempotent on (key, regime, lang, version=1);
// admin edits create NEW versions and never touch v1.
async function seedContractTemplates() {
  const { launchTemplates } = await import('../lib/domain/contracts/templates');
  for (const def of launchTemplates()) {
    await prisma.contractTemplate.upsert({
      where: {
        key_legalRegime_lang_version: {
          key: def.key,
          legalRegime: def.legalRegime,
          lang: def.lang,
          version: 1,
        },
      },
      create: { ...def, version: 1 },
      update: {},
    });
  }
}

async function main() {
  await seedFlags();
  const { sarajevo, banjaLuka } = await seedCities();
  const serviceIds = await seedCatalog();
  await seedPricingConfig(sarajevo.id);

  // Admin + customers.
  const adminId = await upsertUser('admin', {
    email: 'admin@demo.tiptop365.ba',
    firstName: 'Amar',
    lastName: 'Admin',
    role: 'admin',
  });
  void adminId;

  const customerId = await upsertUser('lejla', {
    email: 'lejla@demo.tiptop365.ba',
    firstName: 'Lejla',
    lastName: 'Kovač',
    properties: {
      create: {
        label: 'Stan',
        type: 'apartment',
        cityId: sarajevo.id,
        street: 'Ferhadija',
        houseNo: '12',
        sizeM2: 75,
        rooms: 3,
        bathrooms: 1,
      },
    },
  });

  // Airbnb host with 3 properties incl. turnover checklists (§12.7).
  const hostId = await upsertUser('adnan', {
    email: 'adnan@demo.tiptop365.ba',
    firstName: 'Adnan',
    lastName: 'Hadžić',
    isHost: true,
    properties: {
      create: [
        {
          label: 'Apartman Baščaršija',
          type: 'vacation_rental',
          cityId: sarajevo.id,
          street: 'Sarači',
          houseNo: '5',
          sizeM2: 48,
          rooms: 2,
          bathrooms: 1,
          isAirbnb: true,
          checklist: { linens: true, restock: ['kafa', 'voda', 'toalet papir'], damageReport: true },
        },
        {
          label: 'Studio Skenderija',
          type: 'vacation_rental',
          cityId: sarajevo.id,
          street: 'Terezija',
          houseNo: '18',
          sizeM2: 32,
          rooms: 1,
          bathrooms: 1,
          isAirbnb: true,
          checklist: { linens: true, restock: ['kafa'], damageReport: true },
        },
        {
          label: 'Vikendica Vlašić',
          type: 'house',
          cityId: banjaLuka.id,
          street: 'Vlašić bb',
          houseNo: '1',
          sizeM2: 110,
          rooms: 4,
          bathrooms: 2,
          isAirbnb: true,
          checklist: { linens: true, restock: ['drva za kamin'], damageReport: true },
        },
      ],
    },
  });

  // 6 cleaners: verified/unverified × FBiH/RS/student/obrt (§12.7).
  const cleanerProfiles = {
    amina: await seedCleaner(
      { uid: 'amina', first: 'Amina', last: 'Hodžić', cityId: sarajevo.id, rateF: 1200, verified: true, regime: 'fbih', services: ['standard', 'deep', 'airbnb_turnover'] },
      serviceIds,
    ),
    selma: await seedCleaner(
      { uid: 'selma', first: 'Selma', last: 'Begić', cityId: sarajevo.id, rateF: 1000, verified: true, regime: 'fbih_student', services: ['standard', 'airbnb_turnover'] },
      serviceIds,
    ),
    dragana: await seedCleaner(
      { uid: 'dragana', first: 'Dragana', last: 'Savić', cityId: banjaLuka.id, rateF: 1100, verified: true, regime: 'rs', services: ['standard', 'deep'] },
      serviceIds,
    ),
    emir: await seedCleaner(
      { uid: 'emir', first: 'Emir', last: 'Zukić', cityId: sarajevo.id, rateF: 900, verified: false, regime: 'fbih', services: ['standard'] },
      serviceIds,
    ),
    jasmin: await seedCleaner(
      { uid: 'jasmin', first: 'Jasmin', last: 'Obrtnik', cityId: sarajevo.id, rateF: 1500, verified: true, regime: 'obrt', services: ['standard', 'deep', 'move_out'] },
      serviceIds,
    ),
    mirsad: await seedCleaner(
      { uid: 'mirsad', first: 'Mirsad', last: 'Delić', cityId: sarajevo.id, rateF: 1000, verified: false, regime: 'fbih', services: ['standard', 'move_out'] },
      serviceIds,
    ),
  };

  const lejla = await prisma.user.findUniqueOrThrow({
    where: { firebaseUid: 'demo-lejla' },
    include: { properties: true },
  });
  const adnan = await prisma.user.findUniqueOrThrow({
    where: { firebaseUid: 'demo-adnan' },
    include: { properties: true },
  });

  await seedBookings({
    customerId,
    hostId,
    propertyIds: lejla.properties.map((p) => p.id),
    hostPropertyId: adnan.properties[0].id,
    cleanerProfileId: cleanerProfiles.amina,
    serviceIds,
  });

  await seedWallets(cleanerProfiles.mirsad);
  await seedContractTemplates();

  await prisma.promoCode.upsert({
    where: { code: 'DOBRODOSLI10' },
    create: { code: 'DOBRODOSLI10', type: 'pct', value: 10, maxPerUser: 1, validUntil: new Date('2026-12-31') },
    update: {},
  });

  console.log('Seed complete: cities, catalog, pricing v1, admin + 2 customers, 6 cleaners, 10 bookings, wallets, promo.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

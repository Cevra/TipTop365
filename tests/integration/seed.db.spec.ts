import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Automates gate G1's manual checklist (§18): after `prisma db seed`, the DB
// matches §12.7 — 6 cleaners, a host with 3 properties, 10 bookings across
// statuses, catalog + pricing v1. Read-only: seed data is meant to persist.
// CI seeds before running this suite; locally run `npm run db:seed` once.
const prisma = new PrismaClient();

afterAll(() => prisma.$disconnect());

describe('seed matches §12.7', () => {
  it('has admin + 2 customers + 6 cleaners under demo-* uids', async () => {
    const demoUsers = await prisma.user.findMany({
      where: { firebaseUid: { startsWith: 'demo-' } },
      include: { cleanerProfile: true, cleanerLegalProfile: true },
    });
    expect(demoUsers.filter((u) => u.role === 'admin')).toHaveLength(1);
    expect(demoUsers.filter((u) => u.role === 'customer')).toHaveLength(2);

    const cleaners = demoUsers.filter((u) => u.role === 'cleaner');
    expect(cleaners).toHaveLength(6);

    // Tier mix: verified and unverified both present.
    const tiers = cleaners.map((c) => c.cleanerProfile?.tier);
    expect(tiers).toContain('verified');
    expect(tiers).toContain('registered');

    // Regime coverage: FBiH, student, RS, obrt (§12.7).
    const regimes = new Set(cleaners.map((c) => c.cleanerLegalProfile?.legalRegime));
    for (const regime of ['fbih', 'fbih_student', 'rs', 'obrt'] as const) {
      expect(regimes).toContain(regime);
    }
  });

  it('has the Airbnb host with 3 checklisted properties', async () => {
    const host = await prisma.user.findUniqueOrThrow({
      where: { firebaseUid: 'demo-adnan' },
      include: { properties: true },
    });
    expect(host.isHost).toBe(true);
    expect(host.properties).toHaveLength(3);
    expect(host.properties.every((p) => p.checklist !== null)).toBe(true);
    expect(host.properties.some((p) => p.isAirbnb)).toBe(true);
  });

  it('has 10 demo bookings across distinct statuses', async () => {
    const bookings = await prisma.booking.findMany({ where: { code: { startsWith: 'TT-DEMO-' } } });
    expect(bookings).toHaveLength(10);
    expect(new Set(bookings.map((b) => b.status)).size).toBe(10);
    // Every booking snapshots its pricing (server-authoritative, §6).
    expect(bookings.every((b) => b.pricingConfigVersion === 1)).toBe(true);
    // The disputed one has its dispute row.
    const disputed = bookings.find((b) => b.status === 'disputed');
    const dispute = await prisma.dispute.findUnique({ where: { bookingId: disputed!.id } });
    expect(dispute).not.toBeNull();
  });

  it('has cities, catalog, active pricing config v1 and the promo code', async () => {
    const cities = await prisma.city.findMany({ where: { slug: { in: ['sarajevo', 'banja-luka'] } } });
    expect(cities).toHaveLength(2);

    const serviceKeys = (await prisma.serviceType.findMany()).map((s) => s.key);
    for (const key of ['standard', 'deep', 'move_out', 'airbnb_turnover']) {
      expect(serviceKeys).toContain(key);
    }
    const airbnb = await prisma.serviceType.findUnique({ where: { key: 'airbnb_turnover' } });
    expect(airbnb?.requiresVerified).toBe(true); // Host jobs are verified-only (§2)

    expect(await prisma.addon.count({ where: { key: { in: ['oven', 'fridge', 'windows', 'balcony', 'cabinets', 'ironing', 'post_renovation'] } } })).toBe(7);

    const sarajevo = cities.find((c) => c.slug === 'sarajevo')!;
    const cfg = await prisma.pricingConfig.findUnique({
      where: { cityId_version: { cityId: sarajevo.id, version: 1 } },
    });
    expect(cfg?.active).toBe(true);
    expect(cfg?.platformFeePct).toBe(20);
    expect(cfg?.rateMinF).toBe(800);
    expect(cfg?.rateMaxF).toBe(1500);

    expect(await prisma.promoCode.findUnique({ where: { code: 'DOBRODOSLI10' } })).not.toBeNull();
  });

  it('has the near-limit cash-debt wallet with its ledger entry', async () => {
    const receivable = await prisma.walletAccount.findFirst({
      where: { ownerType: 'cleaner_receivable', balanceF: { gt: 0 } },
    });
    expect(receivable).not.toBeNull();
    // 48 KM debt — near, but not over, the −50 KM default limit (§7).
    expect(receivable!.balanceF).toBe(4800);
    expect(receivable!.blocked).toBe(false);

    const entry = await prisma.ledgerEntry.findUnique({
      where: { idempotencyKey: 'seed:cash_commission:mirsad' },
    });
    expect(entry?.kind).toBe('cash_commission');
    expect(entry?.amountF).toBe(4800);
  });
});

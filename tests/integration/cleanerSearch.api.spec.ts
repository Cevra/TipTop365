import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { GET as searchGet } from '@/app/api/cleaners/search/route';
import { __resetRateLimits } from '@/lib/server/rateLimit';

// Integration (E3.3): search endpoint against the §12.7 seed roster
// (Sarajevo: Amina/Selma/Jasmin verified, Emir/Mirsad registered; Dragana in
// Banja Luka). Public endpoint — no session involved.

const prisma = new PrismaClient();

function search(params: Record<string, string>): Promise<Response> {
  const qs = new URLSearchParams(params).toString();
  return searchGet(
    new Request(`http://test.local/api/cleaners/search?${qs}`, {
      headers: { 'x-forwarded-for': `10.33.${Math.floor(Math.random() * 250)}.1` },
    }),
  );
}

beforeEach(() => __resetRateLimits());
afterAll(async () => {
  delete process.env.FLAG_ALLOW_UNVERIFIED_BOOKINGS;
  await prisma.$disconnect();
});

describe('GET /api/cleaners/search', () => {
  it('ranks the Sarajevo standard-cleaning roster verified-first', async () => {
    const res = await search({ city: 'sarajevo', serviceType: 'standard' });
    expect(res.status).toBe(200);
    const { data } = await res.json();

    expect(data.broadcastAvailable).toBe(true);
    expect(data.verifiedOnly).toBe(false); // flag is on in seed
    const names = data.cleaners.map((c: { name: string }) => c.name);
    // Seed Sarajevo standard-cleaners: Amina/Jasmin verified, Emir/Mirsad registered.
    expect(names.length).toBeGreaterThanOrEqual(4);
    const tiers = data.cleaners.map((c: { tier: string }) => c.tier);
    const firstRegistered = tiers.indexOf('registered');
    const lastVerified = tiers.lastIndexOf('verified');
    expect(lastVerified).toBeLessThan(firstRegistered); // no interleaving

    // Anti-disintermediation: last name reduced to an initial.
    expect(names[0]).toMatch(/^\p{L}+ \p{L}\.$/u);
    // No contact fields in the payload.
    expect(JSON.stringify(data.cleaners)).not.toMatch(/email|phone/i);
  });

  it('Airbnb turnover restricts to verified cleaners who offer it', async () => {
    const res = await search({ city: 'sarajevo', serviceType: 'airbnb_turnover' });
    const { data } = await res.json();
    expect(data.verifiedOnly).toBe(true);
    expect(data.cleaners.length).toBeGreaterThanOrEqual(2); // Amina + Selma in seed
    expect(data.cleaners.every((c: { tier: string }) => c.tier === 'verified')).toBe(true);
  });

  it('ALLOW_UNVERIFIED_BOOKINGS=false (env override) hides registered cleaners', async () => {
    process.env.FLAG_ALLOW_UNVERIFIED_BOOKINGS = 'false';
    try {
      const res = await search({ city: 'sarajevo', serviceType: 'standard' });
      const { data } = await res.json();
      expect(data.verifiedOnly).toBe(true);
      expect(data.cleaners.every((c: { tier: string }) => c.tier === 'verified')).toBe(true);
    } finally {
      delete process.env.FLAG_ALLOW_UNVERIFIED_BOOKINGS;
    }
  });

  it('scopes by city — Banja Luka returns Dragana, not the Sarajevo roster', async () => {
    const res = await search({ city: 'banja-luka', serviceType: 'standard' });
    const { data } = await res.json();
    expect(data.cleaners.length).toBeGreaterThanOrEqual(1);
    expect(data.cleaners.map((c: { name: string }) => c.name)).toContain('Dragana S.');
  });

  it('404s unknown city/service and validates coordinates', async () => {
    expect((await search({ city: 'nowhere', serviceType: 'standard' })).status).toBe(404);
    expect((await search({ city: 'sarajevo', serviceType: 'nope' })).status).toBe(404);
    expect((await search({ city: 'sarajevo', serviceType: 'standard', lat: '999', lng: '0' })).status).toBe(400);
  });
});

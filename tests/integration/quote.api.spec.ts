import { beforeEach, describe, expect, it } from 'vitest';
import { POST as quotePost } from '@/app/api/pricing/quote/route';
import { GET as catalogGet } from '@/app/api/catalog/route';
import { __resetRateLimits } from '@/lib/server/rateLimit';

// Integration (E2.2): the quote + catalog endpoints against the seeded DB
// (npm run db:seed — CI seeds before this suite). Route handlers are plain
// functions; we invoke them with real Request objects.

function quoteRequest(body: unknown, ip = '10.9.9.9'): Request {
  return new Request('http://test.local/api/pricing/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

const baseBody = {
  citySlug: 'sarajevo',
  serviceTypeKey: 'standard',
  m2: 75,
  addons: [{ key: 'oven', qty: 1 }],
  paymentMethod: 'card',
};

beforeEach(() => __resetRateLimits());

describe('POST /api/pricing/quote', () => {
  it('returns the §6 worked example exactly for a known rate', async () => {
    const res = await quotePost(quoteRequest({ ...baseBody, rateF: 1200 }));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.kind).toBe('exact');
    expect(data.quote.estHours).toBe(4);
    expect(data.quote.cleanerAmountF).toBe(4800);
    expect(data.quote.serviceFeeF).toBe(960);
    expect(data.quote.totalF).toBe(5760);
    expect(data.quote.pricingConfigVersion).toBe(1);
  });

  it('returns a min–max range when no rate is given (pre-selection)', async () => {
    const res = await quotePost(quoteRequest(baseBody));
    const { data } = await res.json();
    expect(data.kind).toBe('range');
    // Seed bounds 800–1500 f/h × 4 h → 3200/6000 cleaner amounts + 20 % fee.
    expect(data.min.totalF).toBe(3840);
    expect(data.max.totalF).toBe(7200);
    expect(data.min.totalF).toBeLessThan(data.max.totalF);
  });

  it('adds the cash fee for cash and the recurring discount when asked', async () => {
    const res = await quotePost(
      quoteRequest({ ...baseBody, rateF: 1200, paymentMethod: 'cash', recurring: 'weekly' }),
    );
    const { data } = await res.json();
    expect(data.quote.discountF).toBe(480);
    expect(data.quote.cashFeeF).toBe(200);
    expect(data.quote.totalF).toBe(5384); // 5184 + 200 cash fee
  });

  it('rejects unknown city / service / addon with stable codes', async () => {
    const city = await quotePost(quoteRequest({ ...baseBody, citySlug: 'nowhere' }));
    expect(city.status).toBe(404);
    expect((await city.json()).error.code).toBe('CITY_NOT_FOUND');

    const svc = await quotePost(quoteRequest({ ...baseBody, serviceTypeKey: 'nope' }));
    expect((await svc.json()).error.code).toBe('SERVICE_TYPE_NOT_FOUND');

    const addon = await quotePost(quoteRequest({ ...baseBody, addons: [{ key: 'nope', qty: 1 }] }));
    expect((await addon.json()).error.code).toBe('ADDON_NOT_FOUND');
  });

  it('maps engine rejections (rate out of bounds) to 400 QUOTE_INVALID', async () => {
    const res = await quotePost(quoteRequest({ ...baseBody, rateF: 700 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('QUOTE_INVALID');
  });

  it('validates the body shape (400 VALIDATION_ERROR)', async () => {
    const res = await quotePost(quoteRequest({ citySlug: 'sarajevo', m2: -3 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
  });

  it('rate-limits per IP with the quote preset (30 capacity)', async () => {
    // Empty body → fails validation immediately AFTER the rate-limit check,
    // so the loop stays fast (no DB) and the bucket can't refill mid-test.
    let lastStatus = 0;
    for (let i = 0; i < 31; i++) {
      const res = await quotePost(quoteRequest({}, '10.1.2.3'));
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
    // Different IP has its own bucket and still gets a real quote.
    const other = await quotePost(quoteRequest({ ...baseBody, rateF: 1200 }, '10.4.5.6'));
    expect(other.status).toBe(200);
  });
});

describe('GET /api/catalog', () => {
  it('returns services, addons and the public pricing subset for the city', async () => {
    const res = await catalogGet(new Request('http://test.local/api/catalog?city=sarajevo'));
    expect(res.status).toBe(200);
    const { data } = await res.json();

    expect(data.city.slug).toBe('sarajevo');
    const serviceKeys = data.services.map((s: { key: string }) => s.key);
    expect(serviceKeys).toEqual(
      expect.arrayContaining(['standard', 'deep', 'move_out', 'airbnb_turnover']),
    );
    const airbnb = data.services.find((s: { key: string }) => s.key === 'airbnb_turnover');
    expect(airbnb.requiresVerified).toBe(true);
    expect(airbnb.nameBs).toBeTruthy();
    expect(airbnb.nameEn).toBeTruthy();

    expect(data.addons.length).toBeGreaterThanOrEqual(7);
    expect(data.pricing.rateMinF).toBe(800);
    expect(data.pricing.rateMaxF).toBe(1500);
    expect(data.pricing.platformFeePct).toBe(20);
    expect(data.pricing.version).toBe(1);
  });

  it('404s an unknown city', async () => {
    const res = await catalogGet(new Request('http://test.local/api/catalog?city=nowhere'));
    expect(res.status).toBe(404);
  });
});

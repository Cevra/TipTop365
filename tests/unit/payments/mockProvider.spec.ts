import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { MockProvider, __resetMockProvider, getPaymentProvider } from '@/lib/server/payments/mockProvider';

const provider = new MockProvider();
const base = { amountF: 5760, currency: 'BAM' as const, reference: 'TT-TEST-001' };

beforeEach(() => __resetMockProvider());

describe('MockProvider (D6 interface)', () => {
  it('captures successfully with a normal token', async () => {
    const result = await provider.capture({ ...base, idempotencyKey: 'capture:b1:1', cardToken: 'tok_ok' });
    expect(result.ok).toBe(true);
    expect(result.status).toBe('succeeded');
    expect(result.threedsStatus).toBe('frictionless');
    expect(result.providerRef).toMatch(/^mock_/);
  });

  it('simulates declines via magic tokens', async () => {
    const declined = await provider.capture({ ...base, idempotencyKey: 'capture:b2:1', cardToken: 'tok_declined' });
    expect(declined.ok).toBe(false);
    expect(declined.declineReason).toBe('card_declined');

    const threeds = await provider.capture({ ...base, idempotencyKey: 'capture:b3:1', cardToken: 'tok_3ds_fail' });
    expect(threeds.ok).toBe(false);
    expect(threeds.threedsStatus).toBe('failed');
  });

  it('is idempotent: same key replays the SAME result, even a decline', async () => {
    const first = await provider.capture({ ...base, idempotencyKey: 'capture:b4:1', cardToken: 'tok_declined' });
    // Same key, different (good) token — a real PSP replays the original outcome.
    const replay = await provider.capture({ ...base, idempotencyKey: 'capture:b4:1', cardToken: 'tok_ok' });
    expect(replay).toEqual(first);
    // New attempt key → fresh outcome.
    const retry = await provider.capture({ ...base, idempotencyKey: 'capture:b4:2', cardToken: 'tok_ok' });
    expect(retry.ok).toBe(true);
  });

  it('verifies webhooks by sha256 signature', async () => {
    const body = JSON.stringify({ kind: 'payment.captured', providerRef: 'mock_x' });
    const good = await provider.verifyWebhook(body, createHash('sha256').update(body).digest('hex'));
    expect(good.valid).toBe(true);
    expect(good.event?.kind).toBe('payment.captured');

    const bad = await provider.verifyWebhook(body, 'nope');
    expect(bad.valid).toBe(false);
    expect(bad.event).toBeUndefined();
  });

  it('tokenizes deterministically without storing the raw handle', async () => {
    const { cardToken } = await provider.tokenize('4111-1111-1111-1111');
    expect(cardToken).toMatch(/^tok_/);
    expect(cardToken).not.toContain('4111');
    expect((await provider.tokenize('4111-1111-1111-1111')).cardToken).toBe(cardToken);
  });

  it('registry returns mock by default and rejects unknown providers', () => {
    expect(getPaymentProvider().name).toBe('mock');
    process.env.PAYMENT_PROVIDER = 'paypal';
    expect(() => getPaymentProvider()).toThrow(/Unknown PAYMENT_PROVIDER/);
    delete process.env.PAYMENT_PROVIDER;
  });
});

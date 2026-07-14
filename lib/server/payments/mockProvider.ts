import 'server-only';
import { createHash } from 'node:crypto';
import type {
  ChargeRequest,
  ChargeResult,
  PaymentProvider,
  RefundRequest,
  WebhookVerification,
} from './provider';

// MockProvider (E3.5): deterministic, in-memory, dependency-free. Behaviors
// the real Monri flow will exercise are simulatable via magic card tokens so
// E2E tests (E3.11) can drive declines without a PSP sandbox:
//   tok_declined  → capture fails (card_declined)
//   tok_3ds_fail  → capture fails (threeds_failed)
//   anything else → succeeds, threeds "frictionless"
// Idempotency: same key → same result object (replay-safe like a real PSP).

const seen = new Map<string, ChargeResult>();

function refFor(key: string): string {
  return `mock_${createHash('sha256').update(key).digest('hex').slice(0, 16)}`;
}

export class MockProvider implements PaymentProvider {
  readonly name = 'mock' as const;

  async capture(req: ChargeRequest): Promise<ChargeResult> {
    const cached = seen.get(req.idempotencyKey);
    if (cached) return cached;

    let result: ChargeResult;
    if (req.cardToken === 'tok_declined') {
      result = { ok: false, providerRef: refFor(req.idempotencyKey), status: 'declined', declineReason: 'card_declined' };
    } else if (req.cardToken === 'tok_3ds_fail') {
      result = { ok: false, providerRef: refFor(req.idempotencyKey), status: 'declined', threedsStatus: 'failed', declineReason: 'threeds_failed' };
    } else {
      result = { ok: true, providerRef: refFor(req.idempotencyKey), status: 'succeeded', threedsStatus: 'frictionless' };
    }
    seen.set(req.idempotencyKey, result);
    return result;
  }

  async refund(req: RefundRequest): Promise<ChargeResult> {
    const cached = seen.get(req.idempotencyKey);
    if (cached) return cached;
    const result: ChargeResult = { ok: true, providerRef: refFor(req.idempotencyKey), status: 'refunded' };
    seen.set(req.idempotencyKey, result);
    return result;
  }

  async void(providerRef: string): Promise<ChargeResult> {
    return { ok: true, providerRef, status: 'voided' };
  }

  async tokenize(rawCardHandle: string): Promise<{ cardToken: string }> {
    return { cardToken: `tok_${createHash('sha256').update(rawCardHandle).digest('hex').slice(0, 12)}` };
  }

  async verifyWebhook(rawBody: string, signature: string): Promise<WebhookVerification> {
    // Mock convention: signature must be sha256(rawBody) hex.
    const expected = createHash('sha256').update(rawBody).digest('hex');
    if (signature !== expected) return { valid: false };
    const payload = JSON.parse(rawBody) as { kind?: string; providerRef?: string };
    return {
      valid: true,
      event: { kind: payload.kind ?? 'unknown', providerRef: payload.providerRef ?? '', payload },
    };
  }
}

/** Test-only: reset idempotency memory between suites. */
export function __resetMockProvider(): void {
  seen.clear();
}

// Provider registry — E6 swaps by env (PAYMENT_PROVIDER=monri) behind the
// same interface; everything above the interface never changes (D6).
const providers: Record<string, PaymentProvider> = { mock: new MockProvider() };

export function getPaymentProvider(): PaymentProvider {
  const name = process.env.PAYMENT_PROVIDER ?? 'mock';
  const provider = providers[name];
  if (!provider) throw new Error(`Unknown PAYMENT_PROVIDER "${name}" (registered: ${Object.keys(providers).join(', ')})`);
  return provider;
}

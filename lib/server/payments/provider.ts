import 'server-only';

// D6: Stripe-shaped PaymentProvider interface. Three impls over time:
// MockProvider (dev/CI, this task) → MonriProvider (E6, primary BiH PSP) →
// optional WSPayProvider. All amounts integer fenings (D5); the ledger, not
// the provider, is the source of truth for money state (§7).

export interface ChargeRequest {
  /** Idempotency key, e.g. `capture:<bookingId>` — providers must dedupe on it. */
  idempotencyKey: string;
  amountF: number;
  currency: 'BAM';
  /** Tokenized card (one-click repeat, §6); absent → provider's hosted flow. */
  cardToken?: string;
  /** Provider-agnostic reference shown in PSP dashboards. */
  reference: string;
}

export interface ChargeResult {
  ok: boolean;
  /** Provider's transaction id — stored as payments.provider_ref. */
  providerRef: string;
  /** Provider-specific status vocabulary — stored verbatim on payments.status. */
  status: string;
  threedsStatus?: string;
  /** Set when ok=false; stable enough to branch UX messaging on. */
  declineReason?: string;
}

export interface RefundRequest {
  idempotencyKey: string;
  providerRef: string;
  amountF: number;
}

export interface WebhookVerification {
  valid: boolean;
  event?: { kind: string; providerRef: string; payload: unknown };
}

export interface PaymentProvider {
  readonly name: 'mock' | 'monri' | 'wspay';
  /** D7 v1.1: immediate capture at confirmation (auth-then-capture post-MVP). */
  capture(req: ChargeRequest): Promise<ChargeResult>;
  refund(req: RefundRequest): Promise<ChargeResult>;
  void(providerRef: string): Promise<ChargeResult>;
  tokenize(rawCardHandle: string): Promise<{ cardToken: string }>;
  verifyWebhook(rawBody: string, signature: string): Promise<WebhookVerification>;
}

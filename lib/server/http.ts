import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AuthError } from '@/lib/server/auth/session';
import { reportError } from '@/lib/server/observability';

// Standard response envelope (plan §10): success → { data }, failure →
// { error: { code, details? } }. All route handlers use these so clients get a
// single predictable shape.

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, init);
}

export function fail(code: string, status: number, details?: unknown): NextResponse {
  return NextResponse.json(
    { error: { code, ...(details !== undefined ? { details } : {}) } },
    { status },
  );
}

/** Throwable API error that the handler wrapper maps to an envelope. */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

/** Map any thrown value to a failure envelope without leaking internals. */
export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) return fail(err.code, err.status, err.details);
  if (err instanceof AuthError) return fail(err.message, err.status);
  if (err instanceof ZodError) return fail('VALIDATION_ERROR', 400, err.flatten());
  console.error('Unhandled API error:', err);
  reportError(err); // → Sentry when a DSN is configured (no-op otherwise)
  return fail('INTERNAL_ERROR', 500);
}

/**
 * Wrap a route handler so thrown ApiError/AuthError/ZodError become proper
 * envelopes and anything else becomes a clean 500.
 */
export function handler<A extends unknown[]>(
  fn: (...args: A) => Promise<NextResponse>,
): (...args: A) => Promise<NextResponse> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

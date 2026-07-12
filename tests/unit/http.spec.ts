import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiError, ok, fail, toErrorResponse } from '@/lib/server/http';
import { AuthError } from '@/lib/server/auth/session';

async function bodyOf(res: Response) {
  return res.json();
}

describe('response envelope', () => {
  it('ok wraps in { data }', async () => {
    const res = ok({ hello: 'world' });
    expect(res.status).toBe(200);
    expect(await bodyOf(res)).toEqual({ data: { hello: 'world' } });
  });

  it('fail wraps in { error: { code } }', async () => {
    const res = fail('NOPE', 403);
    expect(res.status).toBe(403);
    expect(await bodyOf(res)).toEqual({ error: { code: 'NOPE' } });
  });

  it('fail includes details when provided', async () => {
    const res = fail('BAD', 400, { field: 'email' });
    expect(await bodyOf(res)).toEqual({ error: { code: 'BAD', details: { field: 'email' } } });
  });
});

describe('toErrorResponse mapping', () => {
  it('maps ApiError to its code + status', async () => {
    const res = toErrorResponse(new ApiError('TEAPOT', 418));
    expect(res.status).toBe(418);
    expect(await bodyOf(res)).toEqual({ error: { code: 'TEAPOT' } });
  });

  it('maps AuthError to 401/403', async () => {
    expect(toErrorResponse(new AuthError('UNAUTHENTICATED', 401)).status).toBe(401);
    expect(toErrorResponse(new AuthError('FORBIDDEN', 403)).status).toBe(403);
  });

  it('maps ZodError to 400 VALIDATION_ERROR', async () => {
    const parsed = z.object({ n: z.number() }).safeParse({ n: 'x' });
    expect(parsed.success).toBe(false);
    const res = toErrorResponse((parsed as { error: unknown }).error);
    expect(res.status).toBe(400);
    expect((await bodyOf(res)).error.code).toBe('VALIDATION_ERROR');
  });

  it('maps unknown errors to a clean 500 without leaking', async () => {
    const res = toErrorResponse(new Error('secret internal detail'));
    expect(res.status).toBe(500);
    expect(await bodyOf(res)).toEqual({ error: { code: 'INTERNAL_ERROR' } });
  });
});

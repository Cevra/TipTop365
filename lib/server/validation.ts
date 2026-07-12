import type { z } from 'zod';
import { ApiError } from '@/lib/server/http';

// Zod request parsing. On schema failure the ZodError propagates and the
// handler wrapper (lib/server/http) maps it to a 400 VALIDATION_ERROR.

export async function parseBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new ApiError('INVALID_JSON', 400);
  }
  return schema.parse(json);
}

export function parseQuery<T extends z.ZodTypeAny>(url: string, schema: T): z.infer<T> {
  const params = Object.fromEntries(new URL(url).searchParams);
  return schema.parse(params);
}

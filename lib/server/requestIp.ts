import 'server-only';

/** Client IP for rate-limit keys — first XFF hop, then x-real-ip, then 'unknown'. */
export function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

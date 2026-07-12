import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/firebaseConfig';

export async function middleware(request: NextRequest) {
  const user = auth.currentUser;

  // Protect provider routes
  // TODO(E0.3): client-side auth.currentUser is always null in Edge middleware —
  // replace with __session cookie verification + role claim (plan D4).
  if (request.nextUrl.pathname.startsWith('/provider-dashboard')) {
    if (!user) {
      return NextResponse.redirect(new URL('/become-provider', request.url));
    }
  }

  // Protect booking routes
  if (request.nextUrl.pathname.startsWith('/book-service')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
} 
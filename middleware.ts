import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/firebaseConfig';

export async function middleware(request: NextRequest) {
  const user = auth.currentUser;

  // Protect provider routes
  if (request.nextUrl.pathname.startsWith('/provider-dashboard')) {
    if (!user || user.role !== 'provider') {
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
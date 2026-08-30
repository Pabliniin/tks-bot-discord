import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Cierra la sesión y vuelve a la portada. */
export async function GET(request) {
  const response = NextResponse.redirect(new URL('/', request.nextUrl.origin));
  return clearSessionCookie(response);
}

export async function POST(request) {
  return GET(request);
}

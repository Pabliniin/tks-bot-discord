import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Cierra la sesión y vuelve a la portada. */
export async function GET(request) {
  // `request.nextUrl.origin` es la dirección con la que Next.js CREE que se
  // le está llamando -- detrás de un proxy (Caddy) suele salir mal (p.ej.
  // "http://localhost:3000", que nadie fuera del contenedor puede alcanzar).
  // NEXT_PUBLIC_SITE_URL es la dirección real y pública, así que manda ella.
  const origen = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const response = NextResponse.redirect(new URL('/', origen));
  return clearSessionCookie(response);
}

export async function POST(request) {
  return GET(request);
}

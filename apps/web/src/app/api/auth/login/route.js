import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';

import { buildAuthorizeUrl } from '@/lib/discord';

export const dynamic = 'force-dynamic';

/**
 * Inicia el flujo de OAuth2.
 *
 * Se genera un `state` aleatorio y se guarda en una cookie para comprobarlo al
 * volver: así se evita el falsificado de peticiones entre sitios (CSRF).
 */
export async function GET(request) {
  const missing = ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_REDIRECT_URI'].filter(
    (key) => !process.env[key]
  );

  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Faltan variables de entorno: ${missing.join(', ')}` },
      { status: 500 }
    );
  }

  const state = randomBytes(16).toString('hex');

  // Se recuerda a dónde quería ir el usuario antes de iniciar sesión.
  const redirectTo = request.nextUrl.searchParams.get('redirect') || '/dashboard';

  const response = NextResponse.redirect(buildAuthorizeUrl(state));

  response.cookies.set('tkbot_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });

  response.cookies.set('tkbot_oauth_redirect', redirectTo.startsWith('/') ? redirectTo : '/dashboard', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });

  return response;
}

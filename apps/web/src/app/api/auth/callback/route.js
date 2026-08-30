import { NextResponse } from 'next/server';

import { exchangeCode, fetchUser } from '@/lib/discord';
import { signSession, setSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Redirige a la portada con un mensaje de error legible. */
function fail(request, reason) {
  const url = new URL('/', request.nextUrl.origin);
  url.searchParams.set('error', reason);
  return NextResponse.redirect(url);
}

/**
 * Vuelta desde Discord tras autorizar.
 * Cambia el código por un token, guarda la sesión y lleva al panel.
 */
export async function GET(request) {
  const params = request.nextUrl.searchParams;

  // El usuario puede haber pulsado "Cancelar" en Discord.
  if (params.get('error')) {
    return fail(request, 'acceso_denegado');
  }

  const code = params.get('code');
  const state = params.get('state');
  const expectedState = request.cookies.get('tkbot_oauth_state')?.value;

  if (!code) return fail(request, 'sin_codigo');
  if (!state || !expectedState || state !== expectedState) {
    return fail(request, 'estado_invalido');
  }

  try {
    const tokens = await exchangeCode(code);
    const user = await fetchUser(tokens.access_token);

    const token = await signSession({
      userId: user.id,
      username: user.global_name || user.username,
      avatar: user.avatar,
      accessToken: tokens.access_token,
      // Sirve para decidir si conviene refrescar el token más adelante.
      expiresAt: Date.now() + (tokens.expires_in || 604800) * 1000,
    });

    const redirectTo = request.cookies.get('tkbot_oauth_redirect')?.value || '/dashboard';
    const response = NextResponse.redirect(new URL(redirectTo, request.nextUrl.origin));

    await setSessionCookie(response, token);

    // Las cookies del flujo OAuth ya no hacen falta.
    response.cookies.set('tkbot_oauth_state', '', { path: '/', maxAge: 0 });
    response.cookies.set('tkbot_oauth_redirect', '', { path: '/', maxAge: 0 });

    return response;
  } catch (error) {
    console.error('Fallo en el callback de OAuth:', error.message);
    return fail(request, 'fallo_autenticacion');
  }
}

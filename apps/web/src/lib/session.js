import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

/**
 * Sesión del panel.
 *
 * Se guarda un JWT firmado en una cookie httpOnly. Contiene el perfil de
 * Discord y el token de acceso, que solo se usa en el servidor para pedir la
 * lista de servidores del usuario.
 */

const COOKIE_NAME = 'tkbot_session';
const MAX_AGE = 7 * 24 * 60 * 60; // 7 días

/** Clave de firma derivada de SESSION_SECRET. */
function getKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'SESSION_SECRET no está configurado o es demasiado corto. Genera uno con: openssl rand -hex 32'
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Firma los datos de sesión y devuelve el token.
 * @param {object} payload
 * @returns {Promise<string>}
 */
export async function signSession(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(getKey());
}

/**
 * Lee y verifica la sesión actual.
 * @returns {Promise<object|null>} Datos de sesión, o `null` si no hay o caducó.
 */
export async function getSession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getKey());
    return payload;
  } catch {
    // Token caducado o manipulado: se trata como sesión inexistente.
    return null;
  }
}

/** Guarda la sesión en una cookie httpOnly. */
export async function setSessionCookie(response, token) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
  return response;
}

/** Borra la cookie de sesión. */
export function clearSessionCookie(response) {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}

export { COOKIE_NAME, MAX_AGE };

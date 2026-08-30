import { getSession } from './session';
import { fetchUserGuilds, canManageGuild } from './discord';

/**
 * Comprobaciones de acceso del panel.
 */

// La lista de claves editables y su filtro viven en su propio módulo para
// poder probarlos sin arrastrar las dependencias de Next.js.
export { EDITABLE_KEYS, sanitizePayload } from './editableKeys';

/**
 * Comprueba que hay sesión y que el usuario puede administrar el servidor.
 *
 * @param {string} guildId
 * @returns {Promise<{ ok: true, session: object, guild: object } | { ok: false, status: number, error: string }>}
 */
export async function requireGuildAccess(guildId) {
  const session = await getSession();
  if (!session) {
    return { ok: false, status: 401, error: 'Necesitas iniciar sesión.' };
  }

  if (!/^\d{16,20}$/.test(String(guildId || ''))) {
    return { ok: false, status: 400, error: 'El identificador del servidor no es válido.' };
  }

  let guilds;
  try {
    guilds = await fetchUserGuilds(session.accessToken);
  } catch (error) {
    if (error.rateLimited) {
      return {
        ok: false,
        status: 429,
        error: 'Discord ha limitado las peticiones. Espera unos segundos y recarga.',
      };
    }
    // Token caducado o revocado: hay que volver a iniciar sesión.
    return { ok: false, status: 401, error: 'Tu sesión ha caducado. Vuelve a iniciar sesión.' };
  }

  const guild = guilds.find((g) => g.id === guildId);
  if (!guild) {
    return { ok: false, status: 404, error: 'No estás en ese servidor.' };
  }
  if (!canManageGuild(guild)) {
    return {
      ok: false,
      status: 403,
      error: 'Necesitas el permiso «Gestionar servidor» para configurar el bot aquí.',
    };
  }

  return { ok: true, session, guild };
}

/** Lista de servidores administrables por el usuario actual. */
export async function getManageableGuilds() {
  const session = await getSession();
  if (!session) return { session: null, guilds: [], error: null };

  try {
    const guilds = await fetchUserGuilds(session.accessToken);
    return { session, guilds: guilds.filter(canManageGuild), error: null };
  } catch (error) {
    return {
      session,
      guilds: [],
      error: error.rateLimited
        ? 'Discord ha limitado las peticiones. Recarga en unos segundos.'
        : 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
    };
  }
}

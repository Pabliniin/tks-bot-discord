import { User, connect } from '@tkbot/shared';

import { getSession } from './session';

/**
 * Control de acceso al panel de administración del bot.
 *
 * Es el panel que ve TODOS los servidores y TODOS los clientes, así que aquí
 * no vale el permiso de un servidor: solo entran los dueños del bot y su
 * personal, exactamente igual que en Discord.
 */

/**
 * Identificadores de los dueños, leídos de `BOT_OWNERS`.
 *
 * Se validan con la misma expresión que usa el bot: un valor mal copiado (con
 * comillas, un espacio raro) tiene que quedarse fuera, no colarse.
 */
export function ownerIds() {
  return (process.env.BOT_OWNERS || '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => /^\d{16,20}$/.test(id));
}

/** ¿Es este usuario dueño del bot? */
export function isOwner(userId) {
  return ownerIds().includes(String(userId));
}

/**
 * Comprueba que quien entra puede administrar el bot.
 *
 * @returns {Promise<{ ok: true, session: object, esDueno: boolean }
 *                  | { ok: false, status: number, error: string }>}
 */
export async function requireAdmin() {
  const session = await getSession();
  if (!session) {
    return { ok: false, status: 401, error: 'Necesitas iniciar sesión.' };
  }

  if (isOwner(session.userId)) {
    return { ok: true, session, esDueno: true };
  }

  // El personal se guarda en la base de datos, igual que para los comandos.
  try {
    await connect();
    const doc = await User.findOne({ userId: session.userId }).select('botStaff.enabled').lean();

    if (doc?.botStaff?.enabled) {
      return { ok: true, session, esDueno: false };
    }
  } catch (error) {
    console.error('No se pudo comprobar el acceso de administración:', error.message);
    return { ok: false, status: 500, error: 'No se pudo comprobar tu acceso.' };
  }

  /*
   * Se responde 404 y no 403 a propósito: a quien no debe entrar no se le
   * confirma siquiera que esta página exista.
   */
  return { ok: false, status: 404, error: 'No encontrado.' };
}

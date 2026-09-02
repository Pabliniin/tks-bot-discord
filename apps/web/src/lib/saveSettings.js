import { getGuildSettings, premiumTier, premiumLimits, ConfigHistory } from '@tkbot/shared';

import { validateSettings } from './validateSettings';
import { mergeLogEvents } from './mergeLogEvents';
import { pickShape, resumirCambios } from './configHistory';
import { invalidateGuild } from './botApi';

/**
 * Guardado de la configuración de un servidor.
 *
 * Es el único punto por el que se escribe la configuración, lo usen el
 * formulario del panel, una plantilla, la importación de una copia o el botón
 * de deshacer. Tenerlo centralizado garantiza que ninguna de esas vías se
 * salte la validación ni deje de anotarse en el historial.
 *
 * @param {object} params
 * @param {string} params.guildId
 * @param {object} params.changes Cambios ya filtrados por `sanitizePayload`.
 * @param {object} params.actor Quién guarda: `{ userId, tag }`.
 * @param {boolean} [params.revert] Si es un deshacer (no se podrá deshacer a su vez).
 * @param {string} [params.revertOf] Entrada del historial que se está deshaciendo.
 * @param {string} [params.origen] De dónde viene: 'panel', 'plantilla', 'copia'…
 * @returns {Promise<{ ok: true, settings: object, premium: object, applied: boolean, historyId: string|null }
 *                  | { ok: false, status: number, error: string, details?: string[] }>}
 */
export async function saveGuildSettings({
  guildId,
  changes,
  actor,
  revert = false,
  revertOf = null,
  origen = 'panel',
}) {
  if (!changes || Object.keys(changes).length === 0) {
    return { ok: false, status: 400, error: 'No hay cambios que guardar.' };
  }

  const settings = await getGuildSettings(guildId);
  const tier = premiumTier(settings);

  // `logs.events` es un Map: el panel solo envía los eventos tocados en este
  // guardado, y asignarlos tal cual reemplazaría el Map entero.
  const cambios = mergeLogEvents(changes, settings);

  // Los límites del plan se comprueban aquí, no solo en el navegador: de lo
  // contrario bastaría con llamar a la API para saltárselos.
  const validation = validateSettings(cambios, settings, tier);
  if (!validation.ok) {
    return {
      ok: false,
      status: 400,
      error: 'La configuración no es válida.',
      details: validation.errors,
    };
  }

  /*
   * Se capturan los valores anteriores ANTES de tocar nada, y sobre el objeto
   * plano: `settings` es un documento de mongoose y sus `Map` no se recorren
   * como objetos normales.
   */
  const previos = pickShape(settings.toObject(), cambios);

  for (const [clave, valor] of Object.entries(cambios)) {
    settings.set(clave, valor);
  }

  // `validateSync` aplica las reglas del esquema (rangos, enumerados…).
  const errorEsquema = settings.validateSync();
  if (errorEsquema) {
    const details = Object.values(errorEsquema.errors || {})
      .map((e) => e.message)
      .slice(0, 5);
    return { ok: false, status: 400, error: 'Hay valores no válidos.', details };
  }

  await settings.save();

  /*
   * El historial es información añadida: si falla, el cambio ya está guardado
   * y no tiene sentido devolver un error al usuario. Se registra y se sigue.
   */
  let historyId = null;
  try {
    const entrada = await ConfigHistory.create({
      guildId,
      userId: actor?.userId || 'desconocido',
      userTag: actor?.tag || '',
      modules: Object.keys(cambios),
      changes: cambios,
      previous: previos,
      summary: resumirCambios(cambios),
      revert,
      revertOf,
    });
    historyId = String(entrada._id);
  } catch (error) {
    console.error('No se pudo anotar el cambio en el historial:', error.message);
  }

  // El bot cachea la configuración 60 s: se le avisa para que la recargue ya.
  const applied = await invalidateGuild(guildId);

  return {
    ok: true,
    settings: settings.toObject(),
    premium: { tier: premiumTier(settings), limits: premiumLimits(settings) },
    applied,
    historyId,
    origen,
  };
}

/**
 * Qué partes de la configuración puede escribir el panel.
 *
 * Va en su propio módulo, sin dependencias de Next.js, para poder probarlo
 * de forma aislada (`apps/web/tests/guards.test.mjs`).
 */

/**
 * Claves de primer nivel que el panel tiene permitido modificar.
 *
 * Deliberadamente NO incluye:
 *   · `premium`  — si no, cualquiera podría regalarse las funciones de pago.
 *   · `stats`    — son contadores internos del bot.
 *   · `guildId`  — identifica el documento; cambiarlo lo corrompería.
 *   · `_id`, `createdAt`, `updatedAt` — los gestiona mongoose.
 */
export const EDITABLE_KEYS = new Set([
  'prefix',
  'locale',
  'disabledCommands',
  'ignoredChannels',
  'modRoles',
  'adminRoles',
  'deleteCommandMessages',
  'welcome',
  'goodbye',
  'autoresponder',
  'embeds',
  'levels',
  'autoroles',
  'logs',
  'colors',
  'selfroles',
  'tempchannels',
  'templinks',
  'antiraid',
  'vipProtection',
  'starboard',
  'automod',
  'tickets',
  'appeals',
  'music',
  'counters',
]);

/**
 * Deja solo las claves permitidas de lo que envía el navegador.
 *
 * @param {unknown} payload Datos recibidos del panel.
 * @returns {object} Objeto nuevo con las claves aceptadas.
 */
export function sanitizePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};

  const clean = {};
  for (const [key, value] of Object.entries(payload)) {
    if (EDITABLE_KEYS.has(key)) clean[key] = value;
  }
  return clean;
}

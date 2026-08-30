'use strict';

const { Guild } = require('@tkbot/shared');
const logger = require('../utils/logger');

/**
 * Contador de uso de comandos.
 *
 * Escribir en la base de datos con cada comando sería un desperdicio, así que
 * los incrementos se acumulan en memoria y se vuelcan cada 60 segundos en una
 * sola operación por lotes.
 *
 * Si el bot se apaga de golpe se pierde como mucho un minuto de contador, cosa
 * que para una estadística no tiene ninguna importancia.
 */

/** `guildId` → número de comandos pendientes de sumar. */
const pendientes = new Map();

/** Suma uno al contador de un servidor. */
function registrar(guildId) {
  if (!guildId) return;
  pendientes.set(guildId, (pendientes.get(guildId) || 0) + 1);
}

/**
 * Vuelca los contadores acumulados.
 * @returns {Promise<number>} Servidores actualizados.
 */
async function volcar() {
  if (pendientes.size === 0) return 0;

  // Se copia y se vacía antes de escribir, para no perder los comandos que
  // lleguen mientras dura la operación.
  const lote = [...pendientes.entries()];
  pendientes.clear();

  const operaciones = lote.map(([guildId, cantidad]) => ({
    updateOne: {
      filter: { guildId },
      update: {
        $inc: { 'stats.commandsUsed': cantidad },
        $set: { 'stats.lastSeen': new Date() },
      },
    },
  }));

  try {
    await Guild.bulkWrite(operaciones, { ordered: false });
    return operaciones.length;
  } catch (err) {
    logger.debug(`No se pudieron guardar las estadísticas de uso: ${err.message}`);
    // Se devuelven al montón para intentarlo en el siguiente volcado.
    for (const [guildId, cantidad] of lote) {
      pendientes.set(guildId, (pendientes.get(guildId) || 0) + cantidad);
    }
    return 0;
  }
}

module.exports = {
  name: 'usageStats',
  registrar,
  volcar,
  pendientes,

  init() {
    const timer = setInterval(() => {
      volcar().catch(() => {});
    }, 60_000);
    timer.unref?.();
  },

  /** Vuelca lo que quede al apagar el bot. */
  async onShutdown() {
    await volcar().catch(() => {});
  },
};

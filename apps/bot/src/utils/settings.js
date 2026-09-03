'use strict';

const { getGuildSettings, Guild } = require('@tkbot/shared');
const logger = require('./logger');

/**
 * Caché de configuración por servidor.
 *
 * Cada evento de mensaje necesita la configuración del servidor; ir a MongoDB
 * cada vez sería inviable. Se cachea durante `TTL` y el panel web invalida la
 * entrada al guardar (ver `src/api/server.js`).
 */
const TTL = 60_000;
const cache = new Map();

/**
 * Tiempo máximo para responder a una interacción de Discord.
 *
 * Discord descarta la interacción si no se contesta en 3 segundos y le enseña
 * al usuario «La aplicación no ha respondido». Buscar la configuración tiene
 * que caber holgadamente dentro de esa ventana, así que se corta mucho antes.
 */
const TIMEOUT_INTERACCION = 1200;

/**
 * Configuración por defecto, sin tocar la base de datos.
 *
 * Se usa cuando MongoDB no responde a tiempo: es preferible ejecutar el
 * comando con los valores de fábrica que dejar al usuario mirando un
 * «La aplicación no ha respondido» sin ninguna explicación.
 */
function porDefecto(guildId) {
  // `new Guild()` aplica todos los `default` del esquema sin guardar nada.
  return new Guild({ guildId }).toObject();
}

/**
 * Devuelve la configuración de un servidor, usando la caché si sigue vigente.
 *
 * @param {string} guildId
 * @param {object} [options]
 * @param {number} [options.timeoutMs] Corta la espera y devuelve lo que haya.
 * @returns {Promise<object>}
 */
async function get(guildId, options = {}) {
  const cached = cache.get(guildId);
  if (cached && cached.expires > Date.now()) return cached.data;

  const buscar = getGuildSettings(guildId).then((settings) => {
    cache.set(guildId, { data: settings, expires: Date.now() + TTL });
    return settings;
  });

  try {
    // Sin límite de tiempo se espera lo que haga falta (eventos de mensaje).
    if (!options.timeoutMs) return await buscar;

    /*
     * Con límite, se compite contra un temporizador. La búsqueda sigue en
     * marcha aunque perdamos: si acaba, deja la caché caliente para la
     * siguiente vez, así que el usuario solo nota el retraso una vez.
     */
    let temporizador;
    const limite = new Promise((_, rechazar) => {
      temporizador = setTimeout(() => rechazar(new Error('timeout')), options.timeoutMs);
      temporizador.unref?.();
    });

    // Si la búsqueda falla después de haber perdido la carrera, ese rechazo
    // no lo escucha nadie: se silencia para no tumbar el proceso.
    buscar.catch(() => {});

    try {
      return await Promise.race([buscar, limite]);
    } finally {
      clearTimeout(temporizador);
    }
  } catch (err) {
    const porTiempo = err.message === 'timeout';

    if (porTiempo) {
      logger.error(
        `La base de datos tardó más de ${options.timeoutMs} ms en dar la configuración de ${guildId}. ` +
          'Se responde con los valores por defecto. Revisa que MongoDB esté accesible.'
      );
    } else {
      logger.error(`No se pudo cargar la configuración de ${guildId}:`, err.message);
    }

    // Una copia caducada sigue siendo mucho mejor que nada.
    if (cached) return cached.data;

    /*
     * Sin caché previa se devuelven los valores de fábrica. No se guardan en
     * la caché a propósito: en cuanto MongoDB vuelva, la siguiente llamada
     * debe traer la configuración de verdad.
     */
    return porDefecto(guildId);
  }
}

/**
 * Igual que `get`, pero pensado para interacciones: nunca tarda tanto como
 * para que Discord dé la interacción por perdida.
 * @param {string} guildId
 */
function getParaInteraccion(guildId) {
  return get(guildId, { timeoutMs: TIMEOUT_INTERACCION });
}

/** Elimina un servidor de la caché para forzar una recarga. */
function invalidate(guildId) {
  cache.delete(guildId);
}

/** Vacía la caché completa. */
function clear() {
  cache.clear();
}

/**
 * Guarda cambios y refresca la caché con el documento actualizado.
 * @param {object} settings Documento de mongoose ya modificado.
 */
async function save(settings) {
  await settings.save();
  cache.set(settings.guildId, { data: settings, expires: Date.now() + TTL });
  return settings;
}

/** Número de servidores en caché (usado por la API de estado). */
function size() {
  return cache.size;
}

module.exports = {
  get,
  getParaInteraccion,
  invalidate,
  clear,
  save,
  size,
  porDefecto,
  TTL,
  TIMEOUT_INTERACCION,
};

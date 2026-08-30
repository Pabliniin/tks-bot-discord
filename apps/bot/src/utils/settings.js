'use strict';

const { getGuildSettings } = require('@tkbot/shared');
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
 * Devuelve la configuración de un servidor, usando la caché si sigue vigente.
 * @param {string} guildId
 * @returns {Promise<object>}
 */
async function get(guildId) {
  const cached = cache.get(guildId);
  if (cached && cached.expires > Date.now()) return cached.data;

  try {
    const settings = await getGuildSettings(guildId);
    cache.set(guildId, { data: settings, expires: Date.now() + TTL });
    return settings;
  } catch (err) {
    logger.error(`No se pudo cargar la configuración de ${guildId}:`, err.message);
    // Devuelve la copia caducada antes que romper el evento en curso.
    if (cached) return cached.data;
    throw err;
  }
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

module.exports = { get, invalidate, clear, save, size, TTL };

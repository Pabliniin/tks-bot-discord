'use strict';

const { GuildStats } = require('@tkbot/shared');
const logger = require('../utils/logger');

/**
 * Estadísticas diarias del servidor.
 *
 * Acumula en memoria y vuelca cada dos minutos en una sola operación por
 * lotes. Escribir con cada mensaje hundiría la base de datos en un servidor
 * grande; perder dos minutos de contador si el bot se cae de golpe no tiene
 * ninguna importancia para una gráfica.
 *
 * Es lo que alimenta las gráficas de crecimiento y actividad del panel, que la
 * competencia no ofrece: hoy un dueño de servidor no puede saber si está
 * creciendo o perdiendo gente sin contratar otro bot solo para eso.
 */

/** `guildId` → contadores pendientes de volcar. */
const pendientes = new Map();

/** Intervalo entre volcados. */
const INTERVALO = 120_000;

/**
 * Día actual en formato `AAAA-MM-DD` (UTC).
 *
 * Se usa UTC a propósito: si se usara la hora local del servidor donde corre
 * el bot, mover el despliegue de región partiría las gráficas por la mitad.
 */
function hoy() {
  return new Date().toISOString().slice(0, 10);
}

/** Contadores en blanco de un servidor. */
function nuevoLote() {
  return {
    joins: 0,
    leaves: 0,
    messages: 0,
    commands: 0,
    voiceMinutes: 0,
    moderationActions: 0,
    automodActions: 0,
    /** `canalId` → mensajes, para el ranking de canales más activos. */
    canales: new Map(),
    /** Último recuento de miembros visto: se guarda tal cual, no se suma. */
    memberCount: null,
  };
}

/**
 * Suma a un contador de un servidor.
 *
 * @param {string} guildId
 * @param {'joins'|'leaves'|'messages'|'commands'|'voiceMinutes'|'moderationActions'|'automodActions'} campo
 * @param {number} [cantidad]
 * @param {string} [channelId] Solo para `messages`: reparte por canal.
 */
function registrar(guildId, campo, cantidad = 1, channelId = null) {
  if (!guildId || !campo) return;

  const lote = pendientes.get(guildId) || nuevoLote();
  if (typeof lote[campo] === 'number') lote[campo] += cantidad;

  if (campo === 'messages' && channelId) {
    lote.canales.set(channelId, (lote.canales.get(channelId) || 0) + cantidad);
  }

  pendientes.set(guildId, lote);
}

/**
 * Anota cuántos miembros tiene el servidor ahora.
 * Es una foto, no un acumulado: se queda el último valor del día.
 */
function registrarMiembros(guildId, cantidad) {
  if (!guildId || !Number.isFinite(cantidad)) return;

  const lote = pendientes.get(guildId) || nuevoLote();
  lote.memberCount = cantidad;
  pendientes.set(guildId, lote);
}

/**
 * Vuelca los contadores acumulados.
 * @returns {Promise<number>} Documentos actualizados.
 */
async function volcar() {
  if (pendientes.size === 0) return 0;

  // Se copia y se vacía antes de escribir, para no perder lo que llegue
  // mientras dura la operación.
  const lotes = [...pendientes.entries()];
  pendientes.clear();

  const fecha = hoy();
  const operaciones = [];

  for (const [guildId, lote] of lotes) {
    const inc = {};
    for (const campo of [
      'joins',
      'leaves',
      'messages',
      'commands',
      'voiceMinutes',
      'moderationActions',
      'automodActions',
    ]) {
      if (lote[campo] > 0) inc[campo] = lote[campo];
    }

    for (const [canal, cantidad] of lote.canales) {
      inc[`channelMessages.${canal}`] = cantidad;
    }

    const set = {};
    if (lote.memberCount !== null) set.memberCount = lote.memberCount;

    // Un lote sin nada que sumar ni que fijar no merece una escritura.
    if (Object.keys(inc).length === 0 && Object.keys(set).length === 0) continue;

    const update = { $setOnInsert: { guildId, date: fecha } };
    if (Object.keys(inc).length > 0) update.$inc = inc;
    if (Object.keys(set).length > 0) update.$set = set;

    operaciones.push({
      updateOne: { filter: { guildId, date: fecha }, update, upsert: true },
    });
  }

  if (operaciones.length === 0) return 0;

  try {
    await GuildStats.bulkWrite(operaciones, { ordered: false });
    return operaciones.length;
  } catch (err) {
    logger.debug(`No se pudieron guardar las estadísticas diarias: ${err.message}`);

    // Se devuelven al montón para intentarlo en el siguiente volcado.
    for (const [guildId, lote] of lotes) {
      const actual = pendientes.get(guildId);
      if (!actual) {
        pendientes.set(guildId, lote);
        continue;
      }

      for (const campo of [
        'joins',
        'leaves',
        'messages',
        'commands',
        'voiceMinutes',
        'moderationActions',
        'automodActions',
      ]) {
        actual[campo] += lote[campo];
      }
      for (const [canal, cantidad] of lote.canales) {
        actual.canales.set(canal, (actual.canales.get(canal) || 0) + cantidad);
      }
      if (actual.memberCount === null) actual.memberCount = lote.memberCount;
    }
    return 0;
  }
}

module.exports = {
  name: 'dailyStats',
  registrar,
  registrarMiembros,
  volcar,
  hoy,
  pendientes,

  init(client) {
    const timer = setInterval(() => {
      /*
       * Antes de cada volcado se anota el tamaño de cada servidor. Así la
       * curva de miembros tiene datos aunque nadie entre ni salga ese día,
       * que es justo lo que interesa ver en un servidor estancado.
       */
      if (client?.guilds?.cache) {
        for (const guild of client.guilds.cache.values()) {
          registrarMiembros(guild.id, guild.memberCount);
        }
      }
      volcar().catch(() => {});
    }, INTERVALO);
    timer.unref?.();
  },

  /** Vuelca lo que quede al apagar el bot. */
  async onShutdown() {
    await volcar().catch(() => {});
  },
};

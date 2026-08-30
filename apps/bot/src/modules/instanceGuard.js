'use strict';

const os = require('node:os');
const crypto = require('node:crypto');
const { BotInstance } = require('@tkbot/shared');

const logger = require('../utils/logger');

/**
 * Vigilante de instancias duplicadas.
 *
 * Tener el bot encendido en dos sitios con el mismo token es el fallo más
 * confuso que existe al desplegar: Discord reparte los comandos entre ambos y,
 * si cada uno apunta a una base de datos distinta, la mitad de las acciones
 * parecen no funcionar sin dar ningún error.
 *
 * Este módulo anuncia la instancia cada 30 segundos y avisa si detecta otra.
 */

/** Se considera activa una instancia que dio señales hace menos de 90 s. */
const VENTANA_ACTIVA = 90_000;
const INTERVALO = 30_000;

const instanceId = crypto.randomUUID();

/** Etiqueta legible para saber de un vistazo qué instancia es cuál. */
function etiqueta() {
  if (process.env.INSTANCE_LABEL) return process.env.INSTANCE_LABEL;
  // Los contenedores traen estas pistas; si no, se asume que es local.
  if (process.env.EASYPANEL_PROJECT || process.env.EASYPANEL_SERVICE) return 'easypanel';
  if (require('node:fs').existsSync('/.dockerenv')) return 'docker';
  return `local (${os.hostname()})`;
}

/** Lista de otras instancias que han dado señales recientemente. */
async function otrasInstancias() {
  const desde = new Date(Date.now() - VENTANA_ACTIVA);
  return BotInstance.find({ instanceId: { $ne: instanceId }, lastSeen: { $gte: desde } })
    .lean()
    .catch(() => []);
}

/** Escribe la señal de vida de esta instancia. */
async function anunciar(client) {
  try {
    await BotInstance.updateOne(
      { instanceId },
      {
        $set: {
          host: os.hostname(),
          label: etiqueta(),
          lastSeen: new Date(),
          guildCount: client.guilds.cache.size,
          botTag: client.user?.tag || '',
        },
        $setOnInsert: { instanceId, startedAt: new Date() },
      },
      { upsert: true }
    );
  } catch (err) {
    logger.debug(`No se pudo anunciar la instancia: ${err.message}`);
  }
}

/** Aviso destacado cuando hay más de una instancia en marcha. */
function avisar(otras) {
  const lineas = otras.map(
    (i) => `      · ${i.label} (${i.host}) — ${i.guildCount} servidores, desde ${new Date(i.startedAt).toLocaleString('es-ES')}`
  );

  logger.warn('');
  logger.warn('  ==========================================================');
  logger.warn('   ATENCION: hay OTRA instancia del bot en marcha');
  logger.warn('  ==========================================================');
  logger.warn('');
  logger.warn(`   Esta instancia : ${etiqueta()} (${os.hostname()})`);
  logger.warn('   Otras activas  :');
  for (const linea of lineas) logger.warn(linea);
  logger.warn('');
  logger.warn('   Discord repartira los comandos entre todas ellas. Si cada');
  logger.warn('   una usa una base de datos distinta, la mitad de las acciones');
  logger.warn('   pareceran no funcionar: guardaras algo en una y lo leeras de');
  logger.warn('   la otra.');
  logger.warn('');
  logger.warn('   Deja encendida SOLO UNA. Si es la del servidor, cierra la');
  logger.warn('   ventana del bot en tu PC (Ctrl+C).');
  logger.warn('  ==========================================================');
  logger.warn('');
}

module.exports = {
  name: 'instanceGuard',
  instanceId,
  etiqueta,
  otrasInstancias,

  /** Número de instancias activas, incluida esta. Lo usa la API. */
  async contarActivas() {
    const otras = await otrasInstancias();
    return otras.length + 1;
  },

  async onReady(client) {
    await anunciar(client);

    const otras = await otrasInstancias();
    if (otras.length > 0) avisar(otras);

    const timer = setInterval(async () => {
      await anunciar(client);

      // Si aparece otra instancia mientras esta ya estaba en marcha,
      // conviene avisar también: suele pasar al desplegar sin parar la local.
      const activas = await otrasInstancias();
      if (activas.length > 0) avisar(activas);
    }, INTERVALO);

    timer.unref?.();
  },
};

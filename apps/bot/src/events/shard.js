'use strict';

const { Events } = require('discord.js');
const logger = require('../utils/logger');

/**
 * Vigilancia de la conexión con Discord.
 *
 * Sirve sobre todo para detectar **dos bots con el mismo token**, que es el
 * fallo más desconcertante que se puede tener: los comandos responden a veces
 * sí y a veces no, sin ningún error en los registros.
 *
 * El módulo `instanceGuard` ya lo detecta, pero solo cuando ambas instancias
 * comparten base de datos. En el caso más habitual —uno en el PC contra la
 * base local y otro en el servidor contra la suya— son invisibles la una para
 * la otra. Discord sí lo nota: expulsa a una sesión cuando la otra se conecta,
 * y las dos entran en un bucle de reconexión.
 *
 * Aquí se cuentan esas reconexiones. Si se repiten en poco rato, se avisa con
 * todas las letras de lo que casi seguro está pasando.
 */

/** Reconexiones que hacen sospechar, dentro de la ventana. */
const RECONEXIONES_SOSPECHOSAS = 3;

/** Ventana en la que se cuentan las reconexiones. */
const VENTANA = 120_000;

/** Marcas de tiempo de las reconexiones recientes. */
const reconexiones = [];

/** Para no repetir el mismo aviso cada pocos segundos. */
let ultimoAviso = 0;

/**
 * Anota una reconexión y avisa si el patrón huele a conflicto de token.
 * @param {string} motivo Qué la ha provocado, para el mensaje.
 */
function anotarReconexion(motivo) {
  const ahora = Date.now();

  // Solo cuentan las recientes: un corte de red al mes no es un patrón.
  while (reconexiones.length > 0 && ahora - reconexiones[0] > VENTANA) {
    reconexiones.shift();
  }
  reconexiones.push(ahora);

  if (reconexiones.length < RECONEXIONES_SOSPECHOSAS) return;
  // Un aviso cada cinco minutos como mucho.
  if (ahora - ultimoAviso < 300_000) return;

  ultimoAviso = ahora;

  logger.error('═══════════════════════════════════════════════════════════');
  logger.error(`El bot se ha reconectado ${reconexiones.length} veces en dos minutos (${motivo}).`);
  logger.error('');
  logger.error('Esto casi siempre significa que hay OTRO BOT ENCENDIDO CON EL MISMO TOKEN.');
  logger.error('Discord solo admite una sesión por token: cada instancia echa a la otra,');
  logger.error('y los comandos responden solo a veces («La aplicación no ha respondido»).');
  logger.error('');
  logger.error('Deja encendida SOLO UNA:');
  logger.error('  · Si usas el servidor, cierra el bot de tu PC con Ctrl+C.');
  logger.error('  · Si pruebas en tu PC, para el servicio del bot en el panel.');
  logger.error('═══════════════════════════════════════════════════════════');
}

module.exports = [
  {
    name: Events.ShardDisconnect,

    async execute(client, closeEvent, shardId) {
      /*
       * 4004 es token inválido: no tiene arreglo reconectando, así que se
       * distingue del resto para no mandar a nadie a buscar bots duplicados
       * cuando el problema es que el token está mal.
       */
      if (closeEvent?.code === 4004) {
        logger.error('Discord ha rechazado el token (4004). Revisa DISCORD_TOKEN en el .env.');
        return;
      }

      logger.debug(`Shard ${shardId} desconectada (código ${closeEvent?.code ?? 'desconocido'}).`);
      anotarReconexion(`código ${closeEvent?.code ?? '?'}`);
    },
  },

  {
    name: Events.ShardReconnecting,

    async execute(client, shardId) {
      logger.debug(`Shard ${shardId} reconectando…`);
    },
  },

  {
    name: Events.ShardResume,

    async execute(client, shardId, replayed) {
      logger.debug(`Shard ${shardId} reanudada (${replayed} eventos recuperados).`);
    },
  },

  {
    name: Events.ShardError,

    async execute(client, error, shardId) {
      logger.error(`Error en la shard ${shardId}: ${error.message}`);
    },
  },

  {
    name: Events.Invalidated,

    async execute() {
      /*
       * La sesión ha quedado invalidada sin posibilidad de reanudarla. La
       * causa típica es justo la que se explica arriba: otra instancia con el
       * mismo token. Aquí sí se avisa a la primera, porque no es normal.
       */
      logger.error('═══════════════════════════════════════════════════════════');
      logger.error('Discord ha invalidado la sesión de este bot.');
      logger.error('');
      logger.error('Lo habitual es que se haya conectado OTRO BOT CON EL MISMO TOKEN');
      logger.error('y le haya quitado la sesión a este. Deja encendido solo uno.');
      logger.error('═══════════════════════════════════════════════════════════');
    },
  },
];

'use strict';

const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const { connect, repararIndicesTTL, models } = require('@tkbot/shared');
const TKClient = require('./structures/TKClient');
const logger = require('./utils/logger');
const startApi = require('./api/server');
const { reportError } = require('./utils/alerts');

/** Comprueba que estén las variables de entorno imprescindibles. */
function checkEnvironment() {
  const missing = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'MONGODB_URI'].filter(
    (key) => !process.env[key]
  );
  if (missing.length > 0) {
    logger.error(`Faltan variables de entorno: ${missing.join(', ')}`);
    logger.error('Copia .env.example a .env y rellena los valores antes de arrancar.');
    process.exit(1);
  }
}

async function main() {
  checkEnvironment();

  logger.info('Conectando a MongoDB...');
  await connect(process.env.MONGODB_URI);
  logger.ready('MongoDB conectado');

  /*
   * Repara los índices de caducidad si se quedaron mal de una versión
   * anterior. MongoDB no deja cambiar las opciones de un índice existente, así
   * que uno creado sin caducidad se queda así para siempre y su colección
   * crece sin parar. No corta el arranque si falla.
   */
  const indices = await repararIndicesTTL(models, (mensaje) => logger.warn(mensaje)).catch(
    (err) => {
      logger.debug(`No se pudieron revisar los índices: ${err.message}`);
      return null;
    }
  );

  if (indices?.fallos.length > 0) {
    logger.debug(`Índices con problemas: ${indices.fallos.join(' · ')}`);
  }

  const client = new TKClient();

  // La API interna deja que el panel consulte servidores y refresque la caché.
  startApi(client);

  await client.start(process.env.DISCORD_TOKEN);
  return client;
}

/** Cierre ordenado ante Ctrl+C o parada del servicio. */
function registerShutdown(getClient) {
  let closing = false;
  const shutdown = async (signal) => {
    if (closing) return;
    closing = true;
    logger.warn(`Recibido ${signal}, cerrando...`);
    try {
      const client = getClient();

      // Los módulos pueden tener datos pendientes de guardar (por ejemplo el
      // contador de comandos, que se vuelca por lotes).
      if (client) {
        for (const [nombre, mod] of client.modules) {
          if (typeof mod.onShutdown !== 'function') continue;
          try {
            await mod.onShutdown(client);
          } catch (err) {
            logger.debug(`Error al cerrar el módulo ${nombre}: ${err.message}`);
          }
        }
        await client.destroy();
      }

      const { disconnect } = require('@tkbot/shared');
      await disconnect();
    } catch (err) {
      logger.error('Error durante el cierre:', err.message);
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

let clientRef = null;
registerShutdown(() => clientRef);

// Un fallo aislado no debe tumbar el bot entero.
process.on('unhandledRejection', (reason) => {
  logger.error('Promesa sin gestionar:', reason);
  reportError('Promesa sin gestionar', reason).catch(() => {});
});
process.on('uncaughtException', (err) => {
  logger.error('Excepción no capturada:', err);
  reportError('Excepción no capturada', err).catch(() => {});
});

/** Traduce los fallos de arranque más habituales a un mensaje accionable. */
function explainStartupError(err) {
  const code = err?.code;
  const message = String(err?.message || '');

  if (code === 'TokenInvalid') {
    return [
      'El token de Discord no es válido.',
      'Copia uno nuevo desde https://discord.com/developers/applications',
      '(pestaña Bot → Reset Token) y pégalo en DISCORD_TOKEN dentro del .env',
    ];
  }
  if (code === 'DisallowedIntents' || /disallowed intents/i.test(message)) {
    return [
      'Faltan los intents privilegiados.',
      'En https://discord.com/developers/applications, pestaña Bot,',
      'activa SERVER MEMBERS INTENT y MESSAGE CONTENT INTENT, y reinicia el bot.',
    ];
  }
  if (/ECONNREFUSED|ETIMEDOUT|ServerSelectionError/i.test(`${code} ${message}`)) {
    return [
      'No se ha podido conectar con MongoDB.',
      'Comprueba que la base de datos esté en marcha y que MONGODB_URI sea correcto.',
    ];
  }
  return null;
}

main()
  .then((client) => {
    clientRef = client;
  })
  .catch((err) => {
    const explanation = explainStartupError(err);

    if (explanation) {
      // Errores conocidos: mensaje claro, sin volcar la pila.
      for (const line of explanation) logger.error(line);
    } else {
      logger.error('No se pudo arrancar el bot:', err);
    }
    process.exit(1);
  });

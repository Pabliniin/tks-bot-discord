'use strict';

const { ActivityType, Events } = require('discord.js');
const logger = require('../utils/logger');

/** Rota el estado del bot cada 5 minutos. */
function startPresenceRotation(client) {
  const states = [
    () => ({ name: `${client.guilds.cache.size} servidores`, type: ActivityType.Watching }),
    () => ({ name: '/help | tkbot.gg', type: ActivityType.Listening }),
    () => ({
      name: `${client.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0)} usuarios`,
      type: ActivityType.Watching,
    }),
  ];

  let index = 0;
  const update = () => {
    try {
      client.user.setPresence({ activities: [states[index % states.length]()], status: 'online' });
      index += 1;
    } catch (err) {
      logger.debug('No se pudo actualizar la presencia:', err.message);
    }
  };

  update();
  const timer = setInterval(update, 300_000);
  timer.unref?.();
}

module.exports = {
  // `Events.ClientReady` resuelve al nombre correcto según la versión de discord.js.
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    logger.ready(`Conectado como ${client.user.tag}`);
    logger.ready(
      `${client.guilds.cache.size} servidores · ${client.commands.size} comandos · ${client.modules.size} módulos`
    );

    startPresenceRotation(client);

    // En despliegues con contenedores (Easypanel, Docker) no hay una terminal
    // cómoda donde lanzar `npm run deploy:global`. Con AUTO_DEPLOY_COMMANDS=true
    // los comandos de barra se registran solos en cada arranque.
    if (process.env.AUTO_DEPLOY_COMMANDS === 'true') {
      try {
        const data = client.slashCommandData();
        const registered = await client.application.commands.set(data);
        logger.ready(`${registered.size} comandos de barra registrados globalmente`);
        logger.info('Pueden tardar hasta 1 hora en aparecer en todos los servidores.');
      } catch (err) {
        logger.error('No se pudieron registrar los comandos de barra:', err.message);
        logger.error('Los comandos con prefijo seguirán funcionando.');
      }
    }

    // Cada módulo puede engancharse aquí para tareas que necesitan la caché lista.
    for (const [name, mod] of client.modules) {
      if (typeof mod.onReady === 'function') {
        try {
          await mod.onReady(client);
        } catch (err) {
          logger.error(`Error en onReady del módulo ${name}:`, err.message);
        }
      }
    }
  },
};

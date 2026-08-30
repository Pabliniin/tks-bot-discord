'use strict';

const { Events } = require('discord.js');
const logger = require('../utils/logger');

/**
 * Reacciones: alimentan el Starboard y los paneles de roles por reacción.
 *
 * Las reacciones sobre mensajes antiguos llegan parciales, así que hay que
 * pedir los datos completos antes de usarlos.
 */

/** Completa una reacción parcial. Devuelve `false` si no se pudo. */
async function ensureComplete(reaction) {
  if (!reaction.partial) return true;
  try {
    await reaction.fetch();
    return true;
  } catch {
    return false;
  }
}

/** Prepara el contexto común de ambos eventos. */
async function prepare(client, reaction, user) {
  if (user.bot) return null;
  if (!(await ensureComplete(reaction))) return null;

  const guild = reaction.message.guild;
  if (!guild) return null;

  try {
    const settings = await client.settings.get(guild.id);
    return { guild, settings };
  } catch {
    return null;
  }
}

module.exports = [
  {
    name: Events.MessageReactionAdd,
    async execute(client, reaction, user) {
      const context = await prepare(client, reaction, user);
      if (!context) return;

      const starboard = client.modules.get('starboard');
      if (starboard) {
        await starboard.handleReaction(client, reaction, context.settings).catch((err) => {
          logger.error('Error en Starboard:', err.message);
        });
      }

      const selfroles = client.modules.get('selfroles');
      if (selfroles) {
        await selfroles
          .handleReaction(client, reaction, user, context.settings, true)
          .catch((err) => logger.error('Error en roles por reacción:', err.message));
      }
    },
  },

  {
    name: Events.MessageReactionRemove,
    async execute(client, reaction, user) {
      const context = await prepare(client, reaction, user);
      if (!context) return;

      const starboard = client.modules.get('starboard');
      if (starboard) {
        await starboard.handleReaction(client, reaction, context.settings).catch(() => {});
      }

      const selfroles = client.modules.get('selfroles');
      if (selfroles) {
        await selfroles
          .handleReaction(client, reaction, user, context.settings, false)
          .catch((err) => logger.error('Error en roles por reacción:', err.message));
      }
    },
  },
];

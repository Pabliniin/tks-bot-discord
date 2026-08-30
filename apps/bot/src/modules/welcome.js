'use strict';

const { parseVariables, memberVariables } = require('@tkbot/shared');

const embeds = require('../utils/embeds');
const permissions = require('../utils/permissions');
const { generateWelcomeCard } = require('../canvas/welcomeCard');
const logger = require('../utils/logger');

/**
 * Mensajes de bienvenida y despedida.
 *
 * Ambos comparten toda la lógica: solo cambia qué rama de la configuración se
 * lee (`welcome` o `goodbye`).
 */

/**
 * Construye y envía el mensaje configurado.
 *
 * @param {import('discord.js').GuildMember} member
 * @param {object} config Rama `welcome` o `goodbye` de la configuración.
 * @param {Record<string, unknown>} variables
 * @param {'bienvenida'|'despedida'} kind Para los mensajes de registro.
 */
async function dispatch(member, config, variables, kind) {
  if (!config?.enabled || !config.channelId) return;

  const channel = member.guild.channels.cache.get(config.channelId);
  if (!channel?.isTextBased()) {
    logger.debug(`Canal de ${kind} no encontrado en ${member.guild.id}`);
    return;
  }

  const required = ['ViewChannel', 'SendMessages'];
  if (config.card?.enabled) required.push('AttachFiles');
  if (config.embed?.enabled) required.push('EmbedLinks');

  const missing = permissions.missingChannelPermissions(channel, required);
  if (missing.length > 0) {
    logger.debug(`Faltan permisos para el mensaje de ${kind}: ${missing.join(', ')}`);
    return;
  }

  const payload = {};

  const content = parseVariables(config.message || '', variables);
  if (content) payload.content = content;

  if (config.embed?.enabled) {
    const embed = embeds.buildFromDesign(config.embed, variables);
    if (embed) payload.embeds = [embed];
  }

  if (config.card?.enabled) {
    try {
      const attachment = await generateWelcomeCard({
        avatarUrl: member.user.displayAvatarURL({ extension: 'png', size: 512 }),
        card: config.card,
        variables,
      });
      payload.files = [attachment];
    } catch (err) {
      // Una tarjeta rota no debe impedir el mensaje de texto.
      logger.error(`No se pudo generar la tarjeta de ${kind}:`, err.message);
    }
  }

  if (!payload.content && !payload.embeds && !payload.files) return;

  const sent = await channel.send(payload).catch((err) => {
    logger.debug(`No se pudo enviar el mensaje de ${kind}: ${err.message}`);
    return null;
  });

  if (sent && config.deleteAfter > 0) {
    setTimeout(() => sent.delete().catch(() => {}), config.deleteAfter * 1000).unref?.();
  }
}

module.exports = {
  name: 'welcome',

  /** Mensaje de bienvenida, en el canal y por privado. */
  async handleJoin(client, member, settings, inviter = null) {
    const config = settings.welcome;
    if (!config?.enabled) return;

    const variables = memberVariables(member, { inviter });

    await dispatch(member, config, variables, 'bienvenida');

    if (config.dm?.enabled) {
      const payload = {};
      const content = parseVariables(config.dm.message || '', variables);
      if (content) payload.content = content;

      const embed = embeds.buildFromDesign(config.dm.embed, variables);
      if (embed) payload.embeds = [embed];

      if (payload.content || payload.embeds) {
        // Muchos usuarios tienen los privados cerrados: se ignora el fallo.
        await member.send(payload).catch(() => {});
      }
    }
  },

  /** Mensaje de despedida. */
  async handleLeave(client, member, settings) {
    const config = settings.goodbye;
    if (!config?.enabled) return;

    // Al salir, `memberCount` ya no incluye al miembro.
    const variables = memberVariables(member, { memberCount: member.guild.memberCount });
    await dispatch(member, config, variables, 'despedida');
  },

  // Exportado para el comando de prueba del panel.
  dispatch,
};

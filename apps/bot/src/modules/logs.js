'use strict';

const { EmbedBuilder } = require('discord.js');
const { EMBED_COLORS } = require('@tkbot/shared');

const permissions = require('../utils/permissions');
const logger = require('../utils/logger');

/**
 * Registros del servidor.
 *
 * Los eventos de `src/events/logs/*` construyen su embed y lo entregan aquí;
 * este módulo decide si el evento está activo y a qué canal enviarlo.
 */

/**
 * Lee la configuración de un evento.
 * `logs.events` es un `Map` de mongoose, que se comporta distinto según venga
 * de la base de datos o de un objeto plano.
 */
function eventConfig(settings, eventId) {
  const events = settings?.logs?.events;
  if (!events) return null;
  if (typeof events.get === 'function') return events.get(eventId) || null;
  return events[eventId] || null;
}

/**
 * Canal donde debe registrarse un evento, o `null` si está desactivado.
 * @returns {import('discord.js').TextChannel|null}
 */
function resolveChannel(guild, settings, eventId) {
  if (!settings?.logs?.enabled) return null;

  const config = eventConfig(settings, eventId);
  // Sin configuración propia, el evento se considera desactivado.
  if (!config || config.enabled === false) return null;

  const channelId = config.channelId || settings.logs.defaultChannelId;
  if (!channelId) return null;

  const channel = guild.channels.cache.get(channelId);
  if (!channel?.isTextBased()) return null;

  const missing = permissions.missingChannelPermissions(channel, [
    'ViewChannel',
    'SendMessages',
    'EmbedLinks',
  ]);
  return missing.length > 0 ? null : channel;
}

/** ¿Este canal está excluido de los registros? */
function isIgnoredChannel(settings, channel) {
  if (!channel) return false;
  const ignored = settings?.logs?.ignoredChannels || [];
  return ignored.includes(channel.id) || (channel.parentId && ignored.includes(channel.parentId));
}

/** ¿Este miembro está excluido de los registros? */
function isIgnoredMember(settings, member) {
  if (!member) return false;
  if (settings?.logs?.ignoreBots !== false && member.user?.bot) return true;
  return (settings?.logs?.ignoredRoles || []).some((r) => member.roles?.cache?.has(r));
}

/**
 * Envía un embed al canal de registros del evento.
 * @returns {Promise<import('discord.js').Message|null>}
 */
async function send(guild, settings, eventId, embed) {
  const channel = resolveChannel(guild, settings, eventId);
  if (!channel) return null;

  try {
    return await channel.send({ embeds: [embed] });
  } catch (err) {
    logger.debug(`No se pudo registrar "${eventId}": ${err.message}`);
    return null;
  }
}

/**
 * Crea un embed con el estilo común de los registros.
 * @param {object} options
 * @param {string} options.title
 * @param {string} [options.color] Clave de `EMBED_COLORS`.
 * @param {import('discord.js').User} [options.user] Autor mostrado en la cabecera.
 */
function baseEmbed({ title, color = 'neutral', user = null, description = null }) {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS[color] ?? EMBED_COLORS.neutral)
    .setTitle(title)
    .setTimestamp();

  if (user) {
    embed.setAuthor({
      name: `${user.tag ?? user.username} (${user.id})`,
      iconURL: user.displayAvatarURL?.() ?? undefined,
    });
  }
  if (description) embed.setDescription(description);
  return embed;
}

/**
 * Busca en el registro de auditoría quién ejecutó una acción.
 * Discord solo permite consultarlo con permiso de auditoría y el resultado
 * puede tardar, así que se acepta un margen de 5 segundos.
 *
 * @returns {Promise<import('discord.js').User|null>}
 */
async function findExecutor(guild, auditType, targetId) {
  const me = guild.members.me;
  if (!me?.permissions.has('ViewAuditLog')) return null;

  try {
    const logs = await guild.fetchAuditLogs({ type: auditType, limit: 5 });
    const entry = logs.entries.find(
      (e) =>
        (!targetId || e.target?.id === targetId) &&
        Date.now() - e.createdTimestamp < 5000
    );
    return entry?.executor ?? null;
  } catch {
    return null;
  }
}

module.exports = {
  name: 'logs',
  eventConfig,
  resolveChannel,
  isIgnoredChannel,
  isIgnoredMember,
  send,
  baseEmbed,
  findExecutor,
};

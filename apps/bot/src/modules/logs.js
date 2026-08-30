'use strict';

const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { EMBED_COLORS } = require('@tkbot/shared');

const permissions = require('../utils/permissions');
const logger = require('../utils/logger');

/**
 * Registros del servidor.
 *
 * Los eventos de `src/events/logs/*` construyen su embed y lo entregan aquí;
 * este módulo decide si el evento está activo y a qué canal enviarlo.
 *
 * Todos los registros de acciones siguen el mismo formato, para que se lea de
 * un vistazo **quién** ha hecho **qué** y **a quién**.
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

/** Texto para una persona: mención, nombre e identificador. */
function describeUser(user) {
  if (!user) return 'Desconocido';
  const tag = user.tag ?? user.username ?? 'Desconocido';
  return `<@${user.id}>\n\`${tag}\`\n\`${user.id}\``;
}

/**
 * Embed de una acción: **quién** ha hecho **qué** y **a quién**.
 *
 * Es el formato que usan todos los registros en los que interviene una
 * persona sobre otra (sanciones, roles, apodos, movimientos de voz…).
 *
 * @param {object} options
 * @param {string} options.title Qué ha ocurrido.
 * @param {string} [options.color] Clave de `EMBED_COLORS`.
 * @param {import('discord.js').User|null} [options.executor] Quién lo ha hecho.
 * @param {import('discord.js').User|null} [options.target] A quién afecta.
 * @param {string} [options.detail] Descripción de la acción.
 * @param {Array<{name:string,value:string,inline?:boolean}>} [options.fields]
 * @param {boolean} [options.auditUnavailable] El bot no puede leer la auditoría.
 */
function actionEmbed({
  title,
  color = 'neutral',
  executor = null,
  target = null,
  detail = null,
  fields = [],
  auditUnavailable = false,
}) {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS[color] ?? EMBED_COLORS.neutral)
    .setTitle(title)
    .setTimestamp();

  // La cabecera es siempre QUIÉN lo hizo. Si no se sabe, el afectado.
  const cabecera = executor || target;
  if (cabecera) {
    embed.setAuthor({
      name: `${cabecera.tag ?? cabecera.username} (${cabecera.id})`,
      iconURL: cabecera.displayAvatarURL?.() ?? undefined,
    });
  }

  // La foto grande es la del afectado, para reconocerlo de un vistazo.
  if (target?.displayAvatarURL) {
    embed.setThumbnail(target.displayAvatarURL());
  }

  if (detail) embed.setDescription(detail);

  // Quién y a quién, siempre en el mismo sitio y en el mismo orden.
  if (executor) {
    embed.addFields({ name: '👮 Lo ha hecho', value: describeUser(executor), inline: true });
  } else if (target) {
    embed.addFields({
      name: '👮 Lo ha hecho',
      value: auditUnavailable
        ? 'No se ha podido saber.\n*Falta el permiso «Ver registro de auditoría».*'
        : 'No se ha podido determinar.',
      inline: true,
    });
  }

  if (target) {
    embed.addFields({ name: '🎯 Afectado', value: describeUser(target), inline: true });
  }

  if (fields.length > 0) embed.addFields(fields);

  return embed;
}

/**
 * Busca en el registro de auditoría quién ejecutó una acción.
 *
 * Discord entrega el evento por la pasarela antes de escribir la entrada de
 * auditoría, así que si no aparece a la primera se reintenta tras una pausa
 * corta. Sin esto, muchas acciones aparecerían como «autor desconocido».
 *
 * @param {import('discord.js').Guild} guild
 * @param {number} auditType Tipo de `AuditLogEvent`.
 * @param {string|null} targetId Sobre quién o qué se actuó.
 * @param {object} [options]
 * @param {(entry: object) => boolean} [options.match] Filtro adicional.
 * @returns {Promise<{ executor: object|null, reason: string|null, entry: object|null, unavailable: boolean }>}
 */
async function findAuditEntry(guild, auditType, targetId, options = {}) {
  const me = guild.members.me;
  const vacio = { executor: null, reason: null, entry: null, unavailable: false };

  if (!me?.permissions.has(PermissionsBitField.Flags.ViewAuditLog)) {
    // Sin este permiso nunca se sabrá quién hizo qué: conviene decirlo.
    return { ...vacio, unavailable: true };
  }

  const buscar = async () => {
    const logs = await guild.fetchAuditLogs({ type: auditType, limit: 8 });

    return (
      logs.entries.find((entry) => {
        // Solo entradas recientes: si no, se atribuiría una acción antigua.
        if (Date.now() - entry.createdTimestamp > 10_000) return false;
        if (targetId && entry.target?.id !== targetId) return false;
        if (options.match && !options.match(entry)) return false;
        return true;
      }) ?? null
    );
  };

  try {
    let entry = await buscar();

    // Segundo intento: la auditoría suele tardar un instante en aparecer.
    if (!entry) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      entry = await buscar();
    }

    if (!entry) return vacio;

    return {
      executor: entry.executor ?? null,
      reason: entry.reason ?? null,
      entry,
      unavailable: false,
    };
  } catch (err) {
    logger.debug(`No se pudo leer el registro de auditoría: ${err.message}`);
    return vacio;
  }
}

/**
 * Versión corta cuando solo interesa quién lo hizo.
 * Se mantiene por compatibilidad con el código existente.
 *
 * @returns {Promise<import('discord.js').User|null>}
 */
async function findExecutor(guild, auditType, targetId) {
  const { executor } = await findAuditEntry(guild, auditType, targetId);
  return executor;
}

module.exports = {
  name: 'logs',
  eventConfig,
  resolveChannel,
  isIgnoredChannel,
  isIgnoredMember,
  send,
  baseEmbed,
  actionEmbed,
  describeUser,
  findAuditEntry,
  findExecutor,
};

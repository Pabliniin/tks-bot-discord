'use strict';

const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { EMBED_COLORS } = require('@tkbot/shared');

const filters = require('../utils/automodFilters');
const perms = require('../utils/permissions');
const { createCase } = require('../utils/moderation');
const { formatDuration } = require('../utils/time');
const logger = require('../utils/logger');

/**
 * AutoMod.
 *
 * Cada mensaje pasa por los filtros activos; el primero que se incumple decide
 * la sanción. Las infracciones se cuentan en memoria para poder exigir un
 * número mínimo antes de castigar (`threshold`).
 */

/** Historial reciente por usuario, para anti-spam y anti-duplicados. */
const history = new Map();
/** Infracciones acumuladas: `guildId:userId:filtro` → { count, expires }. */
const strikes = new Map();

const HISTORY_TTL = 60_000;
const STRIKE_TTL = 300_000;

/** Limpia periódicamente las estructuras en memoria. */
function startCleanup() {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of history) {
      if (now - entry.lastAt > HISTORY_TTL) history.delete(key);
    }
    for (const [key, entry] of strikes) {
      if (now > entry.expires) strikes.delete(key);
    }
  }, 60_000);
  timer.unref?.();
}

/** Registra el mensaje y devuelve el historial reciente del usuario. */
function trackMessage(guildId, userId, content) {
  const key = `${guildId}:${userId}`;
  const now = Date.now();
  const entry = history.get(key) || { times: [], contents: [], lastAt: now };

  entry.times = entry.times.filter((t) => now - t < HISTORY_TTL);
  entry.times.push(now);
  entry.contents.push(String(content || ''));
  if (entry.contents.length > 5) entry.contents.shift();
  entry.lastAt = now;

  history.set(key, entry);
  return entry;
}

/** Suma una infracción y dice si se alcanzó el umbral configurado. */
function addStrike(guildId, userId, filterId, threshold) {
  if (threshold <= 1) return true;

  const key = `${guildId}:${userId}:${filterId}`;
  const now = Date.now();
  const entry = strikes.get(key);

  if (!entry || now > entry.expires) {
    strikes.set(key, { count: 1, expires: now + STRIKE_TTL });
    return 1 >= threshold;
  }

  entry.count += 1;
  entry.expires = now + STRIKE_TTL;
  return entry.count >= threshold;
}

/** Códigos de invitación activos del propio servidor (para permitirlos). */
async function ownInviteCodes(guild) {
  if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageGuild)) return [];
  try {
    const invites = await guild.invites.fetch();
    return invites.map((i) => i.code);
  } catch {
    return [];
  }
}

/**
 * Evalúa todos los filtros activos.
 * @returns {Promise<{ id: string, reason: string, config: object }|null>}
 */
async function evaluate(message, settings) {
  const automod = settings.automod;
  const options = automod.options || {};
  const content = message.content || '';

  /** Devuelve la configuración de un filtro si está activo. */
  const active = (id) => {
    const config = automod.filters?.[id];
    if (!config?.enabled) return null;
    if ((config.ignoredChannels || []).includes(message.channel.id)) return null;
    if ((config.ignoredRoles || []).some((r) => message.member?.roles.cache.has(r))) return null;
    return config;
  };

  let config;

  if ((config = active('invites'))) {
    const codes = options.allowOwnInvites ? await ownInviteCodes(message.guild) : [];
    if (filters.hasInvite(content, { allowOwnInvites: options.allowOwnInvites, guildInviteCodes: codes })) {
      return { id: 'invites', reason: 'Invitación a otro servidor', config };
    }
  }

  if ((config = active('links')) && filters.hasLink(content, options.allowedLinks)) {
    return { id: 'links', reason: 'Enlace no permitido', config };
  }

  if ((config = active('words'))) {
    const word = filters.findBannedWord(content, options.bannedWords);
    if (word) return { id: 'words', reason: `Palabra prohibida (${word})`, config };
  }

  if (
    (config = active('caps')) &&
    filters.hasExcessiveCaps(content, options.capsPercentage, options.capsMinLength)
  ) {
    return { id: 'caps', reason: 'Exceso de mayúsculas', config };
  }

  if ((config = active('mentions')) && filters.hasExcessiveMentions(content, options.maxMentions)) {
    return { id: 'mentions', reason: 'Demasiadas menciones', config };
  }

  if ((config = active('emojis')) && filters.hasExcessiveEmojis(content, options.maxEmojis)) {
    return { id: 'emojis', reason: 'Demasiados emojis', config };
  }

  if ((config = active('zalgo')) && filters.isZalgo(content)) {
    return { id: 'zalgo', reason: 'Texto deformado (zalgo)', config };
  }

  if ((config = active('newlines')) && filters.hasExcessiveNewlines(content, options.maxNewlines)) {
    return { id: 'newlines', reason: 'Demasiados saltos de línea', config };
  }

  if ((config = active('attachments')) && message.attachments.size > 0) {
    return { id: 'attachments', reason: 'Archivo adjunto no permitido', config };
  }

  // Los dos siguientes necesitan el historial del usuario.
  const recent = trackMessage(message.guild.id, message.author.id, content);

  if ((config = active('spam'))) {
    const window = (options.spamInterval || 5) * 1000;
    const limit = options.spamMessages || 5;
    const inWindow = recent.times.filter((t) => Date.now() - t < window).length;
    if (inWindow > limit) {
      return { id: 'spam', reason: 'Envío de mensajes demasiado rápido', config };
    }
  }

  if ((config = active('duplicates')) && content.trim().length > 0) {
    const previous = recent.contents.slice(0, -1);
    if (previous.length > 0 && previous[previous.length - 1] === content) {
      return { id: 'duplicates', reason: 'Mensaje duplicado', config };
    }
  }

  return null;
}

/** Aplica la sanción configurada para el filtro incumplido. */
async function punish(client, message, settings, violation) {
  const { config, reason, id } = violation;
  const member = message.member;
  const action = config.action || 'delete';

  if (config.deleteMessage !== false && message.deletable) {
    await message.delete().catch(() => {});
  }

  // Aviso opcional en el canal, que se borra a los 8 segundos.
  if (config.warnMessage) {
    const warning = await message.channel
      .send({ content: `${member}, ${config.warnMessage}` })
      .catch(() => null);
    if (warning) setTimeout(() => warning.delete().catch(() => {}), 8000).unref?.();
  }

  if (action === 'none' || action === 'delete') return;
  if (!member) return;

  const botCheck = perms.botCanModerate(message.guild, member);
  if (!botCheck.ok) {
    logger.debug(`AutoMod no pudo sancionar a ${member.id}: ${botCheck.reason}`);
    return;
  }

  const fullReason = `[AutoMod] ${reason}`;
  const durationMs = (config.duration || 10) * 60_000;

  try {
    switch (action) {
      case 'warn':
        await createCase(
          message.guild,
          { type: 'warn', user: member.user, moderator: client.user, reason: fullReason },
          settings
        );
        break;
      case 'timeout':
      case 'mute':
        // Discord limita el aislamiento a 28 días.
        await member.timeout(Math.min(durationMs, 2_419_200_000), fullReason);
        await createCase(
          message.guild,
          {
            type: 'timeout',
            user: member.user,
            moderator: client.user,
            reason: fullReason,
            duration: durationMs,
          },
          settings
        );
        break;
      case 'kick':
        await member.kick(fullReason);
        await createCase(
          message.guild,
          { type: 'kick', user: member.user, moderator: client.user, reason: fullReason },
          settings
        );
        break;
      case 'ban':
        await member.ban({ reason: fullReason, deleteMessageSeconds: 3600 });
        await createCase(
          message.guild,
          { type: 'ban', user: member.user, moderator: client.user, reason: fullReason },
          settings
        );
        break;
      default:
        break;
    }
  } catch (err) {
    logger.error(`AutoMod no pudo aplicar "${action}":`, err.message);
  }

  await sendLog(message, settings, violation, action, durationMs).catch(() => {});
}

/** Envía el registro de la acción al canal de logs del AutoMod. */
async function sendLog(message, settings, violation, action, durationMs) {
  const channelId = settings.automod.logChannelId || settings.logs?.defaultChannelId;
  if (!channelId) return;

  const channel = message.guild.channels.cache.get(channelId);
  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.error)
    .setAuthor({
      name: `${message.author.tag} (${message.author.id})`,
      iconURL: message.author.displayAvatarURL(),
    })
    .setTitle('🤖 AutoMod')
    .addFields(
      { name: 'Filtro', value: violation.id, inline: true },
      { name: 'Acción', value: action, inline: true },
      { name: 'Canal', value: `${message.channel}`, inline: true },
      { name: 'Motivo', value: violation.reason }
    )
    .setTimestamp();

  if (['timeout', 'mute'].includes(action)) {
    embed.addFields({ name: 'Duración', value: formatDuration(durationMs), inline: true });
  }

  const content = (message.content || '').slice(0, 1000);
  if (content) embed.addFields({ name: 'Mensaje', value: `\`\`\`${content}\`\`\`` });

  await channel.send({ embeds: [embed] });
}

module.exports = {
  name: 'automod',

  init() {
    startCleanup();
  },

  /**
   * Revisa un mensaje.
   * @returns {Promise<boolean>} `true` si se actuó sobre el mensaje.
   */
  async handleMessage(client, message, settings) {
    if (!settings.automod?.enabled) return false;
    if (!message.member) return false;

    // Exenciones globales.
    if ((settings.automod.ignoredChannels || []).includes(message.channel.id)) return false;
    if (message.channel.parentId && (settings.automod.ignoredChannels || []).includes(message.channel.parentId)) {
      return false;
    }
    if ((settings.automod.ignoredRoles || []).some((r) => message.member.roles.cache.has(r))) {
      return false;
    }
    if (settings.automod.exemptModerators !== false && perms.isModerator(message.member, settings)) {
      return false;
    }

    const violation = await evaluate(message, settings);
    if (!violation) return false;

    const threshold = violation.config.threshold || 1;
    const reached = addStrike(message.guild.id, message.author.id, violation.id, threshold);

    if (!reached) {
      // Aún no toca sancionar, pero el mensaje sí se borra si procede.
      if (violation.config.deleteMessage !== false && message.deletable) {
        await message.delete().catch(() => {});
        return true;
      }
      return false;
    }

    strikes.delete(`${message.guild.id}:${message.author.id}:${violation.id}`);
    await punish(client, message, settings, violation);
    return true;
  },

  // Exportado para las pruebas.
  evaluate,
};

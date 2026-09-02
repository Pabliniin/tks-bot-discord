'use strict';

const { EmbedBuilder } = require('discord.js');
const { Case, Member } = require('@tkbot/shared');

const { EMBED_COLORS } = require('@tkbot/shared');
const { formatDuration, discordTimestamp } = require('./time');
const logger = require('./logger');

/** Etiquetas en español y color de cada tipo de sanción. */
const ACTION_META = {
  ban: { label: 'Baneo', emoji: '🔨', color: EMBED_COLORS.error },
  unban: { label: 'Desbaneo', emoji: '♻️', color: EMBED_COLORS.success },
  softban: { label: 'Softban', emoji: '🧹', color: EMBED_COLORS.error },
  kick: { label: 'Expulsión', emoji: '👢', color: EMBED_COLORS.warning },
  vkick: { label: 'Expulsión de voz', emoji: '🔇', color: EMBED_COLORS.warning },
  warn: { label: 'Advertencia', emoji: '⚠️', color: EMBED_COLORS.warning },
  timeout: { label: 'Aislamiento', emoji: '⏳', color: EMBED_COLORS.warning },
  untimeout: { label: 'Fin del aislamiento', emoji: '✅', color: EMBED_COLORS.success },
  mute: { label: 'Silenciado', emoji: '🔕', color: EMBED_COLORS.warning },
  unmute: { label: 'Sin silencio', emoji: '🔔', color: EMBED_COLORS.success },
  vmute: { label: 'Silenciado en voz', emoji: '🎙️', color: EMBED_COLORS.warning },
  vunmute: { label: 'Sin silencio en voz', emoji: '🎙️', color: EMBED_COLORS.success },
  clear: { label: 'Mensajes eliminados', emoji: '🧹', color: EMBED_COLORS.neutral },
  points: { label: 'Puntos', emoji: '🔢', color: EMBED_COLORS.neutral },
  automod: { label: 'AutoMod', emoji: '🤖', color: EMBED_COLORS.error },
};

/**
 * Siguiente número de caso del servidor.
 * Se lee el último caso en vez de guardar un contador aparte para que el
 * histórico siga siendo correcto aunque se borren documentos.
 */
async function nextCaseId(guildId) {
  const last = await Case.findOne({ guildId }).sort({ caseId: -1 }).select('caseId').lean();
  return (last?.caseId || 0) + 1;
}

/**
 * Registra una sanción y la envía al canal de logs.
 *
 * @param {import('discord.js').Guild} guild
 * @param {object} data
 * @param {string} data.type Tipo de sanción.
 * @param {import('discord.js').User} data.user Sancionado.
 * @param {import('discord.js').User} data.moderator Quién sanciona.
 * @param {string} [data.reason]
 * @param {number|null} [data.duration] Duración en ms para sanciones temporales.
 * @param {object} [settings] Configuración del servidor (para el canal de logs).
 * @returns {Promise<object>} El caso creado.
 */
async function createCase(guild, data, settings = null) {
  const caseId = await nextCaseId(guild.id);
  const reason = (data.reason || 'Sin razón especificada').slice(0, 1000);
  const duration = Number.isFinite(data.duration) ? data.duration : null;

  const doc = await Case.create({
    guildId: guild.id,
    caseId,
    type: data.type,
    userId: data.user.id,
    userTag: data.user.tag ?? data.user.username,
    moderatorId: data.moderator.id,
    moderatorTag: data.moderator.tag ?? data.moderator.username,
    reason,
    duration,
    expiresAt: duration ? new Date(Date.now() + duration) : null,
  });

  /*
   * Contador diario de moderación, para la gráfica del panel. Se hace aquí
   * porque `createCase` es el único punto por el que pasan todas las
   * sanciones, vengan de un comando o del AutoMod.
   */
  guild.client?.modules?.get('dailyStats')?.registrar(guild.id, 'moderationActions');

  // Las advertencias llevan contador propio para consultarlo rápido.
  if (data.type === 'warn') {
    await Member.updateOne(
      { guildId: guild.id, userId: data.user.id },
      { $inc: { warnCount: 1 }, $setOnInsert: { guildId: guild.id, userId: data.user.id } },
      { upsert: true }
    );
  }

  await sendModerationLog(guild, doc, settings).catch((err) =>
    logger.debug('No se pudo enviar el log de moderación:', err.message)
  );

  return doc;
}

/** Construye el embed del registro de una sanción. */
function buildCaseEmbed(caseDoc) {
  const meta = ACTION_META[caseDoc.type] || {
    label: caseDoc.type,
    emoji: '📌',
    color: EMBED_COLORS.neutral,
  };

  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setAuthor({ name: `${meta.emoji} ${meta.label} · Caso #${caseDoc.caseId}` })
    .addFields(
      { name: 'Usuario', value: `<@${caseDoc.userId}>\n\`${caseDoc.userId}\``, inline: true },
      { name: 'Moderador', value: `<@${caseDoc.moderatorId}>`, inline: true }
    )
    .setTimestamp(caseDoc.createdAt || new Date());

  if (caseDoc.duration) {
    embed.addFields({
      name: 'Duración',
      value: `${formatDuration(caseDoc.duration)}\nExpira ${discordTimestamp(caseDoc.expiresAt, 'R')}`,
      inline: true,
    });
  }

  embed.addFields({ name: 'Razón', value: caseDoc.reason || 'Sin razón especificada' });
  return embed;
}

/** Envía el caso al canal de logs de moderación si está configurado. */
async function sendModerationLog(guild, caseDoc, settings) {
  if (!settings?.logs?.enabled) return;

  const events = settings.logs.events;
  const config = typeof events?.get === 'function' ? events.get('moderation') : events?.moderation;
  if (config && config.enabled === false) return;

  const channelId = config?.channelId || settings.logs.defaultChannelId;
  if (!channelId) return;

  const channel = guild.channels.cache.get(channelId);
  if (!channel?.isTextBased()) return;

  const message = await channel.send({ embeds: [buildCaseEmbed(caseDoc)] });
  // Guardar el ID permite editar el registro si el caso cambia.
  await Case.updateOne({ _id: caseDoc._id }, { logMessageId: message.id }).catch(() => {});
}

/**
 * Enlace público para apelar una sanción, si el servidor lo tiene activado.
 *
 * El enlace NO lleva el número de caso a propósito. El aviso privado se manda
 * antes de banear (después ya no se puede escribir al usuario), y en ese
 * momento el caso todavía no existe. La página identifica al usuario con su
 * cuenta de Discord y busca su sanción, lo que además impide que nadie apele
 * en nombre de otro cambiando un número en la barra de direcciones.
 *
 * @param {object} settings Configuración del servidor.
 * @param {string} guildId
 * @param {string} type Tipo de sanción.
 * @returns {string|null}
 */
function appealUrl(settings, guildId, type) {
  if (!settings?.appeals?.enabled) return null;

  // Cada servidor decide qué sanciones admiten apelación: no tiene sentido
  // apelar el borrado de unos mensajes.
  const permitidos = settings.appeals.types || [];
  if (permitidos.length > 0 && !permitidos.includes(type)) return null;

  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) return null;

  return `${site.replace(/\/$/, '')}/apelar/${guildId}`;
}

/**
 * Avisa por privado al usuario sancionado.
 * Falla en silencio: mucha gente tiene los mensajes privados cerrados.
 *
 * @param {import('discord.js').User} user
 * @param {import('discord.js').Guild} guild
 * @param {string} type
 * @param {string} reason
 * @param {number|null} [duration]
 * @param {object} [settings] Configuración del servidor, para el enlace de apelación.
 */
async function notifyUser(user, guild, type, reason, duration = null, settings = null) {
  const meta = ACTION_META[type] || { label: type, emoji: '📌', color: EMBED_COLORS.neutral };

  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setTitle(`${meta.emoji} ${meta.label}`)
    .setDescription(`Has recibido una sanción en **${guild.name}**.`)
    .addFields({ name: 'Razón', value: reason || 'Sin razón especificada' })
    .setTimestamp();

  if (duration) {
    embed.addFields({ name: 'Duración', value: formatDuration(duration), inline: true });
  }

  /*
   * El enlace de apelación va en el propio aviso porque es el único momento en
   * que se puede llegar a alguien a quien acabas de banear: después ya no está
   * en el servidor y no hay forma de escribirle.
   */
  const url = appealUrl(settings, guild.id, type);
  if (url) {
    embed.addFields({
      name: '📝 ¿Crees que es un error?',
      value: `Puedes explicar tu versión aquí:\n${url}`,
    });
  }

  try {
    await user.send({ embeds: [embed] });
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  ACTION_META,
  nextCaseId,
  createCase,
  buildCaseEmbed,
  sendModerationLog,
  notifyUser,
  appealUrl,
};

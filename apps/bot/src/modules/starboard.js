'use strict';

const { EmbedBuilder } = require('discord.js');
const { StarboardMessage } = require('@tkbot/shared');

const { parseColor } = require('../utils/embeds');
const permissions = require('../utils/permissions');
const logger = require('../utils/logger');

/**
 * Starboard: destaca los mensajes que reciben suficientes reacciones.
 */

/** Texto del emoji de una reacción, comparable con el configurado. */
function reactionKey(reaction) {
  return reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;
}

/** ¿Coincide la reacción con el emoji configurado? */
function isStarEmoji(reaction, configured) {
  const key = reactionKey(reaction);
  if (key === configured) return true;
  // Permite configurar solo el nombre del emoji personalizado.
  return Boolean(reaction.emoji.id) && configured.includes(String(reaction.emoji.id));
}

/** Construye el embed del mensaje destacado. */
function buildEmbed(message, settings) {
  const embed = new EmbedBuilder()
    .setColor(parseColor(settings.starboard.color, 0xfaa81a))
    .setAuthor({
      name: message.author?.tag ?? 'Desconocido',
      iconURL: message.author?.displayAvatarURL(),
    })
    .setTimestamp(message.createdAt)
    .addFields({ name: '​', value: `[Ir al mensaje](${message.url})` });

  if (message.content) embed.setDescription(message.content.slice(0, 4000));

  // Adjunta la primera imagen del mensaje, si la hay.
  const image = message.attachments.find((a) => a.contentType?.startsWith('image/'));
  if (image) embed.setImage(image.url);

  return embed;
}

module.exports = {
  name: 'starboard',

  /** Recalcula el estado de un mensaje al añadirse o quitarse una reacción. */
  async handleReaction(client, reaction, settings) {
    const config = settings.starboard;
    if (!config?.enabled || !config.channelId) return;

    const message = reaction.message;
    const guild = message.guild;
    if (!guild) return;

    if (!isStarEmoji(reaction, config.emoji || '⭐')) return;
    if ((config.ignoredChannels || []).includes(message.channel.id)) return;
    if (!config.allowNsfw && message.channel.nsfw) return;

    // Mensajes parciales: hace falta el contenido para poder copiarlo.
    if (message.partial) {
      try {
        await message.fetch();
      } catch {
        return;
      }
    }

    if (!config.allowBots && message.author?.bot) return;
    if ((config.ignoredRoles || []).some((r) => message.member?.roles.cache.has(r))) return;

    const starboardChannel = guild.channels.cache.get(config.channelId);
    if (!starboardChannel?.isTextBased()) return;

    const missing = permissions.missingChannelPermissions(starboardChannel, [
      'ViewChannel',
      'SendMessages',
      'EmbedLinks',
    ]);
    if (missing.length > 0) return;

    // Cuenta las estrellas descontando al autor si no se permite auto-destacar.
    let count = reaction.count ?? 0;
    if (!config.selfStar && message.author) {
      try {
        const users = await reaction.users.fetch();
        if (users.has(message.author.id)) count -= 1;
      } catch {
        // Si no se puede comprobar, se usa el contador tal cual.
      }
    }

    const threshold = config.threshold || 3;
    const existing = await StarboardMessage.findOne({ guildId: guild.id, messageId: message.id });

    // ── Aún no llega al umbral ─────────────────────────────────
    if (count < threshold) {
      if (existing?.starMessageId) {
        const posted = await starboardChannel.messages
          .fetch(existing.starMessageId)
          .catch(() => null);
        if (posted) await posted.delete().catch(() => {});
        await StarboardMessage.deleteOne({ _id: existing._id });
      }
      return;
    }

    const emoji = config.emoji || '⭐';
    const content = `${emoji} **${count}** · ${message.channel}`;

    // ── Ya estaba publicado: solo actualizar el contador ────────
    if (existing?.starMessageId) {
      const posted = await starboardChannel.messages.fetch(existing.starMessageId).catch(() => null);
      if (posted) {
        await posted.edit({ content, embeds: [buildEmbed(message, settings)] }).catch(() => {});
        await StarboardMessage.updateOne({ _id: existing._id }, { count });
        return;
      }
      // El mensaje destacado fue borrado a mano: se vuelve a publicar.
    }

    try {
      const posted = await starboardChannel.send({
        content,
        embeds: [buildEmbed(message, settings)],
      });

      await StarboardMessage.findOneAndUpdate(
        { guildId: guild.id, messageId: message.id },
        {
          guildId: guild.id,
          messageId: message.id,
          channelId: message.channel.id,
          authorId: message.author?.id ?? null,
          starMessageId: posted.id,
          count,
        },
        { upsert: true }
      );
    } catch (err) {
      logger.error('No se pudo publicar en el starboard:', err.message);
    }
  },
};

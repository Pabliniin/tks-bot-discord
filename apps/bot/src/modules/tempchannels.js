'use strict';

const { ChannelType, PermissionsBitField, MessageFlags } = require('discord.js');
const { TempChannel, parseVariables } = require('@tkbot/shared');

const embeds = require('../utils/embeds');
const logger = require('../utils/logger');

/**
 * Canales de voz temporales.
 *
 * Al entrar en el canal "creador" se genera un canal propio para el usuario,
 * que se elimina automáticamente cuando queda vacío.
 */

/** Evita crear varios canales si el usuario entra y sale muy rápido. */
const creating = new Set();

/** Crea el canal temporal del miembro y lo mueve dentro. */
async function createChannel(client, member, settings) {
  const config = settings.tempchannels;
  const guild = member.guild;

  const key = `${guild.id}:${member.id}`;
  if (creating.has(key)) return;
  creating.add(key);

  try {
    const category = config.categoryId ? guild.channels.cache.get(config.categoryId) : null;
    const hub = guild.channels.cache.get(config.hubChannelId);
    const parent =
      category?.type === ChannelType.GuildCategory ? category.id : hub?.parentId || null;

    const name = parseVariables(config.nameTemplate || 'Canal de [userName]', {
      userName: member.user.username,
      user: member.user.username,
      userTag: member.user.tag,
    }).slice(0, 100);

    const overwrites = [];
    if (config.allowOwnerControls !== false) {
      overwrites.push({
        id: member.id,
        allow: [
          PermissionsBitField.Flags.ManageChannels,
          PermissionsBitField.Flags.MoveMembers,
          PermissionsBitField.Flags.Connect,
        ],
      });
    }

    const channel = await guild.channels.create({
      name: name || `Canal de ${member.user.username}`,
      type: ChannelType.GuildVoice,
      parent,
      userLimit: config.userLimit || 0,
      // La API espera bits por segundo.
      bitrate: Math.min((config.bitrate || 64) * 1000, guild.maximumBitrate),
      permissionOverwrites: overwrites,
      reason: `Canal temporal de ${member.user.tag}`,
    });

    await TempChannel.create({
      guildId: guild.id,
      channelId: channel.id,
      ownerId: member.id,
    });

    // El miembro puede haberse desconectado mientras se creaba el canal.
    if (member.voice.channelId) {
      await member.voice.setChannel(channel).catch(() => {});
    }
  } catch (err) {
    logger.error('No se pudo crear el canal temporal:', err.message);
  } finally {
    creating.delete(key);
  }
}

/** Borra el canal temporal si se ha quedado vacío. */
async function maybeDelete(client, channel, settings) {
  if (!channel) return;

  const record = await TempChannel.findOne({ channelId: channel.id });
  if (!record) return;

  const remove = async () => {
    const current = channel.guild.channels.cache.get(channel.id);
    // Puede haber entrado alguien durante el retardo.
    if (!current || current.members.size > 0) return;
    await current.delete('Canal temporal vacío').catch(() => {});
    await TempChannel.deleteOne({ channelId: channel.id }).catch(() => {});
  };

  const delay = settings.tempchannels?.deleteDelay ?? 5;
  if (delay > 0) {
    setTimeout(() => remove().catch(() => {}), delay * 1000).unref?.();
  } else {
    await remove();
  }
}

module.exports = {
  name: 'tempchannels',
  componentPrefixes: ['tempvoice'],

  async handleVoiceState(client, oldState, newState, settings) {
    const config = settings.tempchannels;
    if (!config?.enabled) return;

    // Entró en el canal creador.
    if (newState.channelId && newState.channelId === config.hubChannelId) {
      await createChannel(client, newState.member, settings);
    }

    // Salió de un canal: puede que haya quedado vacío.
    if (oldState.channelId && oldState.channelId !== newState.channelId) {
      const channel = oldState.channel;
      if (channel && channel.members.size === 0) {
        await maybeDelete(client, channel, settings);
      }
    }
  },

  /** Controles del dueño del canal (`/voice` y botones). */
  async handleComponent(client, interaction, settings) {
    const [, action] = interaction.customId.split(':');

    const channel = interaction.member?.voice?.channel;
    if (!channel) {
      await interaction.reply({
        embeds: [embeds.error('Tienes que estar en tu canal temporal.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const record = await TempChannel.findOne({ channelId: channel.id });
    if (!record || record.ownerId !== interaction.user.id) {
      await interaction.reply({
        embeds: [embeds.error('Solo el dueño del canal puede usar estos controles.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (action === 'lock') {
      await channel.permissionOverwrites
        .edit(interaction.guild.roles.everyone, { Connect: false })
        .catch(() => {});
      record.locked = true;
      await record.save();
      await interaction.reply({
        embeds: [embeds.success('Canal bloqueado. Nadie más puede entrar.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (action === 'unlock') {
      await channel.permissionOverwrites
        .edit(interaction.guild.roles.everyone, { Connect: null })
        .catch(() => {});
      record.locked = false;
      await record.save();
      await interaction.reply({
        embeds: [embeds.success('Canal desbloqueado.')],
        flags: MessageFlags.Ephemeral,
      });
    }
  },

  /** Limpia los canales temporales que quedaron huérfanos tras un reinicio. */
  async onReady(client) {
    const records = await TempChannel.find({}).lean().catch(() => []);
    let removed = 0;

    for (const record of records) {
      const guild = client.guilds.cache.get(record.guildId);
      const channel = guild?.channels.cache.get(record.channelId);

      if (!channel) {
        await TempChannel.deleteOne({ channelId: record.channelId }).catch(() => {});
        removed += 1;
        continue;
      }
      if (channel.members.size === 0) {
        await channel.delete('Canal temporal huérfano').catch(() => {});
        await TempChannel.deleteOne({ channelId: record.channelId }).catch(() => {});
        removed += 1;
      }
    }

    if (removed > 0) logger.module('temp', `${removed} canales temporales limpiados`);
  },
};

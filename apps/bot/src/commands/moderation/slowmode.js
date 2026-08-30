'use strict';

const { SlashCommandBuilder, ChannelType } = require('discord.js');

const { parseDuration, formatDuration } = require('../../utils/time');

/** Discord permite como máximo 6 horas de modo lento. */
const MAX_SLOWMODE = 21_600;

module.exports = {
  name: 'slowmode',
  category: 'moderation',
  aliases: ['modolento', 'lento'],
  description: 'Habilita o deshabilita el modo lento en un canal.',
  usage: '<duración|off> [canal]',
  examples: ['slowmode 10s', 'slowmode 5m #general', 'slowmode off'],
  cooldown: 3,
  userPermissions: ['ManageChannels'],
  botPermissions: ['ManageChannels'],

  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Habilita o deshabilita el modo lento en un canal.')
    .addStringOption((option) =>
      option
        .setName('duracion')
        .setDescription('Tiempo entre mensajes (máx. 6h). Escribe "off" para desactivarlo.')
        .setRequired(true)
    )
    .addChannelOption((option) =>
      option
        .setName('canal')
        .setDescription('Canal donde aplicarlo. Por defecto, el actual.')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildForum, ChannelType.GuildVoice)
        .setRequired(false)
    ),

  async execute(ctx) {
    const input = ctx.options.getString('duracion', true).trim().toLowerCase();
    const channel = ctx.options.getChannel('canal') || ctx.channel;

    if (typeof channel.setRateLimitPerUser !== 'function') {
      await ctx.errorReply('Ese canal no admite modo lento.');
      return;
    }

    // ── Desactivar ───────────────────────────────────────────────
    if (['off', '0', 'no', 'desactivar', 'quitar'].includes(input)) {
      try {
        await channel.setRateLimitPerUser(0, `${ctx.user.tag} desactivó el modo lento`);
      } catch (err) {
        await ctx.errorReply(`No he podido cambiar el modo lento: ${err.message}`);
        return;
      }
      await ctx.successReply(`Modo lento desactivado en ${channel}.`);
      return;
    }

    // Un número suelto se interpreta como segundos, no como minutos.
    const seconds = /^\d+$/.test(input)
      ? Number.parseInt(input, 10)
      : Math.floor((parseDuration(input) ?? 0) / 1000);

    if (!seconds || seconds < 1) {
      await ctx.errorReply(
        'Duración no válida. Usa por ejemplo `10s`, `2m`, `1h`, o `off` para desactivarlo.'
      );
      return;
    }
    if (seconds > MAX_SLOWMODE) {
      await ctx.errorReply('El modo lento no puede superar las **6 horas**.');
      return;
    }

    try {
      await channel.setRateLimitPerUser(seconds, `${ctx.user.tag} activó el modo lento`);
    } catch (err) {
      await ctx.errorReply(`No he podido cambiar el modo lento: ${err.message}`);
      return;
    }

    await ctx.successReply(
      `Modo lento en ${channel}: **${formatDuration(seconds * 1000)}** entre mensajes.`
    );
  },
};

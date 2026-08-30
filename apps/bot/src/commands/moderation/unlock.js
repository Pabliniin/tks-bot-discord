'use strict';

const { SlashCommandBuilder, ChannelType } = require('discord.js');

module.exports = {
  name: 'unlock',
  category: 'moderation',
  aliases: ['desbloquear', 'abrir'],
  description: 'Permite a @everyone hablar en un canal específico.',
  usage: '[canal] [razón]',
  examples: ['unlock', 'unlock #general'],
  cooldown: 3,
  userPermissions: ['ManageChannels'],
  botPermissions: ['ManageChannels'],

  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Permite a @everyone hablar en un canal.')
    .addChannelOption((option) =>
      option
        .setName('canal')
        .setDescription('Canal a desbloquear. Por defecto, el actual.')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum)
        .setRequired(false)
    )
    .addStringOption((option) =>
      option.setName('razon').setDescription('Motivo.').setRequired(false)
    ),

  async execute(ctx) {
    const channel = ctx.options.getChannel('canal') || ctx.channel;
    const reason = ctx.options.getString('razon') || 'Sin razón especificada';

    if (!channel.permissionOverwrites) {
      await ctx.errorReply('Ese canal no admite desbloqueo.');
      return;
    }

    const everyone = ctx.guild.roles.everyone;
    const current = channel.permissionOverwrites.cache.get(everyone.id);

    if (!current?.deny.has('SendMessages')) {
      await ctx.errorReply(`${channel} no está bloqueado.`);
      return;
    }

    try {
      // `null` devuelve el permiso al valor heredado de la categoría.
      await channel.permissionOverwrites.edit(
        everyone,
        { SendMessages: null, SendMessagesInThreads: null, CreatePublicThreads: null },
        { reason: `${ctx.user.tag}: ${reason}` }
      );
    } catch (err) {
      await ctx.errorReply(`No he podido desbloquear el canal: ${err.message}`);
      return;
    }

    await ctx.successReply(`${channel} ha sido desbloqueado.`);

    if (channel.id !== ctx.channel.id) {
      await channel
        .send({ embeds: [require('../../utils/embeds').success('Canal desbloqueado.')] })
        .catch(() => {});
    }
  },
};

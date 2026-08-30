'use strict';

const { SlashCommandBuilder, ChannelType } = require('discord.js');

module.exports = {
  name: 'lock',
  category: 'moderation',
  aliases: ['bloquear', 'cerrar'],
  description: 'Prohíbe a @everyone enviar mensajes en un canal específico.',
  usage: '[canal] [razón]',
  examples: ['lock', 'lock #general limpieza'],
  cooldown: 3,
  userPermissions: ['ManageChannels'],
  botPermissions: ['ManageChannels'],

  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Prohíbe a @everyone enviar mensajes en un canal.')
    .addChannelOption((option) =>
      option
        .setName('canal')
        .setDescription('Canal a bloquear. Por defecto, el actual.')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum)
        .setRequired(false)
    )
    .addStringOption((option) =>
      option.setName('razon').setDescription('Motivo del bloqueo.').setRequired(false)
    ),

  async execute(ctx) {
    const channel = ctx.options.getChannel('canal') || ctx.channel;
    const reason = ctx.options.getString('razon') || 'Sin razón especificada';

    if (!channel.permissionOverwrites) {
      await ctx.errorReply('Ese canal no admite bloqueo.');
      return;
    }

    const everyone = ctx.guild.roles.everyone;
    const current = channel.permissionOverwrites.cache.get(everyone.id);

    // `deny` de SendMessages significa que ya está bloqueado.
    if (current?.deny.has('SendMessages')) {
      await ctx.errorReply(`${channel} ya está bloqueado.`);
      return;
    }

    try {
      await channel.permissionOverwrites.edit(
        everyone,
        { SendMessages: false, SendMessagesInThreads: false, CreatePublicThreads: false },
        { reason: `${ctx.user.tag}: ${reason}` }
      );
    } catch (err) {
      await ctx.errorReply(`No he podido bloquear el canal: ${err.message}`);
      return;
    }

    await ctx.successReply(`${channel} ha sido bloqueado.\n**Razón:** ${reason}`);

    // Aviso dentro del canal bloqueado, si no es donde se ejecutó el comando.
    if (channel.id !== ctx.channel.id) {
      await channel
        .send({
          embeds: [require('../../utils/embeds').warning(`Canal bloqueado.\n**Razón:** ${reason}`)],
        })
        .catch(() => {});
    }
  },
};

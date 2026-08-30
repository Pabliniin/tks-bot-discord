'use strict';

const { SlashCommandBuilder, ChannelType } = require('discord.js');

const perms = require('../../utils/permissions');

module.exports = {
  name: 'move',
  category: 'moderation',
  aliases: ['mover-a', 'moverusuario'],
  description: 'Mueve a un miembro a un canal de voz.',
  usage: '<usuario> <canal>',
  examples: ['move @Rogue General'],
  cooldown: 3,
  userPermissions: ['MoveMembers'],
  botPermissions: ['MoveMembers'],

  data: new SlashCommandBuilder()
    .setName('move')
    .setDescription('Mueve a un miembro a un canal de voz.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('A quién quieres mover.').setRequired(true)
    )
    .addChannelOption((option) =>
      option
        .setName('canal')
        .setDescription('Canal de voz de destino.')
        .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        .setRequired(true)
    ),

  async execute(ctx) {
    const target = ctx.options.getUser('usuario', true);
    const channel = ctx.options.getChannel('canal', true);

    const member = await ctx.guild.members.fetch(target.id).catch(() => null);
    if (!member) {
      await ctx.errorReply('Ese usuario no está en el servidor.');
      return;
    }
    if (!member.voice.channelId) {
      await ctx.errorReply('Ese miembro no está conectado a ningún canal de voz.');
      return;
    }
    if (!channel.isVoiceBased()) {
      await ctx.errorReply('El destino debe ser un canal de voz.');
      return;
    }
    if (member.voice.channelId === channel.id) {
      await ctx.errorReply('Ese miembro ya está en ese canal.');
      return;
    }

    const check = perms.canModerate(ctx.member, member);
    if (!check.ok) {
      await ctx.errorReply(check.reason);
      return;
    }

    // El bot necesita poder ver y conectarse al canal de destino.
    const missing = perms.missingChannelPermissions(channel, ['ViewChannel', 'Connect', 'MoveMembers']);
    if (missing.length > 0) {
      await ctx.errorReply(`Me faltan permisos en ese canal: ${missing.join(', ')}`);
      return;
    }

    try {
      await member.voice.setChannel(channel, `Movido por ${ctx.user.tag}`);
    } catch (err) {
      await ctx.errorReply(`No he podido moverlo: ${err.message}`);
      return;
    }

    await ctx.successReply(`**${target.tag}** ha sido movido a ${channel}.`);
  },
};

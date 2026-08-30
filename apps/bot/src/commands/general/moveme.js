'use strict';

const { SlashCommandBuilder, ChannelType } = require('discord.js');

module.exports = {
  name: 'moveme',
  category: 'general',
  aliases: ['muevame', 'mover'],
  description: 'Te mueve a un canal de voz.',
  usage: '<canal>',
  examples: ['moveme General'],
  cooldown: 5,
  botPermissions: ['MoveMembers'],

  data: new SlashCommandBuilder()
    .setName('moveme')
    .setDescription('Te mueve a un canal de voz.')
    .addChannelOption((option) =>
      option
        .setName('canal')
        .setDescription('Canal de voz al que quieres ir.')
        .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        .setRequired(true)
    ),

  async execute(ctx) {
    const channel = ctx.options.getChannel('canal', true);

    if (!ctx.member.voice.channelId) {
      await ctx.errorReply('Tienes que estar conectado a un canal de voz.');
      return;
    }
    if (ctx.member.voice.channelId === channel.id) {
      await ctx.errorReply('Ya estás en ese canal.');
      return;
    }
    if (!channel.isVoiceBased()) {
      await ctx.errorReply('Ese canal no es de voz.');
      return;
    }

    // Comprueba que el usuario tenga permiso para entrar.
    const permissions = channel.permissionsFor(ctx.member);
    if (!permissions?.has('Connect')) {
      await ctx.errorReply('No tienes permiso para conectarte a ese canal.');
      return;
    }
    if (channel.userLimit > 0 && channel.members.size >= channel.userLimit) {
      await ctx.errorReply('Ese canal está lleno.');
      return;
    }

    try {
      await ctx.member.voice.setChannel(channel, `Solicitado por ${ctx.user.tag}`);
      await ctx.successReply(`Te he movido a ${channel}.`);
    } catch (err) {
      await ctx.errorReply(`No he podido moverte: ${err.message}`);
    }
  },
};

'use strict';

const { SlashCommandBuilder } = require('discord.js');

const perms = require('../../utils/permissions');
const { createCase } = require('../../utils/moderation');

module.exports = {
  name: 'vkick',
  category: 'moderation',
  aliases: ['voicekick', 'expulsarvoz'],
  description: 'Expulsa a un miembro de un canal de voz.',
  usage: '<usuario> [razón]',
  examples: ['vkick @Rogue molestar en voz'],
  cooldown: 3,
  userPermissions: ['MoveMembers'],
  botPermissions: ['MoveMembers'],

  data: new SlashCommandBuilder()
    .setName('vkick')
    .setDescription('Expulsa a un miembro de un canal de voz.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('A quién quieres desconectar.').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('razon').setDescription('Motivo.').setRequired(false)
    ),

  async execute(ctx) {
    const target = ctx.options.getUser('usuario', true);
    const reason = ctx.options.getString('razon') || 'Sin razón especificada';

    const member = await ctx.guild.members.fetch(target.id).catch(() => null);
    if (!member) {
      await ctx.errorReply('Ese usuario no está en el servidor.');
      return;
    }
    if (!member.voice.channelId) {
      await ctx.errorReply('Ese miembro no está en ningún canal de voz.');
      return;
    }

    const check = perms.canModerate(ctx.member, member);
    if (!check.ok) {
      await ctx.errorReply(check.reason);
      return;
    }

    const channelName = member.voice.channel.name;

    try {
      // `setChannel(null)` desconecta al miembro.
      await member.voice.setChannel(null, `${ctx.user.tag}: ${reason}`);
    } catch (err) {
      await ctx.errorReply(`No he podido desconectarlo: ${err.message}`);
      return;
    }

    const doc = await createCase(
      ctx.guild,
      { type: 'vkick', user: target, moderator: ctx.user, reason },
      ctx.settings
    );

    await ctx.successReply(
      `**${target.tag}** ha sido desconectado de **${channelName}**. \`Caso #${doc.caseId}\``
    );
  },
};

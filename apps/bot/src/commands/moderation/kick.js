'use strict';

const { SlashCommandBuilder } = require('discord.js');

const perms = require('../../utils/permissions');
const { createCase, notifyUser } = require('../../utils/moderation');

module.exports = {
  name: 'kick',
  category: 'moderation',
  aliases: ['expulsar', 'echar'],
  description: 'Expulsa a un miembro.',
  usage: '<usuario> [razón]',
  examples: ['kick @Rogue comportamiento tóxico'],
  cooldown: 3,
  userPermissions: ['KickMembers'],
  botPermissions: ['KickMembers'],

  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulsa a un miembro.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('A quién quieres expulsar.').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('razon').setDescription('Motivo de la expulsión.').setRequired(false)
    ),

  async execute(ctx) {
    const target = ctx.options.getUser('usuario', true);
    const reason = ctx.options.getString('razon') || 'Sin razón especificada';

    const member = await ctx.guild.members.fetch(target.id).catch(() => null);
    if (!member) {
      await ctx.errorReply('Ese usuario no está en el servidor.');
      return;
    }

    const check = perms.canModerate(ctx.member, member);
    if (!check.ok) {
      await ctx.errorReply(check.reason);
      return;
    }
    const botCheck = perms.botCanModerate(ctx.guild, member);
    if (!botCheck.ok) {
      await ctx.errorReply(botCheck.reason);
      return;
    }

    await ctx.defer();

    // El aviso se envía antes de expulsar, mientras aún compartimos servidor.
    await notifyUser(target, ctx.guild, 'kick', reason).catch(() => {});

    try {
      await member.kick(`${ctx.user.tag}: ${reason}`);
    } catch (err) {
      await ctx.errorReply(`No he podido expulsar a **${target.tag}**: ${err.message}`);
      return;
    }

    const doc = await createCase(
      ctx.guild,
      { type: 'kick', user: target, moderator: ctx.user, reason },
      ctx.settings
    );

    await ctx.successReply(
      `**${target.tag}** ha sido expulsado. \`Caso #${doc.caseId}\`\n**Razón:** ${reason}`
    );
  },
};

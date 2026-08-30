'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { Case } = require('@tkbot/shared');

const perms = require('../../utils/permissions');
const { createCase, notifyUser } = require('../../utils/moderation');

module.exports = {
  name: 'warn',
  category: 'moderation',
  aliases: ['advertir', 'aviso'],
  description: 'Advierte a un miembro.',
  usage: '<usuario> [razón]',
  examples: ['warn @Rogue no hagas spam'],
  cooldown: 3,
  userPermissions: ['ModerateMembers'],

  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Advierte a un miembro.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('A quién quieres advertir.').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('razon').setDescription('Motivo de la advertencia.').setRequired(false)
    ),

  async execute(ctx) {
    const target = ctx.options.getUser('usuario', true);
    const reason = ctx.options.getString('razon') || 'Sin razón especificada';

    if (target.bot) {
      await ctx.errorReply('No puedes advertir a un bot.');
      return;
    }

    const member = await ctx.guild.members.fetch(target.id).catch(() => null);
    if (member) {
      const check = perms.canModerate(ctx.member, member);
      if (!check.ok) {
        await ctx.errorReply(check.reason);
        return;
      }
    }

    await ctx.defer();

    const doc = await createCase(
      ctx.guild,
      { type: 'warn', user: target, moderator: ctx.user, reason },
      ctx.settings
    );

    const total = await Case.countDocuments({
      guildId: ctx.guild.id,
      userId: target.id,
      type: 'warn',
      active: true,
    });

    const notified = await notifyUser(target, ctx.guild, 'warn', reason);

    await ctx.successReply(
      [
        `**${target.tag}** ha recibido una advertencia. \`Caso #${doc.caseId}\``,
        `**Razón:** ${reason}`,
        `Ahora tiene **${total}** advertencia(s) activa(s).`,
        notified ? '' : '*No he podido avisarle por privado (tiene los MD cerrados).*',
      ]
        .filter(Boolean)
        .join('\n')
    );
  },
};

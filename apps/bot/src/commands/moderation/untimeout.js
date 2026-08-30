'use strict';

const { SlashCommandBuilder } = require('discord.js');

const perms = require('../../utils/permissions');
const { createCase } = require('../../utils/moderation');

module.exports = {
  name: 'untimeout',
  category: 'moderation',
  aliases: ['desaislar', 'quitaraislamiento'],
  description: 'Elimina el aislamiento de un usuario.',
  usage: '<usuario> [razón]',
  examples: ['untimeout @Rogue'],
  cooldown: 3,
  userPermissions: ['ModerateMembers'],
  botPermissions: ['ModerateMembers'],

  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Elimina el aislamiento de un usuario.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('A quién quieres desaislar.').setRequired(true)
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

    if (!member.isCommunicationDisabled()) {
      await ctx.errorReply(`**${target.tag}** no está aislado.`);
      return;
    }

    const botCheck = perms.botCanModerate(ctx.guild, member);
    if (!botCheck.ok) {
      await ctx.errorReply(botCheck.reason);
      return;
    }

    try {
      // `null` retira el aislamiento.
      await member.timeout(null, `${ctx.user.tag}: ${reason}`);
    } catch (err) {
      await ctx.errorReply(`No he podido retirar el aislamiento: ${err.message}`);
      return;
    }

    const doc = await createCase(
      ctx.guild,
      { type: 'untimeout', user: target, moderator: ctx.user, reason },
      ctx.settings
    );

    await ctx.successReply(
      `Se ha retirado el aislamiento a **${target.tag}**. \`Caso #${doc.caseId}\``
    );
  },
};

'use strict';

const { SlashCommandBuilder } = require('discord.js');

const perms = require('../../utils/permissions');
const { createCase, notifyUser } = require('../../utils/moderation');
const { parseDuration, formatDuration } = require('../../utils/time');

/** Discord no permite aislar a alguien más de 28 días. */
const MAX_TIMEOUT = 2_419_200_000;

module.exports = {
  name: 'timeout',
  category: 'moderation',
  aliases: ['aislar', 'tempmute'],
  description: 'Aísla a un usuario.',
  usage: '<usuario> <duración> [razón]',
  examples: ['timeout @Rogue 1h spam', 'timeout @Rogue 30m'],
  cooldown: 3,
  userPermissions: ['ModerateMembers'],
  botPermissions: ['ModerateMembers'],

  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Aísla a un usuario.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('A quién quieres aislar.').setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('duracion')
        .setDescription('Cuánto dura el aislamiento (máx. 28 días). Ejemplo: 1h, 30m, 7d.')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('razon').setDescription('Motivo del aislamiento.').setRequired(false)
    ),

  async execute(ctx) {
    const target = ctx.options.getUser('usuario', true);
    const durationInput = ctx.options.getString('duracion', true);
    const reason = ctx.options.getString('razon') || 'Sin razón especificada';

    const duration = parseDuration(durationInput);
    if (duration === null) {
      await ctx.errorReply('Duración no válida. Usa formatos como `30m`, `2h`, `7d` o `1semana`.');
      return;
    }
    if (duration > MAX_TIMEOUT) {
      await ctx.errorReply('El aislamiento no puede durar más de **28 días** (límite de Discord).');
      return;
    }

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
    if (!member.moderatable) {
      await ctx.errorReply('No puedo aislar a ese miembro. Comprueba mi rol y mis permisos.');
      return;
    }

    await ctx.defer();

    try {
      await member.timeout(duration, `${ctx.user.tag}: ${reason}`);
    } catch (err) {
      await ctx.errorReply(`No he podido aislar a **${target.tag}**: ${err.message}`);
      return;
    }

    await notifyUser(target, ctx.guild, 'timeout', reason, duration, ctx.settings).catch(() => {});

    const doc = await createCase(
      ctx.guild,
      { type: 'timeout', user: target, moderator: ctx.user, reason, duration },
      ctx.settings
    );

    await ctx.successReply(
      `**${target.tag}** ha sido aislado durante **${formatDuration(duration)}**. \`Caso #${doc.caseId}\`\n**Razón:** ${reason}`
    );
  },
};

'use strict';

const { SlashCommandBuilder } = require('discord.js');

const perms = require('../../utils/permissions');
const { createCase, notifyUser } = require('../../utils/moderation');
const { parseDuration, formatDuration } = require('../../utils/time');

module.exports = {
  name: 'ban',
  category: 'moderation',
  aliases: ['banear', 'banip'],
  description: 'Banea a un miembro.',
  usage: '<usuario> [razón]',
  examples: ['ban @Rogue spam repetido', 'ban 123456789012345678 raid'],
  cooldown: 3,
  userPermissions: ['BanMembers'],
  botPermissions: ['BanMembers'],

  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Banea a un miembro.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('A quién quieres banear.').setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('duracion')
        .setDescription('Duración del baneo (por ejemplo 7d). Déjalo vacío para permanente.')
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName('borrar')
        .setDescription('Días de mensajes recientes que quieres borrar.')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(7)
    )
    .addStringOption((option) =>
      option.setName('razon').setDescription('Motivo del baneo.').setRequired(false)
    ),

  async execute(ctx) {
    const target = ctx.options.getUser('usuario', true);
    const durationInput = ctx.options.getString('duracion');
    const deleteDays = ctx.options.getInteger('borrar') ?? 0;
    const reason = ctx.options.getString('razon') || 'Sin razón especificada';

    // El usuario puede no estar en el servidor (baneo por ID).
    const member = await ctx.guild.members.fetch(target.id).catch(() => null);

    if (member) {
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
    }

    // Comprueba que no esté ya baneado.
    const existing = await ctx.guild.bans.fetch(target.id).catch(() => null);
    if (existing) {
      await ctx.errorReply(`**${target.tag}** ya está baneado en este servidor.`);
      return;
    }

    let duration = null;
    if (durationInput) {
      duration = parseDuration(durationInput);
      if (duration === null) {
        await ctx.errorReply(
          'Duración no válida. Usa formatos como `30m`, `12h`, `7d` o `1semana`.'
        );
        return;
      }
    }

    await ctx.defer();

    // Se avisa antes de banear: después ya no se le puede escribir.
    if (member) {
      await notifyUser(target, ctx.guild, 'ban', reason, duration).catch(() => {});
    }

    try {
      await ctx.guild.members.ban(target.id, {
        reason: `${ctx.user.tag}: ${reason}`,
        deleteMessageSeconds: deleteDays * 86_400,
      });
    } catch (err) {
      await ctx.errorReply(`No he podido banear a **${target.tag}**: ${err.message}`);
      return;
    }

    const doc = await createCase(
      ctx.guild,
      { type: 'ban', user: target, moderator: ctx.user, reason, duration },
      ctx.settings
    );

    // Los baneos temporales se levantan con la tarea programada `tempActions`.
    const suffix = duration ? ` durante **${formatDuration(duration)}**` : '';
    await ctx.successReply(
      `**${target.tag}** ha sido baneado${suffix}. \`Caso #${doc.caseId}\`\n**Razón:** ${reason}`
    );
  },
};

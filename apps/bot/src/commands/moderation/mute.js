'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { Member } = require('@tkbot/shared');

const perms = require('../../utils/permissions');
const { createCase, notifyUser } = require('../../utils/moderation');
const { parseDuration, formatDuration } = require('../../utils/time');
const { getOrCreateMuteRole } = require('../../utils/muteRole');

module.exports = {
  name: 'mute',
  category: 'moderation',
  aliases: ['silenciar'],
  description: 'Silencia a un miembro en los canales de texto o de voz.',
  usage: '<text|voice> <usuario> [duración] [razón]',
  examples: ['mute text @Rogue 1h spam', 'mute voice @Rogue gritar'],
  cooldown: 3,
  userPermissions: ['ModerateMembers'],
  botPermissions: ['ManageRoles'],

  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Silencia a un miembro en texto o en voz.')
    .addSubcommand((sub) =>
      sub
        .setName('text')
        .setDescription('Silenciar a un miembro para que no pueda escribir en los canales de texto.')
        .addUserOption((option) =>
          option.setName('usuario').setDescription('A quién silenciar.').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('duracion')
            .setDescription('Duración (ejemplo: 1h). Vacío para indefinido.')
            .setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('razon').setDescription('Motivo.').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('voice')
        .setDescription('Silenciar a un miembro para que no pueda hablar en los canales de voz.')
        .addUserOption((option) =>
          option.setName('usuario').setDescription('A quién silenciar.').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('razon').setDescription('Motivo.').setRequired(false)
        )
    ),

  async execute(ctx) {
    const sub = ctx.options.getSubcommand();
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

    // ── Silencio en voz ──────────────────────────────────────────
    if (sub === 'voice') {
      if (!ctx.guild.members.me.permissions.has('MuteMembers')) {
        await ctx.errorReply('Me falta el permiso **Silenciar miembros** para hacer esto.');
        return;
      }
      if (!member.voice.channelId) {
        await ctx.errorReply('Ese miembro no está en un canal de voz.');
        return;
      }
      if (member.voice.serverMute) {
        await ctx.errorReply(`**${target.tag}** ya está silenciado en voz.`);
        return;
      }

      try {
        await member.voice.setMute(true, `${ctx.user.tag}: ${reason}`);
      } catch (err) {
        await ctx.errorReply(`No he podido silenciarlo: ${err.message}`);
        return;
      }

      const doc = await createCase(
        ctx.guild,
        { type: 'vmute', user: target, moderator: ctx.user, reason },
        ctx.settings
      );
      await ctx.successReply(
        `**${target.tag}** ha sido silenciado en voz. \`Caso #${doc.caseId}\`\n**Razón:** ${reason}`
      );
      return;
    }

    // ── Silencio en texto ────────────────────────────────────────
    const durationInput = ctx.options.getString('duracion');
    let duration = null;
    if (durationInput) {
      duration = parseDuration(durationInput);
      if (duration === null) {
        await ctx.errorReply('Duración no válida. Usa formatos como `30m`, `2h` o `7d`.');
        return;
      }
    }

    await ctx.defer();

    const role = await getOrCreateMuteRole(ctx.guild);
    if (!role) {
      await ctx.errorReply(
        'No he podido crear el rol de silencio. Comprueba que tengo permiso de **Gestionar roles**.'
      );
      return;
    }
    if (!perms.canManageRole(ctx.guild, role)) {
      await ctx.errorReply(
        `No puedo asignar el rol **${role.name}**. Sube el rol de TK$ Bot por encima de él.`
      );
      return;
    }
    if (member.roles.cache.has(role.id)) {
      await ctx.errorReply(`**${target.tag}** ya está silenciado.`);
      return;
    }

    try {
      await member.roles.add(role, `${ctx.user.tag}: ${reason}`);
    } catch (err) {
      await ctx.errorReply(`No he podido silenciarlo: ${err.message}`);
      return;
    }

    // La fecha de expiración la revisa la tarea `tempActions`.
    await Member.updateOne(
      { guildId: ctx.guild.id, userId: target.id },
      {
        $set: { mutedUntil: duration ? new Date(Date.now() + duration) : null },
        $setOnInsert: { guildId: ctx.guild.id, userId: target.id },
      },
      { upsert: true }
    ).catch(() => {});

    await notifyUser(target, ctx.guild, 'mute', reason, duration).catch(() => {});

    const doc = await createCase(
      ctx.guild,
      { type: 'mute', user: target, moderator: ctx.user, reason, duration },
      ctx.settings
    );

    const suffix = duration ? ` durante **${formatDuration(duration)}**` : '';
    await ctx.successReply(
      `**${target.tag}** ha sido silenciado${suffix}. \`Caso #${doc.caseId}\`\n**Razón:** ${reason}`
    );
  },
};

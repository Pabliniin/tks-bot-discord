'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { Member } = require('@tkbot/shared');

const perms = require('../../utils/permissions');
const { createCase } = require('../../utils/moderation');

module.exports = {
  name: 'unmute',
  category: 'moderation',
  aliases: ['desilenciar', 'quitarsilencio'],
  description: 'Remueve el silencio de un miembro, en texto o en voz.',
  usage: '<text|voice> <usuario> [razón]',
  examples: ['unmute text @Rogue', 'unmute voice @Rogue'],
  cooldown: 3,
  userPermissions: ['ModerateMembers'],
  botPermissions: ['ManageRoles'],

  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remueve el silencio de un miembro.')
    .addSubcommand((sub) =>
      sub
        .setName('text')
        .setDescription('Remover el silencio de un miembro en los canales de texto.')
        .addUserOption((option) =>
          option.setName('usuario').setDescription('A quién quitar el silencio.').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('razon').setDescription('Motivo.').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('voice')
        .setDescription('Quita el silencio de un miembro en los canales de voz.')
        .addUserOption((option) =>
          option.setName('usuario').setDescription('A quién quitar el silencio.').setRequired(true)
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

    const botCheck = perms.botCanModerate(ctx.guild, member);
    if (!botCheck.ok) {
      await ctx.errorReply(botCheck.reason);
      return;
    }

    // ── Voz ──────────────────────────────────────────────────────
    if (sub === 'voice') {
      if (!member.voice.channelId) {
        await ctx.errorReply('Ese miembro no está en un canal de voz.');
        return;
      }
      if (!member.voice.serverMute) {
        await ctx.errorReply(`**${target.tag}** no está silenciado en voz.`);
        return;
      }

      try {
        await member.voice.setMute(false, `${ctx.user.tag}: ${reason}`);
      } catch (err) {
        await ctx.errorReply(`No he podido quitarle el silencio: ${err.message}`);
        return;
      }

      const doc = await createCase(
        ctx.guild,
        { type: 'vunmute', user: target, moderator: ctx.user, reason },
        ctx.settings
      );
      await ctx.successReply(
        `Se ha quitado el silencio de voz a **${target.tag}**. \`Caso #${doc.caseId}\``
      );
      return;
    }

    // ── Texto ────────────────────────────────────────────────────
    const role = ctx.guild.roles.cache.find(
      (r) => r.name === 'Silenciado' || r.name.toLowerCase() === 'muted'
    );

    if (!role || !member.roles.cache.has(role.id)) {
      await ctx.errorReply(`**${target.tag}** no está silenciado.`);
      return;
    }
    if (!perms.canManageRole(ctx.guild, role)) {
      await ctx.errorReply(
        `No puedo retirar el rol **${role.name}**. Sube el rol de TK$ Bot por encima de él.`
      );
      return;
    }

    try {
      await member.roles.remove(role, `${ctx.user.tag}: ${reason}`);
    } catch (err) {
      await ctx.errorReply(`No he podido quitarle el silencio: ${err.message}`);
      return;
    }

    await Member.updateOne(
      { guildId: ctx.guild.id, userId: target.id },
      { $set: { mutedUntil: null } }
    ).catch(() => {});

    const doc = await createCase(
      ctx.guild,
      { type: 'unmute', user: target, moderator: ctx.user, reason },
      ctx.settings
    );

    await ctx.successReply(`Se ha quitado el silencio a **${target.tag}**. \`Caso #${doc.caseId}\``);
  },
};

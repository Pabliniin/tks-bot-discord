'use strict';

const { SlashCommandBuilder } = require('discord.js');

const perms = require('../../utils/permissions');

module.exports = {
  name: 'setnick',
  category: 'moderation',
  aliases: ['nick', 'apodo', 'nickname'],
  description: 'Cambia el apodo de un miembro.',
  usage: '<usuario> [apodo]',
  examples: ['setnick @Rogue Fundador', 'setnick @Rogue'],
  cooldown: 3,
  userPermissions: ['ManageNicknames'],
  botPermissions: ['ManageNicknames'],

  data: new SlashCommandBuilder()
    .setName('setnick')
    .setDescription('Cambia el apodo de un miembro.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('A quién le cambias el apodo.').setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('apodo')
        .setDescription('Nuevo apodo. Déjalo vacío para restablecer el nombre original.')
        .setRequired(false)
        .setMaxLength(32)
    ),

  async execute(ctx) {
    const target = ctx.options.getUser('usuario', true);
    const nickname = ctx.options.getString('apodo');

    const member = await ctx.guild.members.fetch(target.id).catch(() => null);
    if (!member) {
      await ctx.errorReply('Ese usuario no está en el servidor.');
      return;
    }

    // El dueño del servidor no puede ser renombrado ni siquiera por el bot.
    if (member.id === ctx.guild.ownerId) {
      await ctx.errorReply('No puedo cambiar el apodo del dueño del servidor.');
      return;
    }

    // Cambiarse el apodo a uno mismo no requiere superar la jerarquía.
    if (member.id !== ctx.user.id) {
      const check = perms.canModerate(ctx.member, member);
      if (!check.ok) {
        await ctx.errorReply(check.reason);
        return;
      }
    }

    const botCheck = perms.botCanModerate(ctx.guild, member);
    if (!botCheck.ok) {
      await ctx.errorReply(botCheck.reason);
      return;
    }

    if (nickname && nickname.length > 32) {
      await ctx.errorReply('El apodo no puede superar los 32 caracteres.');
      return;
    }

    const previous = member.nickname || member.user.username;

    try {
      await member.setNickname(nickname || null, `${ctx.user.tag} cambió el apodo`);
    } catch (err) {
      await ctx.errorReply(`No he podido cambiar el apodo: ${err.message}`);
      return;
    }

    await ctx.successReply(
      nickname
        ? `Apodo cambiado: \`${previous}\` → \`${nickname}\``
        : `Se ha restablecido el nombre original de **${member.user.username}**.`
    );
  },
};

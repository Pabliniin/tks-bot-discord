'use strict';

const { SlashCommandBuilder } = require('discord.js');

const perms = require('../../utils/permissions');

module.exports = {
  name: 'role',
  category: 'moderation',
  aliases: ['rol', 'darrol'],
  description: 'Agregar/Quitar role/s para un miembro.',
  usage: '<add|remove> <usuario> <rol>',
  examples: ['role add @Rogue Moderador', 'role remove @Rogue Moderador'],
  cooldown: 3,
  userPermissions: ['ManageRoles'],
  botPermissions: ['ManageRoles'],

  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Agrega o quita roles a un miembro.')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Agrega un rol a un miembro.')
        .addUserOption((option) =>
          option.setName('usuario').setDescription('A quién.').setRequired(true)
        )
        .addRoleOption((option) =>
          option.setName('rol').setDescription('Qué rol añadir.').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Quita un rol a un miembro.')
        .addUserOption((option) =>
          option.setName('usuario').setDescription('A quién.').setRequired(true)
        )
        .addRoleOption((option) =>
          option.setName('rol').setDescription('Qué rol quitar.').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('all')
        .setDescription('Añade un rol a todos los miembros del servidor.')
        .addRoleOption((option) =>
          option.setName('rol').setDescription('Qué rol añadir.').setRequired(true)
        )
    ),

  async execute(ctx) {
    const sub = ctx.options.getSubcommand();
    const role = ctx.options.getRole('rol', true);

    if (!perms.canManageRole(ctx.guild, role)) {
      await ctx.errorReply(
        `No puedo gestionar el rol **${role.name}**. Comprueba que mi rol esté por encima y que no sea un rol de integración.`
      );
      return;
    }

    // Nadie puede repartir un rol igual o superior al suyo.
    if (
      ctx.user.id !== ctx.guild.ownerId &&
      ctx.member.roles.highest.comparePositionTo(role) <= 0
    ) {
      await ctx.errorReply('No puedes gestionar un rol igual o superior al tuyo.');
      return;
    }

    // ── Añadir a todo el servidor ────────────────────────────────
    if (sub === 'all') {
      await ctx.defer();

      const members = await ctx.guild.members.fetch().catch(() => null);
      if (!members) {
        await ctx.errorReply('No he podido obtener la lista de miembros.');
        return;
      }

      const pending = members.filter((m) => !m.roles.cache.has(role.id));
      if (pending.size === 0) {
        await ctx.errorReply('Todos los miembros ya tienen ese rol.');
        return;
      }

      await ctx.reply({
        embeds: [
          require('../../utils/embeds').info(
            `Añadiendo **${role.name}** a **${pending.size}** miembros. Esto puede tardar un rato.`
          ),
        ],
      });

      let done = 0;
      for (const [, member] of pending) {
        try {
          await member.roles.add(role, `Añadido masivamente por ${ctx.user.tag}`);
          done += 1;
        } catch {
          // Se ignoran los fallos individuales y se sigue con el resto.
        }
      }

      await ctx.send({
        embeds: [
          require('../../utils/embeds').success(
            `Se ha añadido **${role.name}** a **${done}** de **${pending.size}** miembros.`
          ),
        ],
      });
      return;
    }

    // ── Añadir o quitar a un miembro ─────────────────────────────
    const target = ctx.options.getUser('usuario', true);
    const member = await ctx.guild.members.fetch(target.id).catch(() => null);

    if (!member) {
      await ctx.errorReply('Ese usuario no está en el servidor.');
      return;
    }

    if (sub === 'add') {
      if (member.roles.cache.has(role.id)) {
        await ctx.errorReply(`**${target.tag}** ya tiene el rol **${role.name}**.`);
        return;
      }
      try {
        await member.roles.add(role, `Añadido por ${ctx.user.tag}`);
      } catch (err) {
        await ctx.errorReply(`No he podido añadir el rol: ${err.message}`);
        return;
      }
      await ctx.successReply(`Se ha añadido **${role.name}** a **${target.tag}**.`);
      return;
    }

    if (!member.roles.cache.has(role.id)) {
      await ctx.errorReply(`**${target.tag}** no tiene el rol **${role.name}**.`);
      return;
    }
    try {
      await member.roles.remove(role, `Quitado por ${ctx.user.tag}`);
    } catch (err) {
      await ctx.errorReply(`No he podido quitar el rol: ${err.message}`);
      return;
    }
    await ctx.successReply(`Se ha quitado **${role.name}** a **${target.tag}**.`);
  },
};

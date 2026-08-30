'use strict';

const { SlashCommandBuilder } = require('discord.js');

const perms = require('../../utils/permissions');

/** Normaliza `#abc`, `abc` o `#aabbcc` a `#AABBCC`. */
function normalizeHex(input) {
  let value = String(input || '').trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(value)) {
    value = value
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return /^[0-9a-fA-F]{6}$/.test(value) ? `#${value.toUpperCase()}` : null;
}

module.exports = {
  name: 'setcolor',
  category: 'moderation',
  aliases: ['colorrol', 'rolcolor'],
  description: 'Cambia el color del rol por códigos hexadecimales.',
  usage: '<rol> <#hex>',
  examples: ['setcolor @Moderador #5865F2', 'setcolor Miembro f00'],
  cooldown: 3,
  userPermissions: ['ManageRoles'],
  botPermissions: ['ManageRoles'],

  data: new SlashCommandBuilder()
    .setName('setcolor')
    .setDescription('Cambia el color de un rol usando un código hexadecimal.')
    .addRoleOption((option) =>
      option.setName('rol').setDescription('Rol a modificar.').setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('color')
        .setDescription('Color en hexadecimal, por ejemplo #5865F2. Usa "none" para quitarlo.')
        .setRequired(true)
    ),

  async execute(ctx) {
    const role = ctx.options.getRole('rol', true);
    const input = ctx.options.getString('color', true);

    if (!perms.canManageRole(ctx.guild, role)) {
      await ctx.errorReply(
        `No puedo modificar el rol **${role.name}**. Sube el rol de TK$ Bot por encima de él.`
      );
      return;
    }
    if (
      ctx.user.id !== ctx.guild.ownerId &&
      ctx.member.roles.highest.comparePositionTo(role) <= 0
    ) {
      await ctx.errorReply('No puedes modificar un rol igual o superior al tuyo.');
      return;
    }

    // "none" devuelve el rol al color por defecto.
    const removing = ['none', 'ninguno', 'default', 'quitar'].includes(input.toLowerCase());
    const hex = removing ? null : normalizeHex(input);

    if (!removing && !hex) {
      await ctx.errorReply(
        'Color no válido. Usa un hexadecimal como `#5865F2`, `5865F2` o `#f00`.'
      );
      return;
    }

    const previous = role.hexColor;

    try {
      await role.setColor(hex ?? 0, `${ctx.user.tag} cambió el color del rol`);
    } catch (err) {
      await ctx.errorReply(`No he podido cambiar el color: ${err.message}`);
      return;
    }

    await ctx.successReply(
      removing
        ? `Se ha quitado el color del rol **${role.name}**.`
        : `Color de **${role.name}** cambiado: \`${previous}\` → \`${hex}\``
    );
  },

  // Exportado para las pruebas.
  normalizeHex,
};

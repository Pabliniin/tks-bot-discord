'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { EMBED_COLORS } = require('@tkbot/shared');

const { discordTimestamp } = require('../../utils/time');

module.exports = {
  name: 'roles',
  category: 'info',
  aliases: ['listaroles', 'roleinfo'],
  description: 'Obtener una lista de roles de servidor y los miembros dentro.',
  usage: '[rol]',
  examples: ['roles', 'roles @Moderador'],
  cooldown: 8,

  data: new SlashCommandBuilder()
    .setName('roles')
    .setDescription('Lista los roles del servidor, o los miembros de un rol concreto.')
    .addRoleOption((option) =>
      option
        .setName('rol')
        .setDescription('Rol del que quieres ver los miembros.')
        .setRequired(false)
    ),

  async execute(ctx) {
    const role = ctx.options.getRole('rol');

    // ── Detalle de un rol concreto ───────────────────────────────
    if (role) {
      // La caché de miembros puede estar incompleta al arrancar.
      await ctx.guild.members.fetch().catch(() => {});
      const members = role.members;

      const embed = new EmbedBuilder()
        .setColor(role.color || EMBED_COLORS.default)
        .setTitle(`Rol: ${role.name}`)
        .addFields(
          { name: '🆔 ID', value: `\`${role.id}\``, inline: true },
          { name: '🎨 Color', value: role.hexColor, inline: true },
          { name: '📊 Posición', value: String(role.position), inline: true },
          { name: '👥 Miembros', value: String(members.size), inline: true },
          { name: '📌 Mencionable', value: role.mentionable ? 'Sí' : 'No', inline: true },
          { name: '👁️ Separado', value: role.hoist ? 'Sí' : 'No', inline: true },
          { name: '📅 Creado', value: discordTimestamp(role.createdAt, 'R'), inline: true },
          {
            name: '🤖 Gestionado por integración',
            value: role.managed ? 'Sí' : 'No',
            inline: true,
          }
        )
        .setTimestamp();

      if (members.size > 0) {
        const names = members.map((m) => m.user.username);
        const shown = names.slice(0, 40).join(', ');
        embed.addFields({
          name: `Miembros (${members.size})`,
          value: (names.length > 40 ? `${shown} y ${names.length - 40} más…` : shown).slice(0, 1024),
        });
      }

      const permissions = role.permissions.toArray();
      if (permissions.length > 0) {
        embed.addFields({
          name: `Permisos (${permissions.length})`,
          value: permissions.join(', ').slice(0, 1024),
        });
      }

      await ctx.reply({ embeds: [embed] });
      return;
    }

    // ── Lista completa de roles ──────────────────────────────────
    const all = ctx.guild.roles.cache
      .filter((r) => r.id !== ctx.guild.id)
      .sort((a, b) => b.position - a.position);

    if (all.size === 0) {
      await ctx.errorReply('Este servidor no tiene roles.');
      return;
    }

    const lines = all.map((r) => `<@&${r.id}> — **${r.members.size}** miembro(s)`);

    // Se reparte en varios embeds si no cabe en uno.
    const chunks = [];
    let current = '';
    for (const line of lines) {
      if (current.length + line.length + 1 > 3900) {
        chunks.push(current);
        current = '';
      }
      current += `${line}\n`;
    }
    if (current) chunks.push(current);

    const embeds = chunks.slice(0, 3).map((chunk, index) =>
      new EmbedBuilder()
        .setColor(EMBED_COLORS.default)
        .setTitle(index === 0 ? `Roles de ${ctx.guild.name} (${all.size})` : '​')
        .setDescription(chunk)
    );

    await ctx.reply({ embeds });
  },
};

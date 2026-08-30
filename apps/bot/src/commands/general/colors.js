'use strict';

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
const { EMBED_COLORS } = require('@tkbot/shared');

const { parseColor } = require('../../utils/embeds');

module.exports = {
  name: 'colors',
  category: 'general',
  aliases: ['colores', 'listacolores'],
  description: 'Enumera todos los colores disponibles.',
  usage: '',
  examples: ['colors'],
  cooldown: 5,

  data: new SlashCommandBuilder()
    .setName('colors')
    .setDescription('Enumera todos los colores disponibles.'),

  async execute(ctx) {
    const config = ctx.settings.colors;

    if (!config?.enabled || (config.list || []).length === 0) {
      await ctx.errorReply(
        'Este servidor no tiene colores configurados. Un administrador puede añadirlos desde el panel.'
      );
      return;
    }

    const list = config.list;

    const embed = new EmbedBuilder()
      .setColor(parseColor(list[0]?.hex, EMBED_COLORS.default))
      .setTitle(config.title || 'Colores disponibles')
      .setDescription(
        list
          .map((c) => {
            const role = c.roleId ? ctx.guild.roles.cache.get(c.roleId) : null;
            const owner = role ? ` · ${role.members.size} miembro(s)` : '';
            return `\`${c.hex}\` **${c.name}**${owner}`;
          })
          .join('\n')
          .slice(0, 4096)
      )
      .setFooter({ text: `Usa ${ctx.prefix}color <nombre> o el menú de abajo` });

    // Discord limita el menú a 25 opciones; se reservan una para "quitar".
    const menu = new StringSelectMenuBuilder()
      .setCustomId('color:select')
      .setPlaceholder('Elige tu color')
      .addOptions([
        ...list.slice(0, 24).map((c) => ({
          label: c.name.slice(0, 100),
          value: c.name.slice(0, 100),
          description: c.hex,
        })),
        { label: 'Quitar mi color', value: 'remove', emoji: '🚫' },
      ]);

    await ctx.reply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(menu)],
    });
  },
};

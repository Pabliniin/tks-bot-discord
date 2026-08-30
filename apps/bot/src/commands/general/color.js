'use strict';

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  name: 'color',
  category: 'general',
  aliases: ['micolor'],
  description: 'Cambia tu color en el servidor.',
  usage: '<nombre del color>',
  examples: ['color Rojo', 'color quitar'],
  cooldown: 5,
  botPermissions: ['ManageRoles'],

  data: new SlashCommandBuilder()
    .setName('color')
    .setDescription('Cambia tu color en el servidor.')
    .addStringOption((option) =>
      option
        .setName('nombre')
        .setDescription('Nombre del color, o "quitar" para retirarlo.')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  /** Sugiere los colores configurados en el servidor. */
  async autocomplete(interaction, client, settings) {
    const focused = interaction.options.getFocused().toLowerCase();
    const list = settings?.colors?.list || [];

    const matches = list
      .filter((c) => c.name.toLowerCase().includes(focused))
      .map((c) => ({ name: `${c.name} (${c.hex})`, value: c.name }))
      .slice(0, 24);

    matches.unshift({ name: 'Quitar mi color', value: 'quitar' });
    await interaction.respond(matches.slice(0, 25)).catch(() => {});
  },

  async execute(ctx) {
    const name = ctx.options.getString('nombre', true);
    const colors = ctx.client.modules.get('colors');

    if (!colors) {
      await ctx.errorReply('El módulo de colores no está disponible.');
      return;
    }

    const removing = ['quitar', 'remove', 'none', 'ninguno'].includes(name.toLowerCase());

    const result = removing
      ? await colors.remove(ctx.guild, ctx.member, ctx.settings)
      : await colors.assign(ctx.guild, ctx.member, ctx.settings, name);

    if (result.ok) await ctx.successReply(result.message);
    else await ctx.errorReply(result.message);
  },
};

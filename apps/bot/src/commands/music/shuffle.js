'use strict';

const { SlashCommandBuilder } = require('discord.js');

const guards = require('../../utils/musicGuards');

module.exports = {
  name: 'shuffle',
  category: 'music',
  aliases: ['mezclar', 'aleatorio', 'barajar'],
  description: 'Mezcla el orden de la cola.',
  usage: '',
  examples: ['shuffle'],
  cooldown: 3,

  data: new SlashCommandBuilder().setName('shuffle').setDescription('Mezcla el orden de la cola.'),

  async execute(ctx) {
    const activa = guards.colaActiva(ctx, { exigirCancion: false });
    if (!activa.ok) {
      await ctx.errorReply(activa.motivo);
      return;
    }

    const control = guards.puedeControlar(ctx, activa.cola);
    if (!control.ok) {
      await ctx.errorReply(control.motivo);
      return;
    }

    const { cola } = activa;

    if (cola.tracks.length < 2) {
      await ctx.errorReply('Hacen falta al menos dos canciones en cola para mezclar.');
      return;
    }

    /*
     * Fisher-Yates. El truco de `sort(() => Math.random() - 0.5)` que se ve por
     * ahí no reparte igual: deja las canciones cerca de donde estaban.
     */
    for (let i = cola.tracks.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [cola.tracks[i], cola.tracks[j]] = [cola.tracks[j], cola.tracks[i]];
    }

    await ctx.successReply(`🔀 Mezcladas **${cola.tracks.length}** canciones.`);
  },
};

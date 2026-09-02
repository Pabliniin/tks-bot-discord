'use strict';

const { SlashCommandBuilder } = require('discord.js');

const music = require('../../modules/music');
const guards = require('../../utils/musicGuards');

module.exports = {
  name: 'seek',
  category: 'music',
  aliases: ['ir', 'avanzar', 'saltara'],
  description: 'Salta a un momento concreto de la canción.',
  usage: '<tiempo>',
  examples: ['seek 1:30', 'seek 90', 'seek 2m30s'],
  cooldown: 2,

  data: new SlashCommandBuilder()
    .setName('seek')
    .setDescription('Salta a un momento concreto de la canción.')
    .addStringOption((option) =>
      option
        .setName('tiempo')
        .setDescription('Por ejemplo 1:30, 90 (segundos) o 2m30s.')
        .setRequired(true)
    ),

  async execute(ctx) {
    const activa = guards.colaActiva(ctx);
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
    const { info } = cola.current;

    if (info.isStream || !info.isSeekable) {
      await ctx.errorReply('No se puede saltar dentro de esta canción: es una emisión en directo.');
      return;
    }

    const destino = music.parsearTiempo(ctx.options.getString('tiempo', true));

    if (destino === null) {
      await ctx.errorReply('No entiendo ese tiempo. Usa formatos como `1:30`, `90` o `2m30s`.');
      return;
    }
    if (destino > info.length) {
      await ctx.errorReply(
        `La canción solo dura **${music.formatearDuracion(info.length)}**.`
      );
      return;
    }

    try {
      await cola.player.seekTo(destino);
    } catch (err) {
      await ctx.errorReply(`No he podido saltar: ${err.message}`);
      return;
    }

    await ctx.successReply(
      `⏩ Saltado a **${music.formatearDuracion(destino)}** de ${music.formatearDuracion(info.length)}.`
    );
  },
};

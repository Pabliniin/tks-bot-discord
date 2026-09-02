'use strict';

const { SlashCommandBuilder } = require('discord.js');

const music = require('../../modules/music');
const guards = require('../../utils/musicGuards');

module.exports = {
  name: 'remove',
  category: 'music',
  aliases: ['quitar', 'quitarcancion'],
  description: 'Quita una canción de la cola por su número.',
  usage: '<número>',
  examples: ['remove 3'],
  cooldown: 2,

  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Quita una canción de la cola por su número.')
    .addIntegerOption((option) =>
      option
        .setName('posicion')
        .setDescription('El número que sale en el comando queue.')
        .setMinValue(1)
        .setRequired(true)
    ),

  async execute(ctx) {
    const activa = guards.colaActiva(ctx, { exigirCancion: false });
    if (!activa.ok) {
      await ctx.errorReply(activa.motivo);
      return;
    }

    const { cola } = activa;
    const posicion = ctx.options.getInteger('posicion', true);

    if (cola.tracks.length === 0) {
      await ctx.errorReply('No hay nada en cola que quitar.');
      return;
    }
    if (posicion > cola.tracks.length) {
      await ctx.errorReply(
        `Solo hay ${cola.tracks.length} canción(es) en cola. Mira los números con \`${ctx.prefix}queue\`.`
      );
      return;
    }

    const track = cola.tracks[posicion - 1];

    // Quien la pidió puede quitar la suya sin ser DJ: es lo justo.
    const esSuya = track.pedidaPor?.id === ctx.user.id;
    if (!esSuya) {
      const control = guards.puedeControlar(ctx, cola);
      if (!control.ok) {
        await ctx.errorReply(control.motivo);
        return;
      }
    }

    cola.tracks.splice(posicion - 1, 1);

    await ctx.successReply(
      `🗑️ Quitada de la cola: **${track.info.title}** \`${music.formatearDuracion(track.info.length)}\``
    );
  },
};

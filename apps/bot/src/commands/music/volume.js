'use strict';

const { SlashCommandBuilder } = require('discord.js');

const guards = require('../../utils/musicGuards');

module.exports = {
  name: 'volume',
  category: 'music',
  aliases: ['vol', 'volumen'],
  description: 'Consulta o cambia el volumen.',
  usage: '[0-200]',
  examples: ['volume', 'volume 50'],
  cooldown: 2,

  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Consulta o cambia el volumen.')
    .addIntegerOption((option) =>
      option
        .setName('nivel')
        .setDescription('Volumen en porcentaje. Sin valor, dice el actual.')
        .setMinValue(0)
        .setMaxValue(200)
        .setRequired(false)
    ),

  async execute(ctx) {
    const activa = guards.colaActiva(ctx, { exigirCancion: false });
    if (!activa.ok) {
      await ctx.errorReply(activa.motivo);
      return;
    }

    const { cola } = activa;
    const nivel = ctx.options.getInteger('nivel');

    // Sin valor, solo se consulta: no hace falta permiso para preguntar.
    if (nivel === null || nivel === undefined) {
      await ctx.reply(`🔊 El volumen está al **${cola.volume} %**.`);
      return;
    }

    const control = guards.puedeControlar(ctx, cola);
    if (!control.ok) {
      await ctx.errorReply(control.motivo);
      return;
    }

    // El tope lo pone el servidor: por encima de cierto punto el audio satura
    // y suena peor, además de molestar a quien tenga el volumen alto.
    const maximo = ctx.settings.music?.maxVolume || 150;
    if (nivel > maximo) {
      await ctx.errorReply(`El volumen máximo en este servidor es **${maximo} %**.`);
      return;
    }

    try {
      await cola.player.setGlobalVolume(nivel);
    } catch (err) {
      await ctx.errorReply(`No he podido cambiar el volumen: ${err.message}`);
      return;
    }

    cola.volume = nivel;

    const icono = nivel === 0 ? '🔇' : nivel < 50 ? '🔉' : '🔊';
    await ctx.successReply(`${icono} Volumen al **${nivel} %**.`);
  },
};

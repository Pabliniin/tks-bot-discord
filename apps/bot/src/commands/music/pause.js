'use strict';

const { SlashCommandBuilder } = require('discord.js');

const guards = require('../../utils/musicGuards');

module.exports = {
  name: 'pause',
  category: 'music',
  // Es un interruptor: el mismo comando pausa y reanuda, y la respuesta dice
  // qué ha pasado. Tener dos comandos que hacen lo mismo confunde más que ayuda.
  aliases: ['pausa', 'resume', 'reanudar', 'continuar'],
  description: 'Pausa la música, o la reanuda si ya estaba pausada.',
  usage: '',
  examples: ['pause', 'resume'],
  cooldown: 2,

  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pausa la música, o la reanuda si ya estaba pausada.'),

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
    const pausar = !cola.player.paused;

    try {
      await cola.player.setPaused(pausar);
    } catch (err) {
      await ctx.errorReply(`No he podido cambiar la reproducción: ${err.message}`);
      return;
    }

    await ctx.successReply(
      pausar
        ? `⏸️ Pausado: **${cola.current.info.title}**`
        : `▶️ Reanudado: **${cola.current.info.title}**`
    );
  },
};

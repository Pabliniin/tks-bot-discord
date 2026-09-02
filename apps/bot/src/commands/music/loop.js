'use strict';

const { SlashCommandBuilder } = require('discord.js');

const music = require('../../modules/music');
const guards = require('../../utils/musicGuards');

module.exports = {
  name: 'loop',
  category: 'music',
  aliases: ['repeat', 'repetir', 'bucle'],
  description: 'Repite la canción actual o toda la cola.',
  usage: '[off|cancion|cola]',
  examples: ['loop cancion', 'loop cola', 'loop off'],
  cooldown: 2,

  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Repite la canción actual o toda la cola.')
    /*
     * Los valores van en castellano a propósito: en los comandos por prefijo
     * hay que escribirlos tal cual, y `loop track` no lo adivina nadie.
     */
    .addStringOption((option) =>
      option
        .setName('modo')
        .setDescription('Qué repetir. Sin valor, va pasando de uno a otro.')
        .setRequired(false)
        .addChoices(
          { name: 'Desactivado', value: 'off' },
          { name: 'Canción actual', value: 'cancion' },
          { name: 'Toda la cola', value: 'cola' }
        )
    ),

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

    // Lo que escribe la gente, traducido a lo que usa el módulo por dentro.
    const EQUIVALENCIAS = { off: 'off', cancion: 'track', cola: 'queue' };
    const pedido = ctx.options.getString('modo');

    // Sin argumento va rotando: apagado → canción → cola → apagado.
    const siguiente = { off: 'track', track: 'queue', queue: 'off' };
    const modo = pedido ? EQUIVALENCIAS[pedido.toLowerCase()] : siguiente[cola.loop];

    if (!modo || !music.BUCLES[modo]) {
      await ctx.errorReply('Modo no válido. Usa `off`, `cancion` o `cola`.');
      return;
    }

    cola.loop = modo;

    const iconos = { off: '➡️', track: '🔂', queue: '🔁' };
    const textos = {
      off: 'Repetición desactivada.',
      track: `🔂 Repitiendo **${cola.current?.info.title || 'la canción actual'}**.`,
      queue: '🔁 Repitiendo toda la cola.',
    };

    await ctx.successReply(modo === 'off' ? `${iconos.off} ${textos.off}` : textos[modo]);
  },
};

'use strict';

const { SlashCommandBuilder } = require('discord.js');

const music = require('../../modules/music');
const guards = require('../../utils/musicGuards');
const { premiumTier } = require('@tkbot/shared');

module.exports = {
  name: 'filter',
  category: 'music',
  aliases: ['filtro', 'efecto', 'filters'],
  description: 'Aplica un efecto de audio a la música.',
  usage: '[filtro]',
  examples: ['filter bassboost', 'filter nightcore', 'filter ninguno'],
  cooldown: 5,
  premium: true,

  data: new SlashCommandBuilder()
    .setName('filter')
    .setDescription('Aplica un efecto de audio a la música.')
    .addStringOption((option) =>
      option
        .setName('efecto')
        .setDescription('Qué efecto aplicar. Sin valor, dice cuál está puesto.')
        .setRequired(false)
        .addChoices(
          { name: 'Ninguno (quitar filtro)', value: 'ninguno' },
          { name: 'Más graves', value: 'bassboost' },
          { name: 'Nightcore (más rápido y agudo)', value: 'nightcore' },
          { name: 'Vaporwave (más lento y grave)', value: 'vaporwave' },
          { name: 'Karaoke (quita la voz)', value: 'karaoke' },
          { name: '8D (gira alrededor)', value: 'ochodimensional' }
        )
    ),

  async execute(ctx) {
    const activa = guards.colaActiva(ctx);
    if (!activa.ok) {
      await ctx.errorReply(activa.motivo);
      return;
    }

    const { cola } = activa;
    const efecto = ctx.options.getString('efecto');

    // Sin argumento solo se consulta, y consultar no cuesta nada.
    if (!efecto) {
      const actual = music.FILTROS[cola.filtro];
      await ctx.reply(
        `🎛️ Filtro actual: **${actual?.nombre || 'Ninguno'}**\n` +
          `Disponibles: ${Object.entries(music.FILTROS)
            .map(([id]) => `\`${id}\``)
            .join(', ')}`
      );
      return;
    }

    // Los filtros consumen CPU extra en Lavalink, así que son de pago.
    if (premiumTier(ctx.settings) === 0) {
      await ctx.errorReply(
        'Los filtros de audio forman parte de TK$ Premium.\nEl resto de la música funciona igual sin él.'
      );
      return;
    }

    const control = guards.puedeControlar(ctx, cola);
    if (!control.ok) {
      await ctx.errorReply(control.motivo);
      return;
    }

    const definicion = music.FILTROS[efecto];
    if (!definicion) {
      await ctx.errorReply(
        `No conozco ese filtro. Prueba con: ${Object.keys(music.FILTROS)
          .map((f) => `\`${f}\``)
          .join(', ')}`
      );
      return;
    }

    await ctx.defer();

    try {
      /*
       * `setFilters` sustituye todos los filtros de golpe. Pasar un objeto
       * vacío es justamente cómo se quitan, sin tener que apagarlos uno a uno.
       */
      await cola.player.setFilters(definicion.config || {});
    } catch (err) {
      await ctx.errorReply(`No he podido aplicar el filtro: ${err.message}`);
      return;
    }

    cola.filtro = efecto;

    await ctx.successReply(
      efecto === 'ninguno'
        ? '🎛️ Filtros quitados. Suena tal cual.'
        : `🎛️ Filtro **${definicion.nombre}** aplicado.\nTarda unos segundos en notarse.`
    );
  },
};

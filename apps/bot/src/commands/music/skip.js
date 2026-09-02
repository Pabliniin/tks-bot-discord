'use strict';

const { SlashCommandBuilder } = require('discord.js');

const music = require('../../modules/music');
const guards = require('../../utils/musicGuards');

module.exports = {
  name: 'skip',
  category: 'music',
  aliases: ['s', 'saltar', 'siguiente'],
  description: 'Salta la canción actual. Si hay más gente escuchando, se vota.',
  usage: '',
  examples: ['skip'],
  cooldown: 2,

  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Salta la canción actual. Si hay más gente escuchando, se vota.'),

  async execute(ctx) {
    const activa = guards.colaActiva(ctx);
    if (!activa.ok) {
      await ctx.errorReply(activa.motivo);
      return;
    }

    const { cola } = activa;
    const titulo = cola.current.info.title;

    /*
     * Quien manda (DJ, quien puede gestionar el servidor o quien pidió la
     * canción) la salta sin votar. Para el resto hay votación, que es lo que
     * evita que una persona decida por diez.
     */
    if (music.esDj(ctx.member, ctx.settings, cola)) {
      await music.siguiente(ctx.client, ctx.guild.id);
      await ctx.successReply(`⏭️ Saltada: **${titulo}**`);
      return;
    }

    const control = guards.puedeControlar(ctx, cola);
    if (!control.ok) {
      await ctx.errorReply(control.motivo);
      return;
    }

    const oyentes = music.contarOyentes(ctx.guild, cola);

    // Estando solo (o con una sola persona más) votar no tiene ningún sentido.
    if (oyentes <= 1) {
      await music.siguiente(ctx.client, ctx.guild.id);
      await ctx.successReply(`⏭️ Saltada: **${titulo}**`);
      return;
    }

    if (cola.votos.has(ctx.user.id)) {
      await ctx.errorReply('Ya has votado para saltar esta canción.');
      return;
    }

    cola.votos.add(ctx.user.id);

    const porcentaje = ctx.settings.music?.voteSkipPercent || 50;
    const necesarios = Math.max(1, Math.ceil((oyentes * porcentaje) / 100));

    if (cola.votos.size >= necesarios) {
      await music.siguiente(ctx.client, ctx.guild.id);
      await ctx.successReply(
        `⏭️ Saltada por votación (${cola.votos.size}/${necesarios}): **${titulo}**`
      );
      return;
    }

    await ctx.reply(
      `🗳️ Voto registrado: **${cola.votos.size}/${necesarios}** para saltar **${titulo}**.`
    );
  },
};

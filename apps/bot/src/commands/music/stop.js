'use strict';

const { SlashCommandBuilder } = require('discord.js');

const music = require('../../modules/music');
const guards = require('../../utils/musicGuards');

module.exports = {
  name: 'stop',
  category: 'music',
  aliases: ['parar', 'detener', 'salir', 'disconnect', 'dc'],
  description: 'Para la música, vacía la cola y sale del canal de voz.',
  usage: '',
  examples: ['stop'],
  cooldown: 3,

  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Para la música, vacía la cola y sale del canal de voz.'),

  async execute(ctx) {
    // Se admite parar aunque no suene nada: puede haber cola en pausa.
    const activa = guards.colaActiva(ctx, { exigirCancion: false });
    if (!activa.ok) {
      await ctx.errorReply(activa.motivo);
      return;
    }

    const { cola } = activa;

    /*
     * Parar afecta a todo el mundo, así que se exige mando de verdad: aquí no
     * vale «la pedí yo». Con una sola persona escuchando da igual.
     */
    const oyentes = music.contarOyentes(ctx.guild, cola);
    const mandaDeVerdad =
      ctx.member.permissions.has('ManageGuild') ||
      (ctx.settings.music?.djRoleId && ctx.member.roles.cache.has(ctx.settings.music.djRoleId));

    if (oyentes > 1 && !mandaDeVerdad) {
      await ctx.errorReply(
        'Hay más gente escuchando. Usa `skip` para saltar la canción, o pídeselo a un DJ.'
      );
      return;
    }

    const total = cola.tracks.length + (cola.current ? 1 : 0);
    await music.destruir(ctx.guild.id);

    await ctx.successReply(
      total > 0
        ? `⏹️ Música parada. Se han descartado ${total} canción(es) y he salido del canal.`
        : '⏹️ He salido del canal de voz.'
    );
  },
};

'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { EMBED_COLORS } = require('@tkbot/shared');

const music = require('../../modules/music');
const guards = require('../../utils/musicGuards');

module.exports = {
  name: 'nowplaying',
  category: 'music',
  aliases: ['np', 'sonando', 'ahora'],
  description: 'Enseña qué está sonando y por dónde va.',
  usage: '',
  examples: ['nowplaying'],
  cooldown: 3,

  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Enseña qué está sonando y por dónde va.'),

  async execute(ctx) {
    const listo = guards.servicioListo(ctx);
    if (!listo.ok) {
      await ctx.errorReply(listo.motivo);
      return;
    }

    const cola = music.getCola(ctx.guild.id);
    if (!cola?.current) {
      await ctx.errorReply('No hay ninguna canción sonando.');
      return;
    }

    const { info } = cola.current;
    const posicion = cola.player.position || 0;

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.default)
      .setAuthor({ name: cola.player.paused ? '⏸️ En pausa' : '🎵 Sonando ahora' })
      .setTitle(info.title.slice(0, 256))
      .addFields(
        { name: 'Artista', value: info.author || 'Desconocido', inline: true },
        { name: 'Volumen', value: `${cola.volume} %`, inline: true },
        { name: 'Repetición', value: music.BUCLES[cola.loop], inline: true }
      );

    if (info.uri) embed.setURL(info.uri);
    if (info.artworkUrl) embed.setImage(info.artworkUrl);

    // Barra de progreso, que en un directo no significa nada.
    embed.setDescription(
      info.isStream
        ? '🔴 **Emisión en directo**'
        : `\`${music.formatearDuracion(posicion)}\` ${music.barraProgreso(
            posicion,
            info.length
          )} \`${music.formatearDuracion(info.length)}\``
    );

    if (cola.filtro !== 'ninguno') {
      embed.addFields({
        name: 'Filtro',
        value: music.FILTROS[cola.filtro]?.nombre || cola.filtro,
        inline: true,
      });
    }

    if (cola.tracks.length > 0) {
      embed.addFields({
        name: 'Siguiente',
        value: `${cola.tracks[0].info.title.slice(0, 80)}\n*y ${cola.tracks.length - 1} más*`,
      });
    }

    if (cola.current.pedidaPor) {
      embed.setFooter({ text: `Pedida por ${cola.current.pedidaPor.tag}` });
    }

    await ctx.reply({ embeds: [embed] });
  },
};

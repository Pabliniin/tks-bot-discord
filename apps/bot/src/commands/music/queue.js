'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { EMBED_COLORS } = require('@tkbot/shared');

const music = require('../../modules/music');
const guards = require('../../utils/musicGuards');

/** Canciones por página. */
const POR_PAGINA = 10;

module.exports = {
  name: 'queue',
  category: 'music',
  aliases: ['q', 'cola', 'listareproduccion'],
  description: 'Enseña la cola de reproducción.',
  usage: '[página]',
  examples: ['queue', 'queue 2'],
  cooldown: 3,

  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Enseña la cola de reproducción.')
    .addIntegerOption((option) =>
      option.setName('pagina').setDescription('Qué página quieres ver.').setMinValue(1).setRequired(false)
    ),

  async execute(ctx) {
    const listo = guards.servicioListo(ctx);
    if (!listo.ok) {
      await ctx.errorReply(listo.motivo);
      return;
    }

    const cola = music.getCola(ctx.guild.id);
    if (!cola || (!cola.current && cola.tracks.length === 0)) {
      await ctx.errorReply('La cola está vacía. Añade algo con `play`.');
      return;
    }

    const paginas = Math.max(1, Math.ceil(cola.tracks.length / POR_PAGINA));
    const pagina = Math.min(Math.max(1, ctx.options.getInteger('pagina') || 1), paginas);

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.default)
      .setAuthor({ name: `🎶 Cola de ${ctx.guild.name}` });

    // ── Lo que suena ahora ─────────────────────────────────────
    if (cola.current) {
      const { info } = cola.current;
      const posicion = cola.player.position || 0;

      const progreso = info.isStream
        ? '🔴 En directo'
        : `${music.formatearDuracion(posicion)} ${music.barraProgreso(
            posicion,
            info.length
          )} ${music.formatearDuracion(info.length)}`;

      embed.addFields({
        name: cola.player.paused ? '⏸️ En pausa' : '▶️ Sonando ahora',
        value: [
          info.uri ? `**[${recortar(info.title)}](${info.uri})**` : `**${recortar(info.title)}**`,
          progreso,
          cola.current.pedidaPor ? `Pedida por ${cola.current.pedidaPor.tag}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      });
    }

    // ── Lo que viene después ───────────────────────────────────
    if (cola.tracks.length > 0) {
      const inicio = (pagina - 1) * POR_PAGINA;
      const lote = cola.tracks.slice(inicio, inicio + POR_PAGINA);

      const lineas = lote.map((track, i) => {
        const numero = inicio + i + 1;
        const titulo = recortar(track.info.title, 45);
        const duracion = track.info.isStream
          ? 'directo'
          : music.formatearDuracion(track.info.length);

        const enlace = track.info.uri ? `[${titulo}](${track.info.uri})` : titulo;
        return `\`${String(numero).padStart(2, ' ')}.\` ${enlace} \`${duracion}\``;
      });

      embed.addFields({
        name: `📋 A continuación (${cola.tracks.length})`,
        value: lineas.join('\n').slice(0, 1024),
      });
    }

    // ── Resumen ────────────────────────────────────────────────
    const resumen = [
      `**Volumen:** ${cola.volume} %`,
      `**Repetición:** ${music.BUCLES[cola.loop]}`,
    ];

    if (cola.filtro !== 'ninguno') {
      resumen.push(`**Filtro:** ${music.FILTROS[cola.filtro]?.nombre || cola.filtro}`);
    }
    if (!cola.tieneDirectos && cola.tracks.length > 0) {
      resumen.push(`**Queda:** ${music.formatearDuracion(cola.duracionRestante)}`);
    }

    embed.addFields({ name: '​', value: resumen.join(' · ') });

    if (paginas > 1) {
      embed.setFooter({ text: `Página ${pagina} de ${paginas} · ${ctx.prefix}queue <número>` });
    }

    await ctx.reply({ embeds: [embed] });
  },
};

/** Recorta un título para que quepa sin romper el diseño. */
function recortar(texto, largo = 60) {
  const limpio = String(texto || '')
    // Los corchetes y paréntesis romperían el enlace de Markdown.
    .replace(/[[\]()]/g, '');
  return limpio.length > largo ? `${limpio.slice(0, largo)}…` : limpio;
}

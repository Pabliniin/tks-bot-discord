'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { EMBED_COLORS } = require('@tkbot/shared');

const music = require('../../modules/music');
const guards = require('../../utils/musicGuards');

/** Fuentes de búsqueda que se ofrecen. */
const FUENTES = [
  { name: 'YouTube Music (mejor para canciones)', value: 'ytmsearch' },
  { name: 'YouTube', value: 'ytsearch' },
  { name: 'SoundCloud', value: 'scsearch' },
  { name: 'Deezer', value: 'dzsearch' },
];

module.exports = {
  name: 'play',
  category: 'music',
  aliases: ['p', 'reproducir', 'poner', 'sonar'],
  description: 'Reproduce una canción o la añade a la cola.',
  usage: '<canción o enlace>',
  examples: [
    'play never gonna give you up',
    'play https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  ],
  cooldown: 3,
  botPermissions: ['Connect', 'Speak'],

  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Reproduce una canción o la añade a la cola.')
    .addStringOption((option) =>
      option
        .setName('cancion')
        .setDescription('Nombre de la canción, o un enlace.')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('fuente')
        .setDescription('Dónde buscar. Por defecto, la del servidor.')
        .setRequired(false)
        .addChoices(...FUENTES)
    ),

  async execute(ctx) {
    const consulta = ctx.options.getString('cancion', true);

    // ── Comprobaciones ─────────────────────────────────────────
    const canal = guards.canalPermitido(ctx);
    if (!canal.ok) {
      await ctx.errorReply(canal.motivo);
      return;
    }

    const listo = guards.servicioListo(ctx);
    if (!listo.ok) {
      await ctx.errorReply(listo.motivo);
      return;
    }

    const voz = guards.enCanalDeVoz(ctx);
    if (!voz.ok) {
      await ctx.errorReply(voz.motivo);
      return;
    }

    /*
     * Si ya hay música sonando en otro canal, no se secuestra: el bot solo
     * puede estar en uno, y moverlo dejaría colgados a quienes ya escuchaban.
     */
    const colaExistente = music.getCola(ctx.guild.id);
    if (colaExistente && colaExistente.voiceChannelId !== voz.canal.id) {
      await ctx.errorReply(
        `Ya estoy reproduciendo música en <#${colaExistente.voiceChannelId}>. Únete a ese canal.`
      );
      return;
    }

    const control = guards.puedeControlar(ctx, colaExistente);
    if (!control.ok) {
      await ctx.errorReply(control.motivo);
      return;
    }

    await ctx.defer();

    // ── Búsqueda ───────────────────────────────────────────────
    const fuente =
      ctx.options.getString('fuente') || ctx.settings.music?.defaultSource || 'ytmsearch';

    const resultado = await music.buscar(consulta, fuente);

    if (resultado.error) {
      await ctx.errorReply(`No se pudo buscar: ${resultado.error}`);
      return;
    }
    if (resultado.tipo === 'empty' || resultado.tracks.length === 0) {
      await ctx.errorReply(
        `No he encontrado nada para **${consulta}**.\nPrueba con otro nombre, o pega el enlace directamente.`
      );
      return;
    }

    // ── Conexión ───────────────────────────────────────────────
    let cola;
    try {
      cola =
        colaExistente ||
        (await music.conectar(
          ctx.guild,
          voz.canal.id,
          ctx.channel.id,
          ctx.settings.music?.defaultVolume || 100
        ));
    } catch (err) {
      await ctx.errorReply(`No he podido entrar en ${voz.canal}: ${err.message}`);
      return;
    }

    // ── Añadir a la cola ───────────────────────────────────────
    // De una búsqueda por texto se coge el primer resultado; de una playlist,
    // todas las canciones.
    const aAnadir = resultado.tipo === 'playlist' ? resultado.tracks : [resultado.tracks[0]];

    const hueco = music.MAX_COLA - cola.tracks.length;
    if (hueco <= 0) {
      await ctx.errorReply(`La cola está llena (${music.MAX_COLA} canciones).`);
      return;
    }

    const aceptadas = aAnadir.slice(0, hueco);
    const descartadas = aAnadir.length - aceptadas.length;

    // Se recuerda quién la pidió: sale en el anuncio y permite que se salte
    // su propia canción sin necesitar el rol de DJ.
    const pedidaPor = { id: ctx.user.id, tag: ctx.user.tag ?? ctx.user.username };
    for (const track of aceptadas) track.pedidaPor = pedidaPor;

    cola.tracks.push(...aceptadas);
    music.cancelarInactividad(cola);

    // ── Arrancar si no sonaba nada ─────────────────────────────
    const empezabaVacia = !cola.current;
    if (empezabaVacia) {
      await music.siguiente(ctx.client, ctx.guild.id);
      // El anuncio lo hace el módulo al arrancar la canción: no se duplica.
      if (resultado.tipo !== 'playlist') {
        await ctx.reply({ embeds: [confirmacion(resultado, aceptadas, cola, true, descartadas)] });
        return;
      }
    }

    await ctx.reply({
      embeds: [confirmacion(resultado, aceptadas, cola, empezabaVacia, descartadas)],
    });
  },
};

/** Embed de confirmación de lo que se ha añadido. */
function confirmacion(resultado, aceptadas, cola, empezaba, descartadas) {
  const embed = new EmbedBuilder().setColor(EMBED_COLORS.success);

  if (resultado.tipo === 'playlist') {
    const duracion = aceptadas.reduce((total, t) => total + (t.info.length || 0), 0);

    embed
      .setAuthor({ name: '📃 Lista añadida a la cola' })
      .setTitle(String(resultado.playlist || 'Lista de reproducción').slice(0, 256))
      .addFields(
        { name: 'Canciones', value: String(aceptadas.length), inline: true },
        { name: 'Duración', value: music.formatearDuracion(duracion), inline: true },
        { name: 'En cola', value: String(cola.tracks.length), inline: true }
      );

    if (aceptadas[0]?.info.artworkUrl) embed.setThumbnail(aceptadas[0].info.artworkUrl);
    if (descartadas > 0) {
      embed.setFooter({ text: `Se descartaron ${descartadas} por el límite de la cola.` });
    }
    return embed;
  }

  const track = aceptadas[0];
  const { info } = track;

  embed
    .setAuthor({ name: empezaba ? '🎵 Reproduciendo' : '➕ Añadida a la cola' })
    .setTitle(info.title.slice(0, 256))
    .addFields(
      { name: 'Artista', value: info.author || 'Desconocido', inline: true },
      {
        name: 'Duración',
        value: info.isStream ? '🔴 En directo' : music.formatearDuracion(info.length),
        inline: true,
      }
    );

  if (info.uri) embed.setURL(info.uri);
  if (info.artworkUrl) embed.setThumbnail(info.artworkUrl);

  if (!empezaba) {
    embed.addFields({ name: 'Posición', value: `#${cola.tracks.length}`, inline: true });

    // Cuánto queda para que suene, si se puede calcular.
    if (!cola.tieneDirectos) {
      const espera = cola.duracionRestante - (track.info.length || 0);
      if (espera > 0) {
        embed.setFooter({ text: `Sonará dentro de unos ${music.formatearDuracion(espera)}` });
      }
    }
  }

  return embed;
}

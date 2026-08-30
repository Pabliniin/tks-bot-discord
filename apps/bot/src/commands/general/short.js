'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { EMBED_COLORS } = require('@tkbot/shared');

/**
 * Acortador de URL.
 *
 * Usa el servicio gratuito is.gd, que no necesita clave de API. Si prefieres
 * otro proveedor, cambia `shorten()` por la llamada correspondiente.
 */
async function shorten(url) {
  const endpoint = `https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`;

  // Sin tiempo límite, un servicio caído dejaría el comando colgado.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: { 'User-Agent': 'TKBot/1.0' },
    });
    const data = await response.json();

    if (data.shorturl) return { ok: true, url: data.shorturl };
    return { ok: false, error: data.errormessage || 'El servicio ha rechazado la URL.' };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { ok: false, error: 'El servicio de acortado ha tardado demasiado en responder.' };
    }
    return { ok: false, error: 'No se ha podido contactar con el servicio de acortado.' };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  name: 'short',
  category: 'general',
  aliases: ['acortar', 'shorten'],
  description: 'Acorta una URL.',
  usage: '<url>',
  examples: ['short https://ejemplo.com/una/ruta/muy/larga'],
  cooldown: 10,
  guildOnly: false,

  data: new SlashCommandBuilder()
    .setName('short')
    .setDescription('Acorta una URL.')
    .addStringOption((option) =>
      option.setName('url').setDescription('La dirección que quieres acortar.').setRequired(true)
    ),

  async execute(ctx) {
    const input = ctx.options.getString('url', true).trim();

    let parsed;
    try {
      parsed = new URL(input);
    } catch {
      await ctx.errorReply('Eso no es una URL válida. Debe empezar por `http://` o `https://`.');
      return;
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      await ctx.errorReply('Solo se admiten direcciones `http` y `https`.');
      return;
    }

    await ctx.defer();

    const result = await shorten(parsed.toString());

    if (!result.ok) {
      await ctx.reply({
        embeds: [require('../../utils/embeds').error(result.error)],
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.success)
      .setTitle('🔗 URL acortada')
      .addFields(
        { name: 'Original', value: `\`${parsed.toString().slice(0, 1000)}\`` },
        { name: 'Acortada', value: result.url }
      )
      .setTimestamp();

    await ctx.reply({ embeds: [embed] });
  },
};

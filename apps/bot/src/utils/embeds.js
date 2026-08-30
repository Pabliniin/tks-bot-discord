'use strict';

const { EmbedBuilder } = require('discord.js');
const { EMBED_COLORS, parseEmbedVariables } = require('@tkbot/shared');

/** Límites que impone la API de Discord a los embeds. */
const LIMITS = {
  title: 256,
  description: 4096,
  fieldName: 256,
  fieldValue: 1024,
  footer: 2048,
  authorName: 256,
  fields: 25,
};

/** Recorta un texto añadiendo puntos suspensivos si excede el límite. */
function truncate(text, max) {
  const str = String(text ?? '');
  if (str.length <= max) return str;
  return `${str.slice(0, max - 1)}…`;
}

/** `true` si la cadena parece una URL http(s) válida. */
function isValidUrl(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Convierte `#RRGGBB` a entero; devuelve el color por defecto si no es válido. */
function parseColor(hex, fallback = EMBED_COLORS.default) {
  if (typeof hex === 'number' && Number.isFinite(hex)) return hex;
  if (typeof hex !== 'string') return fallback;
  const cleaned = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return fallback;
  return parseInt(cleaned, 16);
}

/** Embed de respuesta rápida con un color según el tipo. */
function simple(description, type = 'default', title = null) {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS[type] ?? EMBED_COLORS.default)
    .setDescription(truncate(description, LIMITS.description));
  if (title) embed.setTitle(truncate(title, LIMITS.title));
  return embed;
}

const success = (description, title) => simple(`✅ ${description}`, 'success', title);
const error = (description, title) => simple(`❌ ${description}`, 'error', title);
const warning = (description, title) => simple(`⚠️ ${description}`, 'warning', title);
const info = (description, title) => simple(`ℹ️ ${description}`, 'info', title);

/**
 * Convierte un diseño de embed guardado en el panel a un `EmbedBuilder`.
 * Devuelve `null` si el resultado quedaría vacío (Discord lo rechazaría).
 *
 * @param {object} design Diseño almacenado en la base de datos.
 * @param {Record<string, unknown>} [variables] Variables a sustituir.
 * @returns {EmbedBuilder|null}
 */
function buildFromDesign(design, variables = {}) {
  if (!design) return null;
  const data = parseEmbedVariables(design, variables);

  const embed = new EmbedBuilder().setColor(parseColor(data.color));
  let hasContent = false;

  if (data.title) {
    embed.setTitle(truncate(data.title, LIMITS.title));
    hasContent = true;
  }
  if (data.description) {
    embed.setDescription(truncate(data.description, LIMITS.description));
    hasContent = true;
  }
  if (data.url && isValidUrl(data.url)) embed.setURL(data.url);

  if (data.author?.name) {
    embed.setAuthor({
      name: truncate(data.author.name, LIMITS.authorName),
      iconURL: isValidUrl(data.author.icon) ? data.author.icon : undefined,
      url: isValidUrl(data.author.url) ? data.author.url : undefined,
    });
    hasContent = true;
  }

  if (isValidUrl(data.thumbnail)) {
    embed.setThumbnail(data.thumbnail);
    hasContent = true;
  }
  if (isValidUrl(data.image)) {
    embed.setImage(data.image);
    hasContent = true;
  }

  if (data.footer?.text) {
    embed.setFooter({
      text: truncate(data.footer.text, LIMITS.footer),
      iconURL: isValidUrl(data.footer.icon) ? data.footer.icon : undefined,
    });
    hasContent = true;
  }

  if (data.timestamp) embed.setTimestamp();

  const fields = (data.fields || [])
    // Discord rechaza campos con nombre o valor vacíos.
    .filter((f) => f && f.name && f.value)
    .slice(0, LIMITS.fields)
    .map((f) => ({
      name: truncate(f.name, LIMITS.fieldName),
      value: truncate(f.value, LIMITS.fieldValue),
      inline: Boolean(f.inline),
    }));

  if (fields.length > 0) {
    embed.addFields(fields);
    hasContent = true;
  }

  return hasContent ? embed : null;
}

module.exports = {
  LIMITS,
  truncate,
  isValidUrl,
  parseColor,
  simple,
  success,
  error,
  warning,
  info,
  buildFromDesign,
};

'use strict';

/**
 * Detectores puros del AutoMod.
 *
 * Se mantienen aquí, sin dependencias de discord.js, para poder probarlos
 * de forma aislada (`tests/automod.test.js`).
 */

/** Invitaciones a servidores de Discord, incluidas las variantes antiguas. */
const INVITE_REGEX =
  /(?:https?:\/\/)?(?:www\.)?(?:discord(?:app)?\.com\/invite|discord\.gg|discord\.me|dsc\.gg|invite\.gg)\/([a-zA-Z0-9-_]+)/gi;

/** Cualquier enlace http(s) o dominio suelto con TLD conocido. */
const LINK_REGEX =
  /(?:https?:\/\/|www\.)[^\s<>[\]{}|\\^]+|\b[a-z0-9-]+\.(?:com|net|org|io|gg|me|xyz|dev|app|co|tv|es|info|biz|online|site|link|club|shop|store|top|ru|cn)\b(?:\/[^\s]*)?/gi;

/** Emojis personalizados de Discord: `<:nombre:id>` y `<a:nombre:id>`. */
const CUSTOM_EMOJI_REGEX = /<a?:\w+:\d+>/g;

/** Emojis unicode. */
const UNICODE_EMOJI_REGEX = /\p{Extended_Pictographic}/gu;

/** Marcas diacríticas combinantes, usadas para el texto "zalgo". */
const COMBINING_REGEX = /[\u0300-\u036f\u0483-\u0489\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20f0]/g;

/** Cuenta cuántas veces aparece un patrón global. */
function countMatches(text, regex) {
  const matches = String(text).match(regex);
  return matches ? matches.length : 0;
}

/**
 * ¿Contiene invitaciones a otros servidores?
 * @param {string} content
 * @param {{ allowOwnInvites?: boolean, guildInviteCodes?: string[] }} [options]
 */
function hasInvite(content, options = {}) {
  const matches = [...String(content).matchAll(INVITE_REGEX)];
  if (matches.length === 0) return false;

  if (options.allowOwnInvites && Array.isArray(options.guildInviteCodes)) {
    // Solo infringe si alguna invitación NO es del propio servidor.
    return matches.some((m) => !options.guildInviteCodes.includes(m[1]));
  }
  return true;
}

/**
 * ¿Contiene enlaces no permitidos?
 * @param {string} content
 * @param {string[]} [allowed] Dominios en lista blanca.
 */
function hasLink(content, allowed = []) {
  const matches = String(content).match(LINK_REGEX);
  if (!matches) return false;
  if (!Array.isArray(allowed) || allowed.length === 0) return true;

  const whitelist = allowed.map((d) => d.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, ''));
  return matches.some((raw) => {
    const url = raw.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
    return !whitelist.some((domain) => url === domain || url.startsWith(`${domain}/`));
  });
}

/**
 * ¿Contiene alguna palabra prohibida?
 * La comparación ignora mayúsculas y tildes, y detecta la palabra aunque vaya
 * pegada a signos de puntuación.
 *
 * @returns {string|null} La palabra encontrada, o `null`.
 */
function findBannedWord(content, bannedWords = []) {
  if (!Array.isArray(bannedWords) || bannedWords.length === 0) return null;

  const normalize = (text) =>
    String(text)
      .toLowerCase()
      .normalize('NFD')
      .replace(COMBINING_REGEX, '');

  const haystack = normalize(content);

  for (const word of bannedWords) {
    const needle = normalize(word).trim();
    if (needle.length === 0) continue;

    // `*palabra*` busca la subcadena en cualquier posición.
    if (needle.startsWith('*') && needle.endsWith('*')) {
      const inner = needle.slice(1, -1);
      if (inner && haystack.includes(inner)) return word;
      continue;
    }

    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:[^\\p{L}\\p{N}]|$)`, 'u').test(haystack)) {
      return word;
    }
  }
  return null;
}

/**
 * ¿Supera el porcentaje de mayúsculas permitido?
 * @param {string} content
 * @param {number} percentage Porcentaje máximo (0-100).
 * @param {number} minLength Longitud mínima para aplicar el filtro.
 */
function hasExcessiveCaps(content, percentage = 70, minLength = 10) {
  const letters = String(content).replace(/[^\p{L}]/gu, '');
  if (letters.length < minLength) return false;

  const upper = letters.replace(/[^\p{Lu}]/gu, '').length;
  return (upper / letters.length) * 100 >= percentage;
}

/** ¿Supera el número máximo de menciones? Cuenta usuarios, roles y @everyone. */
function hasExcessiveMentions(content, max = 5) {
  const users = countMatches(content, /<@!?\d{16,20}>/g);
  const roles = countMatches(content, /<@&\d{16,20}>/g);
  const everyone = /@(?:everyone|here)/.test(String(content)) ? 1 : 0;
  return users + roles + everyone > max;
}

/** ¿Supera el número máximo de emojis? */
function hasExcessiveEmojis(content, max = 10) {
  const total =
    countMatches(content, CUSTOM_EMOJI_REGEX) + countMatches(content, UNICODE_EMOJI_REGEX);
  return total > max;
}

/**
 * ¿Es texto "zalgo"?
 * Se considera así cuando hay muchas marcas combinantes respecto a la longitud.
 */
function isZalgo(content, ratio = 0.4) {
  const text = String(content);
  if (text.length < 5) return false;
  const combining = countMatches(text.normalize('NFD'), COMBINING_REGEX);
  return combining / text.length > ratio;
}

/** ¿Supera el número máximo de saltos de línea? */
function hasExcessiveNewlines(content, max = 10) {
  return countMatches(content, /\n/g) > max;
}

module.exports = {
  INVITE_REGEX,
  LINK_REGEX,
  hasInvite,
  hasLink,
  findBannedWord,
  hasExcessiveCaps,
  hasExcessiveMentions,
  hasExcessiveEmojis,
  isZalgo,
  hasExcessiveNewlines,
  countMatches,
};

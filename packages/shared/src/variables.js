'use strict';

/**
 * Sustituye las variables entre corchetes de un texto configurado desde el panel.
 *
 * Las claves se comparan sin distinguir mayúsculas para que `[User]` y `[user]`
 * funcionen igual, tal y como esperan los usuarios que copian ejemplos.
 *
 * @param {string} input Texto con variables, p. ej. `Hola [user]`.
 * @param {Record<string, string|number|null|undefined>} data Valores disponibles.
 * @returns {string} Texto con las variables sustituidas.
 */
function parseVariables(input, data = {}) {
  if (typeof input !== 'string' || input.length === 0) return '';

  // Índice en minúsculas para la búsqueda insensible a mayúsculas.
  const lookup = new Map();
  for (const [key, value] of Object.entries(data)) {
    lookup.set(key.toLowerCase(), value);
  }

  return input.replace(/\[([a-zA-Z0-9_.]+)\]/g, (match, key) => {
    const value = lookup.get(key.toLowerCase());
    if (value === undefined || value === null) return match;
    return String(value);
  });
}

/**
 * Construye el mapa de variables de un miembro para bienvenidas y despedidas.
 * @param {import('discord.js').GuildMember} member
 * @param {{ inviter?: import('discord.js').User|null, memberCount?: number }} [extra]
 */
function memberVariables(member, extra = {}) {
  const guild = member.guild;
  const user = member.user;
  const inviter = extra.inviter ?? null;

  return {
    user: `<@${user.id}>`,
    userName: user.username,
    userTag: user.tag ?? user.username,
    userId: user.id,
    'user.username': user.username,
    'user.tag': user.tag ?? user.username,
    'user.id': user.id,
    userAvatar: user.displayAvatarURL({ extension: 'png', size: 512 }),
    server: guild.name,
    serverId: guild.id,
    memberCount: extra.memberCount ?? guild.memberCount,
    inviter: inviter ? `<@${inviter.id}>` : 'Desconocido',
    inviterName: inviter ? inviter.username : 'Desconocido',
    createdAt: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
    joinedAt: member.joinedTimestamp
      ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
      : 'Desconocido',
  };
}

/**
 * Variables disponibles al anunciar una subida de nivel.
 * @param {import('discord.js').GuildMember} member
 * @param {number} level Nivel alcanzado.
 * @param {number} oldLevel Nivel anterior.
 */
function levelVariables(member, level, oldLevel) {
  return {
    ...memberVariables(member),
    level,
    oldLevel,
  };
}

/**
 * Aplica `parseVariables` a todos los campos de texto de un embed configurado.
 * Devuelve un objeto nuevo; no modifica el original.
 *
 * @param {object} embed Diseño de embed guardado en la base de datos.
 * @param {Record<string, unknown>} data Variables.
 */
function parseEmbedVariables(embed, data = {}) {
  if (!embed || typeof embed !== 'object') return embed;

  // `toObject` cuando viene de mongoose, si no una copia superficial.
  const source = typeof embed.toObject === 'function' ? embed.toObject() : embed;

  return {
    ...source,
    title: parseVariables(source.title || '', data),
    description: parseVariables(source.description || '', data),
    url: parseVariables(source.url || '', data),
    author: source.author
      ? {
          name: parseVariables(source.author.name || '', data),
          icon: parseVariables(source.author.icon || '', data),
          url: parseVariables(source.author.url || '', data),
        }
      : undefined,
    thumbnail: parseVariables(source.thumbnail || '', data),
    image: parseVariables(source.image || '', data),
    footer: source.footer
      ? {
          text: parseVariables(source.footer.text || '', data),
          icon: parseVariables(source.footer.icon || '', data),
        }
      : undefined,
    fields: Array.isArray(source.fields)
      ? source.fields.map((f) => ({
          name: parseVariables(f.name || '', data),
          value: parseVariables(f.value || '', data),
          inline: Boolean(f.inline),
        }))
      : [],
  };
}

module.exports = {
  parseVariables,
  memberVariables,
  levelVariables,
  parseEmbedVariables,
};

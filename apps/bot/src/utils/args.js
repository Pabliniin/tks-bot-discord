'use strict';

/** Tokenización y resolución de argumentos para los comandos por prefijo. */

/**
 * Divide una cadena en tokens respetando las comillas.
 * `ban @user "spam en varios canales"` → `['@user', 'spam en varios canales']`
 *
 * @param {string} input
 * @returns {string[]}
 */
function tokenize(input) {
  if (typeof input !== 'string') return [];
  const tokens = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match;
  while ((match = pattern.exec(input)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3]);
  }
  return tokens;
}

/** Extrae un ID de una mención de usuario, canal o rol, o de un ID suelto. */
function extractId(token) {
  if (typeof token !== 'string') return null;
  const mention = token.match(/^<(?:@[!&]?|#)(\d{16,20})>$/);
  if (mention) return mention[1];
  if (/^\d{16,20}$/.test(token)) return token;
  return null;
}

/**
 * Busca un miembro por mención, ID, tag, nombre de usuario o apodo.
 * @param {import('discord.js').Guild} guild
 * @param {string} token
 * @returns {Promise<import('discord.js').GuildMember|null>}
 */
async function resolveMember(guild, token) {
  if (!guild || !token) return null;

  const id = extractId(token);
  if (id) {
    const cached = guild.members.cache.get(id);
    if (cached) return cached;
    try {
      return await guild.members.fetch(id);
    } catch {
      return null;
    }
  }

  const query = token.toLowerCase();
  const cached = guild.members.cache.find(
    (m) =>
      m.user.username.toLowerCase() === query ||
      m.user.tag.toLowerCase() === query ||
      (m.nickname && m.nickname.toLowerCase() === query)
  );
  if (cached) return cached;

  // Búsqueda en la API cuando el miembro no está en caché.
  try {
    const results = await guild.members.fetch({ query: token, limit: 1 });
    return results.first() ?? null;
  } catch {
    return null;
  }
}

/**
 * Busca un usuario global (aunque no esté en el servidor).
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').Guild|null} guild
 * @param {string} token
 */
async function resolveUser(client, guild, token) {
  const member = guild ? await resolveMember(guild, token) : null;
  if (member) return member.user;

  const id = extractId(token);
  if (!id) return null;

  const cached = client.users.cache.get(id);
  if (cached) return cached;
  try {
    return await client.users.fetch(id);
  } catch {
    return null;
  }
}

/** Busca un canal por mención, ID o nombre. */
function resolveChannel(guild, token, types = null) {
  if (!guild || !token) return null;

  const id = extractId(token);
  let channel = id ? guild.channels.cache.get(id) : null;

  if (!channel) {
    const query = token.toLowerCase().replace(/^#/, '');
    channel = guild.channels.cache.find((c) => c.name.toLowerCase() === query) ?? null;
  }

  if (channel && Array.isArray(types) && types.length > 0 && !types.includes(channel.type)) {
    return null;
  }
  return channel;
}

/** Busca un rol por mención, ID o nombre. */
function resolveRole(guild, token) {
  if (!guild || !token) return null;

  const id = extractId(token);
  if (id) {
    const role = guild.roles.cache.get(id);
    if (role) return role;
  }

  const query = token.toLowerCase().replace(/^@/, '');
  if (query === 'everyone') return guild.roles.everyone;
  return guild.roles.cache.find((r) => r.name.toLowerCase() === query) ?? null;
}

/** Interpreta un token como booleano. Devuelve `null` si no lo es. */
function resolveBoolean(token) {
  if (typeof token !== 'string') return null;
  const value = token.toLowerCase();
  if (['true', 'si', 'sí', 'yes', 'y', 's', '1', 'on', 'activar'].includes(value)) return true;
  if (['false', 'no', 'n', '0', 'off', 'desactivar'].includes(value)) return false;
  return null;
}

module.exports = {
  tokenize,
  extractId,
  resolveMember,
  resolveUser,
  resolveChannel,
  resolveRole,
  resolveBoolean,
};

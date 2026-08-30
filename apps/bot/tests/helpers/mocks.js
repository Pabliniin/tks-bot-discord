'use strict';

/**
 * Dobles de prueba mínimos de discord.js.
 *
 * Solo implementan lo que usa `OptionResolver`, de modo que se puede probar el
 * análisis de argumentos sin conectar con Discord.
 */

/** Colección con la API de `Collection` que se usa en las pruebas. */
class FakeCollection extends Map {
  find(fn) {
    for (const [, value] of this) {
      if (fn(value)) return value;
    }
    return undefined;
  }

  filter(fn) {
    const result = new FakeCollection();
    for (const [key, value] of this) {
      if (fn(value)) result.set(key, value);
    }
    return result;
  }

  first() {
    return this.values().next().value;
  }
}

function makeUser({ id, username, bot = false }) {
  return {
    id,
    username,
    tag: `${username}`,
    bot,
    displayAvatarURL: () => `https://cdn.example/${id}.png`,
  };
}

function makeMember(guild, { id, username, nickname = null }) {
  const user = makeUser({ id, username });
  return {
    id,
    user,
    guild,
    nickname,
    displayName: nickname || username,
    roles: { cache: new FakeCollection() },
  };
}

function makeRole(guild, { id, name }) {
  return { id, name, guild };
}

function makeChannel(guild, { id, name, type = 0, parentId = null }) {
  return { id, name, type, parentId, guild };
}

/**
 * Construye un servidor falso con miembros, roles y canales.
 * @returns {{ guild: object, client: object }}
 */
function makeGuild() {
  const guild = {
    id: '100000000000000000',
    name: 'Servidor de prueba',
    members: { cache: new FakeCollection(), fetch: async () => null },
    roles: { cache: new FakeCollection(), everyone: null },
    channels: { cache: new FakeCollection() },
  };

  guild.roles.everyone = makeRole(guild, { id: guild.id, name: '@everyone' });

  const rogue = makeMember(guild, { id: '200000000000000001', username: 'Rogue' });
  const amigo = makeMember(guild, { id: '200000000000000002', username: 'Amigo', nickname: 'Colega' });
  guild.members.cache.set(rogue.id, rogue);
  guild.members.cache.set(amigo.id, amigo);

  // `fetch` por ID devuelve el miembro cacheado; en otro caso, nada.
  guild.members.fetch = async (query) => {
    if (typeof query === 'string') {
      const found = guild.members.cache.get(query);
      if (found) return found;
      throw new Error('Unknown Member');
    }
    return new FakeCollection();
  };

  const modRole = makeRole(guild, { id: '300000000000000001', name: 'Moderador' });
  guild.roles.cache.set(modRole.id, modRole);

  const general = makeChannel(guild, { id: '400000000000000001', name: 'general' });
  const voz = makeChannel(guild, { id: '400000000000000002', name: 'voz', type: 2 });
  guild.channels.cache.set(general.id, general);
  guild.channels.cache.set(voz.id, voz);

  const client = {
    users: {
      cache: new FakeCollection(),
      fetch: async (id) => {
        const member = guild.members.cache.get(id);
        if (member) return member.user;
        throw new Error('Unknown User');
      },
    },
  };

  return { guild, client, members: { rogue, amigo }, roles: { modRole }, channels: { general, voz } };
}

module.exports = { FakeCollection, makeGuild, makeUser, makeMember, makeRole, makeChannel };

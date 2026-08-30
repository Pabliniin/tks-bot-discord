'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PermissionsBitField } = require('discord.js');

const logs = require('../src/modules/logs');

/**
 * Pruebas del módulo de registros.
 *
 * Cubren las condiciones que deciden si un evento se registra o no, que es
 * donde más fácil resulta que algo deje de funcionar sin darse cuenta.
 */

/** Canal de texto falso con los permisos que se le indiquen. */
function makeChannel(id, name, permisos = ['ViewChannel', 'SendMessages', 'EmbedLinks'], parentId = null) {
  const bits = new PermissionsBitField(permisos.map((p) => PermissionsBitField.Flags[p]));

  const channel = {
    id,
    name,
    parentId,
    isTextBased: () => true,
    permissionsFor: () => bits,
  };
  return channel;
}

/** Servidor falso con los canales indicados. */
function makeGuild(channels = []) {
  const guild = {
    id: '100000000000000000',
    name: 'Servidor',
    channels: { cache: new Map(channels.map((c) => [c.id, c])) },
    members: { me: { id: 'bot', permissions: new PermissionsBitField(0n) } },
  };
  // `missingChannelPermissions` accede a `channel.guild.members.me`.
  for (const c of channels) c.guild = guild;
  return guild;
}

const CANAL = '400000000000000001';
const OTRO_CANAL = '400000000000000002';

/** Configuración con los eventos como objeto plano (así llega del panel). */
function settingsPlano(overrides = {}) {
  return {
    logs: {
      enabled: true,
      defaultChannelId: CANAL,
      ignoredChannels: [],
      ignoredRoles: [],
      ignoreBots: true,
      events: { messageDelete: { enabled: true, channelId: null } },
      ...overrides,
    },
  };
}

/** La misma configuración pero con `events` como Map (así llega de mongoose). */
function settingsMap(eventos) {
  return {
    logs: {
      enabled: true,
      defaultChannelId: CANAL,
      ignoredChannels: [],
      events: new Map(Object.entries(eventos)),
    },
  };
}

// ── Lectura de la configuración de cada evento ────────────────

test('lee los eventos tanto de un objeto plano como de un Map', () => {
  const plano = settingsPlano();
  assert.equal(logs.eventConfig(plano, 'messageDelete').enabled, true);

  const mapa = settingsMap({ messageDelete: { enabled: true, channelId: null } });
  assert.equal(logs.eventConfig(mapa, 'messageDelete').enabled, true);
});

test('un evento no configurado devuelve null', () => {
  assert.equal(logs.eventConfig(settingsPlano(), 'roleCreate'), null);
  assert.equal(logs.eventConfig(settingsMap({}), 'roleCreate'), null);
  assert.equal(logs.eventConfig({}, 'messageDelete'), null);
  assert.equal(logs.eventConfig(null, 'messageDelete'), null);
});

// ── Elección del canal ────────────────────────────────────────

test('usa el canal por defecto cuando el evento no tiene uno propio', () => {
  const guild = makeGuild([makeChannel(CANAL, 'registros')]);
  const canal = logs.resolveChannel(guild, settingsPlano(), 'messageDelete');

  assert.ok(canal, 'debería encontrar el canal');
  assert.equal(canal.id, CANAL);
});

test('el canal propio del evento tiene prioridad sobre el general', () => {
  const guild = makeGuild([makeChannel(CANAL, 'registros'), makeChannel(OTRO_CANAL, 'mensajes')]);
  const settings = settingsPlano({
    events: { messageDelete: { enabled: true, channelId: OTRO_CANAL } },
  });

  assert.equal(logs.resolveChannel(guild, settings, 'messageDelete').id, OTRO_CANAL);
});

test('no registra nada si el módulo está desactivado', () => {
  const guild = makeGuild([makeChannel(CANAL, 'registros')]);
  const settings = settingsPlano({ enabled: false });

  assert.equal(logs.resolveChannel(guild, settings, 'messageDelete'), null);
});

test('no registra un evento que está desactivado', () => {
  const guild = makeGuild([makeChannel(CANAL, 'registros')]);
  const settings = settingsPlano({
    events: { messageDelete: { enabled: false, channelId: null } },
  });

  assert.equal(logs.resolveChannel(guild, settings, 'messageDelete'), null);
});

test('no registra si no hay ningún canal configurado', () => {
  const guild = makeGuild([makeChannel(CANAL, 'registros')]);
  const settings = settingsPlano({ defaultChannelId: null });

  assert.equal(logs.resolveChannel(guild, settings, 'messageDelete'), null);
});

test('no registra si el canal configurado ya no existe', () => {
  const guild = makeGuild([]); // el canal fue borrado
  assert.equal(logs.resolveChannel(guild, settingsPlano(), 'messageDelete'), null);
});

test('no registra si al bot le faltan permisos en el canal', () => {
  // Sin permiso para insertar enlaces no puede enviar el embed.
  const guild = makeGuild([makeChannel(CANAL, 'registros', ['ViewChannel', 'SendMessages'])]);
  assert.equal(logs.resolveChannel(guild, settingsPlano(), 'messageDelete'), null);

  // Con los tres permisos, sí.
  const ok = makeGuild([makeChannel(CANAL, 'registros')]);
  assert.ok(logs.resolveChannel(ok, settingsPlano(), 'messageDelete'));
});

// ── Exclusiones ───────────────────────────────────────────────

test('ignora los canales excluidos, y también por su categoría', () => {
  const settings = settingsPlano({ ignoredChannels: ['999', '888'] });

  assert.equal(logs.isIgnoredChannel(settings, { id: '999', parentId: null }), true);
  assert.equal(logs.isIgnoredChannel(settings, { id: '111', parentId: '888' }), true);
  assert.equal(logs.isIgnoredChannel(settings, { id: '111', parentId: '222' }), false);
  assert.equal(logs.isIgnoredChannel(settings, null), false);
});

test('ignora a los bots solo si está configurado así', () => {
  const bot = { user: { bot: true }, roles: { cache: new Map() } };
  const persona = { user: { bot: false }, roles: { cache: new Map() } };

  assert.equal(logs.isIgnoredMember(settingsPlano(), bot), true);
  assert.equal(logs.isIgnoredMember(settingsPlano({ ignoreBots: false }), bot), false);
  assert.equal(logs.isIgnoredMember(settingsPlano(), persona), false);
});

test('ignora a los miembros con un rol excluido', () => {
  const settings = settingsPlano({ ignoredRoles: ['777'] });
  const miembro = {
    user: { bot: false },
    roles: { cache: { has: (id) => id === '777' } },
  };

  assert.equal(logs.isIgnoredMember(settings, miembro), true);
});

// ── Construcción del embed ────────────────────────────────────

test('baseEmbed genera un embed válido para Discord', () => {
  const embed = logs.baseEmbed({
    title: '🗑️ Mensaje eliminado',
    color: 'error',
    user: { tag: 'Rogue', id: '1', displayAvatarURL: () => 'https://x/a.png' },
  });

  const json = embed.toJSON();
  assert.equal(json.title, '🗑️ Mensaje eliminado');
  assert.ok(json.author.name.includes('Rogue'));
  assert.ok(json.timestamp, 'debe llevar marca de tiempo');
  assert.equal(typeof json.color, 'number');
});

test('baseEmbed funciona sin usuario ni descripción', () => {
  assert.doesNotThrow(() => logs.baseEmbed({ title: 'Prueba' }).toJSON());
});

// ── Todos los eventos declarados son alcanzables ──────────────

test('cada evento del panel se puede activar y resolver su canal', () => {
  const { LOG_EVENTS } = require('@tkbot/shared/src/constants.json');
  const guild = makeGuild([makeChannel(CANAL, 'registros')]);

  for (const evento of LOG_EVENTS) {
    const settings = settingsPlano({
      events: { [evento.id]: { enabled: true, channelId: null } },
    });
    assert.ok(
      logs.resolveChannel(guild, settings, evento.id),
      `el evento "${evento.id}" no llega a resolver canal`
    );
  }
});

// ── Formato "quién ha hecho qué a quién" ──────────────────────

/** Usuario falso con lo mínimo que usan los registros. */
function usuario(id, tag) {
  return { id, tag, username: tag, displayAvatarURL: () => `https://cdn/${id}.png` };
}

test('actionEmbed pone al AUTOR en la cabecera, no al afectado', () => {
  const moderador = usuario('1', 'Moderador');
  const afectado = usuario('2', 'Afectado');

  const json = logs
    .actionEmbed({ title: 'Ha baneado a un miembro', executor: moderador, target: afectado })
    .toJSON();

  assert.ok(json.author.name.includes('Moderador'), 'la cabecera debe ser quien lo hizo');
  assert.ok(json.thumbnail.url.includes('/2.png'), 'la imagen debe ser la del afectado');
});

test('actionEmbed muestra siempre quién y a quién, en ese orden', () => {
  const json = logs
    .actionEmbed({
      title: 'Ha dado un rol',
      executor: usuario('111111111111111111', 'Mod'),
      target: usuario('222222222222222222', 'Miembro'),
    })
    .toJSON();

  assert.equal(json.fields[0].name, '👮 Lo ha hecho');
  assert.equal(json.fields[1].name, '🎯 Afectado');

  // Cada uno con mención, nombre e identificador, para poder buscarlo luego.
  assert.match(json.fields[0].value, /<@111111111111111111>/);
  assert.match(json.fields[0].value, /Mod/);
  assert.match(json.fields[1].value, /<@222222222222222222>/);
  assert.match(json.fields[1].value, /222222222222222222/);
});

test('si no se sabe quién fue, lo dice en vez de callarse', () => {
  const json = logs
    .actionEmbed({ title: 'Algo ha pasado', target: usuario('2', 'Afectado') })
    .toJSON();

  assert.equal(json.fields[0].name, '👮 Lo ha hecho');
  assert.match(json.fields[0].value, /No se ha podido/);
});

test('avisa de que falta el permiso de auditoría cuando es el motivo', () => {
  const json = logs
    .actionEmbed({
      title: 'Algo ha pasado',
      target: usuario('2', 'Afectado'),
      auditUnavailable: true,
    })
    .toJSON();

  assert.match(json.fields[0].value, /Ver registro de auditoría/);
});

test('una acción sin afectado solo muestra al autor', () => {
  const json = logs
    .actionEmbed({ title: 'Ha creado un canal', executor: usuario('1', 'Mod') })
    .toJSON();

  assert.equal(json.fields.length, 1);
  assert.equal(json.fields[0].name, '👮 Lo ha hecho');
});

test('los campos añadidos van después de quién y a quién', () => {
  const json = logs
    .actionEmbed({
      title: 'Ha aislado a un miembro',
      executor: usuario('1', 'Mod'),
      target: usuario('2', 'Afectado'),
      fields: [{ name: '📝 Razón', value: 'spam' }],
    })
    .toJSON();

  assert.equal(json.fields.length, 3);
  assert.equal(json.fields[2].name, '📝 Razón');
});

test('describeUser incluye mención, nombre e identificador', () => {
  const texto = logs.describeUser(usuario('123456789012345678', 'Rogue'));

  assert.match(texto, /<@123456789012345678>/);
  assert.match(texto, /Rogue/);
  assert.match(texto, /123456789012345678/);
  assert.equal(logs.describeUser(null), 'Desconocido');
});

test('findAuditEntry avisa si al bot le falta el permiso de auditoría', async () => {
  const { PermissionsBitField: P } = require('discord.js');
  const guild = {
    members: { me: { permissions: new P(0n) } },
    fetchAuditLogs: async () => {
      throw new Error('no deberia llamarse');
    },
  };

  const resultado = await logs.findAuditEntry(guild, 22, '1');
  assert.equal(resultado.executor, null);
  assert.equal(resultado.unavailable, true, 'debe indicar que falta el permiso');
});

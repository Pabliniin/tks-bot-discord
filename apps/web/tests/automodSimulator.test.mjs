import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { simulate } = require('@tkbot/shared/src/automodSimulator');

/**
 * Pruebas del simulador de AutoMod.
 *
 * Lo importante aquí es que el simulador diga EXACTAMENTE lo que haría el bot:
 * si miente, la gente activará filtros confiando en una prueba falsa.
 *
 * Se ejecutan con: npm run test --workspace @tkbot/web
 */

/** Configuración mínima con un filtro encendido. */
function conFiltro(id, config = {}, options = {}) {
  return {
    automod: {
      enabled: true,
      exemptModerators: true,
      ignoredChannels: [],
      ignoredRoles: [],
      filters: { [id]: { enabled: true, action: 'delete', deleteMessage: true, ...config } },
      options,
    },
  };
}

test('con el módulo apagado no bloquea nada', () => {
  const r = simulate({
    content: 'discord.gg/loquesea',
    settings: { automod: { enabled: false, filters: { invites: { enabled: true } } } },
  });

  assert.equal(r.moduloActivo, false);
  assert.equal(r.bloqueado, false);
  assert.match(r.motivoExencion, /desactivado/);
});

test('detecta una invitación a otro servidor', () => {
  const r = simulate({ content: 'entra a discord.gg/abc123', settings: conFiltro('invites') });

  assert.equal(r.bloqueado, true);
  assert.equal(r.resultado.id, 'invites');
  assert.match(r.resultado.motivo, /Invitación/);
});

test('un mensaje limpio no dispara nada', () => {
  const r = simulate({ content: 'hola, buenos días', settings: conFiltro('invites') });

  assert.equal(r.bloqueado, false);
  assert.equal(r.resultado, null);
  assert.deepEqual(r.coincidencias, []);
});

test('respeta la lista blanca de enlaces', () => {
  const settings = conFiltro('links', {}, { allowedLinks: ['youtube.com'] });

  assert.equal(simulate({ content: 'mira youtube.com/watch?v=1', settings }).bloqueado, false);
  assert.equal(simulate({ content: 'mira ejemplo.com/algo', settings }).bloqueado, true);
});

test('encuentra la palabra prohibida y dice cuál era', () => {
  const settings = conFiltro('words', {}, { bannedWords: ['tonto'] });
  const r = simulate({ content: 'eres un TONTO', settings });

  assert.equal(r.bloqueado, true);
  assert.match(r.resultado.motivo, /tonto/);
});

test('el orden de los filtros decide la sanción, como en el bot', () => {
  // Un mensaje con invitación Y palabra prohibida: manda «invites», que va antes.
  const settings = {
    automod: {
      enabled: true,
      filters: {
        invites: { enabled: true, action: 'ban', deleteMessage: true },
        words: { enabled: true, action: 'warn', deleteMessage: true },
      },
      options: { bannedWords: ['tonto'] },
    },
  };

  const r = simulate({ content: 'tonto, entra a discord.gg/abc', settings });

  assert.equal(r.resultado.id, 'invites', 'el primero de la lista es el que sanciona');
  assert.equal(r.resultado.accion, 'ban');
  // Pero se informa de las dos, para que se entienda por qué.
  assert.deepEqual(r.coincidencias.map((c) => c.id), ['invites', 'words']);
});

test('un canal ignorado exime el mensaje entero', () => {
  const settings = conFiltro('invites');
  settings.automod.ignoredChannels = ['999999999999999999'];

  const r = simulate({
    content: 'discord.gg/abc',
    settings,
    channelId: '999999999999999999',
  });

  assert.equal(r.exento, true);
  assert.equal(r.bloqueado, false);
  assert.match(r.motivoExencion, /canal/i);
});

test('un rol ignorado exime al autor', () => {
  const settings = conFiltro('invites');
  settings.automod.ignoredRoles = ['888888888888888888'];

  const r = simulate({
    content: 'discord.gg/abc',
    settings,
    roleIds: ['888888888888888888'],
  });

  assert.equal(r.exento, true);
  assert.match(r.motivoExencion, /rol/i);
});

test('los moderadores están exentos salvo que se diga lo contrario', () => {
  const settings = conFiltro('invites');

  assert.equal(simulate({ content: 'discord.gg/abc', settings, isModerator: true }).exento, true);

  settings.automod.exemptModerators = false;
  assert.equal(simulate({ content: 'discord.gg/abc', settings, isModerator: true }).bloqueado, true);
});

test('un filtro puede ignorar un canal aunque el módulo no lo ignore', () => {
  const settings = conFiltro('invites', { ignoredChannels: ['777777777777777777'] });

  const r = simulate({ content: 'discord.gg/abc', settings, channelId: '777777777777777777' });

  // No es una exención global: el mensaje se evalúa, pero ese filtro no aplica.
  assert.equal(r.exento, false);
  assert.equal(r.bloqueado, false);
});

test('avisa de los filtros que no se pueden probar con un solo mensaje', () => {
  const settings = conFiltro('spam', {}, { spamMessages: 5, spamInterval: 5 });
  const r = simulate({ content: 'hola', settings });

  assert.deepEqual(r.noEvaluados.map((n) => n.id), ['spam']);
  assert.match(r.noEvaluados[0].motivo, /seguidos/);
});

test('explica en castellano qué haría el bot', () => {
  const r = simulate({
    content: 'discord.gg/abc',
    settings: conFiltro('invites', { action: 'timeout', duration: 30 }),
  });

  assert.match(r.resultado.descripcion, /30 minutos/);
  assert.match(r.resultado.descripcion, /[Bb]orraría el mensaje/);
});

test('avisa cuando el filtro necesita varias infracciones antes de sancionar', () => {
  const r = simulate({
    content: 'discord.gg/abc',
    settings: conFiltro('invites', { action: 'kick', threshold: 3 }),
  });

  assert.equal(r.resultado.umbral, 3);
  assert.equal(r.resultado.sancionaAlPrimero, false, 'con umbral 3 no expulsa a la primera');
});

test('detecta el exceso de mayúsculas con los límites configurados', () => {
  const settings = conFiltro('caps', {}, { capsPercentage: 70, capsMinLength: 10 });

  assert.equal(simulate({ content: 'ESTO ESTÁ TODO EN MAYÚSCULAS', settings }).bloqueado, true);
  assert.equal(simulate({ content: 'esto está en minúsculas', settings }).bloqueado, false);
});

test('el filtro de adjuntos depende de si se envía un archivo', () => {
  const settings = conFiltro('attachments');

  assert.equal(simulate({ content: 'toma', settings, hasAttachment: true }).bloqueado, true);
  assert.equal(simulate({ content: 'toma', settings, hasAttachment: false }).bloqueado, false);
});

test('cuenta los filtros activos aunque ninguno se incumpla', () => {
  const settings = {
    automod: {
      enabled: true,
      filters: {
        invites: { enabled: true },
        links: { enabled: true },
        caps: { enabled: false },
      },
      options: {},
    },
  };

  assert.equal(simulate({ content: 'hola', settings }).filtrosActivos, 2);
});

test('no revienta con una configuración vacía', () => {
  const r = simulate({ content: 'hola', settings: {} });

  assert.equal(r.moduloActivo, false);
  assert.equal(r.bloqueado, false);
  assert.equal(r.filtrosActivos, 0);
});

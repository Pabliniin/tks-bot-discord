import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { EDITABLE_KEYS } from '../src/lib/editableKeys.js';

const require = createRequire(import.meta.url);
const { buildBackup, parseBackup, despersonalizar, contarIdentificadores } = require('@tkbot/shared/src/backup');

/**
 * Pruebas de las copias de seguridad de la configuración.
 *
 * Se ejecutan con: npm run test --workspace @tkbot/web
 */

/** Configuración de ejemplo con identificadores reales de Discord. */
function settingsDeEjemplo() {
  return {
    prefix: '!',
    welcome: { enabled: true, channelId: '123456789012345678', message: 'Hola [user]' },
    logs: {
      enabled: true,
      defaultChannelId: '234567890123456789',
      ignoredChannels: ['345678901234567890', '456789012345678901'],
      events: { messageDelete: { enabled: true, channelId: null } },
    },
    modRoles: ['567890123456789012'],
    premium: { tier: 2 },
    stats: { commandsUsed: 999 },
  };
}

test('la copia solo incluye las ramas que el panel puede escribir', () => {
  const copia = buildBackup({
    settings: settingsDeEjemplo(),
    editableKeys: EDITABLE_KEYS,
    guildId: '111111111111111111',
    guildName: 'Mi servidor',
  });

  assert.equal(copia.settings.premium, undefined, 'el plan no debe viajar en la copia');
  assert.equal(copia.settings.stats, undefined, 'los contadores internos tampoco');
  assert.equal(copia.settings.prefix, '!');
  assert.ok(copia.settings.welcome);
});

test('la copia completa conserva los identificadores', () => {
  const copia = buildBackup({
    settings: settingsDeEjemplo(),
    editableKeys: EDITABLE_KEYS,
    guildId: '111111111111111111',
    modo: 'completa',
  });

  assert.equal(copia.modo, 'completa');
  assert.equal(copia.settings.welcome.channelId, '123456789012345678');
  assert.deepEqual(copia.settings.logs.ignoredChannels, ['345678901234567890', '456789012345678901']);
  assert.equal(copia.identificadoresQuitados, 0);
});

test('la copia portable borra canales y roles del servidor de origen', () => {
  const copia = buildBackup({
    settings: settingsDeEjemplo(),
    editableKeys: EDITABLE_KEYS,
    guildId: '111111111111111111',
    modo: 'portable',
  });

  assert.equal(copia.modo, 'portable');
  assert.equal(copia.settings.welcome.channelId, null, 'un canal de otro servidor no existe aquí');
  assert.equal(copia.settings.logs.defaultChannelId, null);
  assert.deepEqual(copia.settings.logs.ignoredChannels, []);
  assert.deepEqual(copia.settings.modRoles, []);
});

test('la copia portable conserva todo lo que NO es un identificador', () => {
  const copia = buildBackup({
    settings: settingsDeEjemplo(),
    editableKeys: EDITABLE_KEYS,
    guildId: '111111111111111111',
    modo: 'portable',
  });

  assert.equal(copia.settings.prefix, '!');
  assert.equal(copia.settings.welcome.enabled, true);
  assert.equal(copia.settings.welcome.message, 'Hola [user]');
  assert.equal(copia.settings.logs.events.messageDelete.enabled, true);
});

test('cuenta cuántos canales y roles habrá que volver a elegir', () => {
  const copia = buildBackup({
    settings: settingsDeEjemplo(),
    editableKeys: EDITABLE_KEYS,
    guildId: '111111111111111111',
    modo: 'portable',
  });

  // welcome.channelId + logs.defaultChannelId + 2 ignorados + 1 modRole
  assert.equal(copia.identificadoresQuitados, 5);
});

test('despersonalizar no destroza un texto que contenga una mención', () => {
  const entrada = { message: 'Bienvenido <@123456789012345678> al servidor' };
  const salida = despersonalizar(entrada);

  assert.equal(
    salida.message,
    'Bienvenido <@123456789012345678> al servidor',
    'el mensaje es texto, no un campo de identificador'
  );
});

test('parseBackup rechaza un archivo que no es una copia', () => {
  assert.equal(parseBackup(null, EDITABLE_KEYS).ok, false);
  assert.equal(parseBackup('texto', EDITABLE_KEYS).ok, false);
  assert.equal(parseBackup([], EDITABLE_KEYS).ok, false);
  assert.equal(parseBackup({ hola: 'mundo' }, EDITABLE_KEYS).ok, false);
});

test('parseBackup rechaza una copia de una versión más nueva', () => {
  const resultado = parseBackup(
    { tipo: 'tkbot-backup', version: 99, settings: { prefix: '!' } },
    EDITABLE_KEYS
  );

  assert.equal(resultado.ok, false);
  assert.match(resultado.error, /más nueva/);
});

test('parseBackup descarta las ramas que el panel no puede escribir', () => {
  const resultado = parseBackup(
    {
      tipo: 'tkbot-backup',
      version: 1,
      settings: { prefix: '!', premium: { tier: 2 }, inventado: true },
    },
    EDITABLE_KEYS
  );

  assert.equal(resultado.ok, true);
  assert.equal(resultado.settings.premium, undefined, 'no se cuela el plan por la copia');
  assert.deepEqual(resultado.ignoradas.sort(), ['inventado', 'premium']);
});

test('una copia recién creada se puede volver a importar', () => {
  const copia = buildBackup({
    settings: settingsDeEjemplo(),
    editableKeys: EDITABLE_KEYS,
    guildId: '111111111111111111',
    guildName: 'Mi servidor',
  });

  // El viaje real pasa por JSON: hay que asegurarse de que sobrevive.
  const resultado = parseBackup(JSON.parse(JSON.stringify(copia)), EDITABLE_KEYS);

  assert.equal(resultado.ok, true);
  assert.equal(resultado.settings.prefix, '!');
  assert.equal(resultado.meta.modo, 'completa');
  assert.equal(resultado.meta.servidor.nombre, 'Mi servidor');
});

test('parseBackup rechaza una copia sin nada aplicable', () => {
  const resultado = parseBackup(
    { tipo: 'tkbot-backup', version: 1, settings: { premium: { tier: 2 } } },
    EDITABLE_KEYS
  );

  assert.equal(resultado.ok, false);
});

test('contarIdentificadores ignora los campos que no son de identificador', () => {
  assert.equal(contarIdentificadores({ mensaje: '123456789012345678' }), 0);
  assert.equal(contarIdentificadores({ channelId: '123456789012345678' }), 1);
  assert.equal(contarIdentificadores({ ignoredRoles: ['123456789012345678', '234567890123456789'] }), 2);
});

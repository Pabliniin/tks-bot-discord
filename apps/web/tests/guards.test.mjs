import test from 'node:test';
import assert from 'node:assert/strict';

import { sanitizePayload, EDITABLE_KEYS } from '../src/lib/editableKeys.js';
import { canManageGuild, accessReason, ACCESS_LABELS } from '../src/lib/discord.js';

/**
 * Pruebas de las comprobaciones de seguridad del panel.
 *
 * Se ejecutan con: npm run test --workspace @tkbot/web
 */

test('sanitizePayload deja pasar las claves de configuración normales', () => {
  const entrada = {
    prefix: '!',
    welcome: { enabled: true },
    automod: { enabled: true },
    levels: { xpPerMessage: 25 },
  };

  const salida = sanitizePayload(entrada);
  assert.deepEqual(salida, entrada);
});

test('sanitizePayload bloquea la escalada a premium', () => {
  const salida = sanitizePayload({
    prefix: '!',
    premium: { tier: 2, until: null },
  });

  assert.equal(salida.prefix, '!');
  assert.equal(salida.premium, undefined, 'no se debe poder cambiar el plan desde el panel');
});

test('sanitizePayload descarta los campos internos', () => {
  const salida = sanitizePayload({
    guildId: '000000000000000000',
    _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    stats: { commandsUsed: 999999 },
    createdAt: new Date(),
    updatedAt: new Date(),
    __v: 5,
    welcome: { enabled: true },
  });

  assert.deepEqual(Object.keys(salida), ['welcome']);
});

test('sanitizePayload trata entradas no válidas sin fallar', () => {
  assert.deepEqual(sanitizePayload(null), {});
  assert.deepEqual(sanitizePayload(undefined), {});
  assert.deepEqual(sanitizePayload('texto'), {});
  assert.deepEqual(sanitizePayload(42), {});
  assert.deepEqual(sanitizePayload([{ premium: { tier: 2 } }]), {});
});

test('la lista de claves editables cubre los quince módulos', async () => {
  const { default: constants } = await import('@tkbot/shared/src/constants.json', {
    with: { type: 'json' },
  });

  for (const module of constants.MODULES) {
    // `welcome` cubre también `goodbye`, que va aparte en el esquema.
    assert.ok(
      EDITABLE_KEYS.has(module.id),
      `el módulo "${module.id}" no se puede guardar desde el panel`
    );
  }
  assert.ok(EDITABLE_KEYS.has('goodbye'), 'falta la rama de despedidas');
});

test('canManageGuild acepta al dueño del servidor', () => {
  assert.equal(canManageGuild({ owner: true, permissions: '0' }), true);
});

test('canManageGuild acepta "Gestionar servidor" y "Administrador"', () => {
  // 0x20 = Gestionar servidor
  assert.equal(canManageGuild({ owner: false, permissions: String(0x20) }), true);
  // 0x8 = Administrador
  assert.equal(canManageGuild({ owner: false, permissions: String(0x8) }), true);
  // Permisos combinados que incluyen "Gestionar servidor"
  assert.equal(canManageGuild({ owner: false, permissions: String(0x20n | 0x400n) }), true);
});

test('canManageGuild rechaza a los miembros sin permisos', () => {
  // 0x400 = Ver canal, no basta.
  assert.equal(canManageGuild({ owner: false, permissions: String(0x400) }), false);
  assert.equal(canManageGuild({ owner: false, permissions: '0' }), false);
  assert.equal(canManageGuild({}), false);
});

test('canManageGuild no revienta con permisos corruptos', () => {
  assert.equal(canManageGuild({ permissions: 'no-es-un-numero' }), false);
  assert.equal(canManageGuild({ permissions: null }), false);
});

test('accessReason distingue de dónde viene el acceso', () => {
  assert.equal(accessReason({ owner: true, permissions: '0' }), 'owner');
  assert.equal(accessReason({ owner: false, permissions: String(0x8) }), 'administrator');
  assert.equal(accessReason({ owner: false, permissions: String(0x20) }), 'manageGuild');
  assert.equal(accessReason({ owner: false, permissions: String(0x400) }), null);
  assert.equal(accessReason(null), null);
});

test('el dueño y el administrador tienen prioridad sobre gestionar servidor', () => {
  // Con Administrador + Gestionar servidor se muestra "Administrador".
  assert.equal(accessReason({ owner: false, permissions: String(0x8n | 0x20n) }), 'administrator');
  // El dueño manda sobre todo lo demás.
  assert.equal(accessReason({ owner: true, permissions: String(0x20) }), 'owner');
});

test('cada motivo de acceso tiene su etiqueta en español', () => {
  for (const motivo of ['owner', 'administrator', 'manageGuild']) {
    assert.ok(ACCESS_LABELS[motivo], `falta la etiqueta de "${motivo}"`);
  }
});

test('un administrador de servidor puede entrar al panel', () => {
  // Este es el caso que importa: alguien con Administrador, sin ser el dueño.
  const servidor = { id: '1', name: 'Servidor de un amigo', owner: false, permissions: String(0x8) };
  assert.equal(canManageGuild(servidor), true);
  assert.equal(ACCESS_LABELS[accessReason(servidor)], 'Administrador');
});

test('la lista del panel solo incluye servidores administrables', () => {
  const servidoresDelUsuario = [
    { id: '1', name: 'Soy el dueño', owner: true, permissions: '0' },
    { id: '2', name: 'Soy admin', owner: false, permissions: String(0x8) },
    { id: '3', name: 'Gestiono el servidor', owner: false, permissions: String(0x20) },
    { id: '4', name: 'Solo soy miembro', owner: false, permissions: String(0x400) },
    { id: '5', name: 'Solo puedo moderar', owner: false, permissions: String(0x2) },
  ];

  const visibles = servidoresDelUsuario.filter(canManageGuild).map((g) => g.id);
  assert.deepEqual(visibles, ['1', '2', '3'], 'solo dueño, admin y gestionar servidor');
});

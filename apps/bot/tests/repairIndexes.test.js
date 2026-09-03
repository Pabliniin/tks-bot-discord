'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { repararIndicesTTL, ESPERADOS } = require('@tkbot/shared');

/**
 * Pruebas de la reparación de índices con caducidad.
 *
 * MongoDB no permite cambiar las opciones de un índice existente: si una
 * colección se creó sin caducidad y luego el modelo la pide, el cambio se
 * ignora **en silencio** y esa colección crece para siempre. Este es
 * exactamente el fallo que apareció en `BotInstance`.
 *
 * Se ejecutan con: npm run test --workspace @tkbot/bot
 */

/** Modelo de mentira que finge una colección con los índices que se le digan. */
function modeloFalso(indices, { alBorrar, alSincronizar } = {}) {
  const estado = { indices: [...indices], borrados: [], sincronizado: 0 };

  return {
    estado,
    collection: {
      indexes: async () => estado.indices,
      dropIndex: async (nombre) => {
        if (alBorrar) alBorrar(nombre);
        estado.borrados.push(nombre);
        estado.indices = estado.indices.filter((i) => i.name !== nombre);
      },
    },
    syncIndexes: async () => {
      if (alSincronizar) alSincronizar();
      estado.sincronizado += 1;
    },
  };
}

test('repara un índice que se quedó sin caducidad', async () => {
  const BotInstance = modeloFalso([
    { name: '_id_', key: { _id: 1 } },
    // El caso real: existe, pero sin `expireAfterSeconds`.
    { name: 'lastSeen_1', key: { lastSeen: 1 } },
  ]);

  const resultado = await repararIndicesTTL({ BotInstance });

  assert.deepEqual(resultado.reparados, ['BotInstance.lastSeen']);
  assert.deepEqual(BotInstance.estado.borrados, ['lastSeen_1']);
  assert.equal(BotInstance.estado.sincronizado, 1, 'hay que rehacerlo tras borrarlo');
});

test('no toca un índice que ya está bien', async () => {
  const BotInstance = modeloFalso([
    { name: 'lastSeen_1', key: { lastSeen: 1 }, expireAfterSeconds: 300 },
  ]);

  const resultado = await repararIndicesTTL({ BotInstance });

  assert.deepEqual(resultado.reparados, []);
  assert.deepEqual(BotInstance.estado.borrados, [], 'borrarlo sería trabajo para nada');
});

test('repara un índice con la caducidad equivocada', async () => {
  const BotInstance = modeloFalso([
    { name: 'lastSeen_1', key: { lastSeen: 1 }, expireAfterSeconds: 99 },
  ]);

  const resultado = await repararIndicesTTL({ BotInstance });
  assert.deepEqual(resultado.reparados, ['BotInstance.lastSeen']);
});

test('si el índice aún no existe, no hace nada: ya lo creará mongoose', async () => {
  const BotInstance = modeloFalso([{ name: '_id_', key: { _id: 1 } }]);

  const resultado = await repararIndicesTTL({ BotInstance });

  assert.deepEqual(resultado.reparados, []);
  assert.deepEqual(BotInstance.estado.borrados, []);
});

test('no confunde un índice compuesto con el de caducidad', async () => {
  // `{ guildId: 1, createdAt: -1 }` es para ordenar, no para caducar.
  const ConfigHistory = modeloFalso([
    { name: 'guildId_1_createdAt_-1', key: { guildId: 1, createdAt: -1 } },
  ]);

  const resultado = await repararIndicesTTL({ ConfigHistory });

  assert.deepEqual(resultado.reparados, []);
  assert.deepEqual(ConfigHistory.estado.borrados, [], 'ese índice hace falta para las consultas');
});

test('un fallo en una colección no impide revisar las demás', async () => {
  const roto = {
    collection: {
      indexes: async () => {
        throw new Error('sin permisos');
      },
    },
  };
  const bueno = modeloFalso([{ name: 'lastSeen_1', key: { lastSeen: 1 } }]);

  const resultado = await repararIndicesTTL({ ConfigHistory: roto, BotInstance: bueno });

  assert.equal(resultado.fallos.length, 1);
  assert.match(resultado.fallos[0], /ConfigHistory/);
  // El bueno se reparó igualmente.
  assert.deepEqual(resultado.reparados, ['BotInstance.lastSeen']);
});

test('un modelo que no existe se salta sin protestar', async () => {
  const resultado = await repararIndicesTTL({});

  assert.equal(resultado.revisados, 0);
  assert.deepEqual(resultado.reparados, []);
  assert.deepEqual(resultado.fallos, []);
});

test('la lista de índices esperados está bien formada', () => {
  assert.ok(ESPERADOS.length > 0);

  for (const entrada of ESPERADOS) {
    assert.ok(entrada.modelo, 'falta el modelo');
    assert.ok(entrada.campo, `${entrada.modelo} no dice qué campo caduca`);
    assert.ok(entrada.segundos > 0, `${entrada.modelo} tiene una caducidad imposible`);
  }
});

test('cada modelo esperado existe de verdad en el paquete compartido', () => {
  const { models } = require('@tkbot/shared');

  for (const { modelo } of ESPERADOS) {
    assert.ok(models[modelo], `${modelo} está en la lista pero no existe como modelo`);
  }
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const dailyStats = require('../src/modules/dailyStats');

/**
 * Pruebas del acumulador de estadísticas diarias.
 *
 * Solo se prueba lo que ocurre en memoria: el volcado escribe en MongoDB y no
 * hay base de datos en las pruebas.
 *
 * Se ejecutan con: npm run test --workspace @tkbot/bot
 */

/** Deja los contadores en blanco antes de cada prueba. */
function limpiar() {
  dailyStats.pendientes.clear();
}

test('acumula en memoria en vez de escribir en cada mensaje', () => {
  limpiar();

  dailyStats.registrar('123', 'messages');
  dailyStats.registrar('123', 'messages');
  dailyStats.registrar('123', 'messages');

  assert.equal(dailyStats.pendientes.get('123').messages, 3);
  assert.equal(dailyStats.pendientes.size, 1, 'un solo lote por servidor');
});

test('cada servidor lleva su propio lote', () => {
  limpiar();

  dailyStats.registrar('111', 'joins');
  dailyStats.registrar('222', 'joins');
  dailyStats.registrar('222', 'joins');

  assert.equal(dailyStats.pendientes.get('111').joins, 1);
  assert.equal(dailyStats.pendientes.get('222').joins, 2);
});

test('reparte los mensajes por canal para el ranking', () => {
  limpiar();

  dailyStats.registrar('123', 'messages', 1, 'canal-a');
  dailyStats.registrar('123', 'messages', 1, 'canal-a');
  dailyStats.registrar('123', 'messages', 1, 'canal-b');

  const lote = dailyStats.pendientes.get('123');

  assert.equal(lote.messages, 3, 'el total sigue siendo la suma');
  assert.equal(lote.canales.get('canal-a'), 2);
  assert.equal(lote.canales.get('canal-b'), 1);
});

test('solo los mensajes se reparten por canal', () => {
  limpiar();

  dailyStats.registrar('123', 'joins', 1, 'canal-a');

  assert.equal(dailyStats.pendientes.get('123').canales.size, 0);
});

test('el recuento de miembros se sustituye, no se suma', () => {
  limpiar();

  dailyStats.registrarMiembros('123', 500);
  dailyStats.registrarMiembros('123', 512);

  assert.equal(
    dailyStats.pendientes.get('123').memberCount,
    512,
    'es una foto del momento, no un acumulado'
  );
});

test('acepta sumar más de uno de golpe', () => {
  limpiar();

  dailyStats.registrar('123', 'voiceMinutes', 45);

  assert.equal(dailyStats.pendientes.get('123').voiceMinutes, 45);
});

test('no revienta con datos incompletos', () => {
  limpiar();

  dailyStats.registrar(null, 'messages');
  dailyStats.registrar('123', null);
  dailyStats.registrar(undefined, undefined);
  dailyStats.registrarMiembros('123', NaN);
  dailyStats.registrarMiembros(null, 5);

  assert.equal(dailyStats.pendientes.size, 0, 'nada de eso debería crear un lote');
});

test('un campo desconocido no crea contadores inventados', () => {
  limpiar();

  dailyStats.registrar('123', 'inventado');

  const lote = dailyStats.pendientes.get('123');
  assert.equal(lote.inventado, undefined);
  assert.equal(lote.messages, 0);
});

test('el día se calcula en UTC, con el formato que espera la base de datos', () => {
  const hoy = dailyStats.hoy();

  assert.match(hoy, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(hoy, new Date().toISOString().slice(0, 10));
});

test('volcar sin nada pendiente no intenta escribir', async () => {
  limpiar();

  // Si intentara escribir, fallaría al no haber base de datos en las pruebas.
  assert.equal(await dailyStats.volcar(), 0);
});

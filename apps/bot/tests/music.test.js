'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const music = require('../src/modules/music');

/**
 * Pruebas de la lógica pura del sistema de música.
 *
 * No se prueba la conexión con Lavalink: eso necesita el servicio en marcha.
 * Sí se prueba todo lo que se puede calcular sin él, que es donde de verdad
 * aparecen los fallos tontos (un tiempo mal interpretado, una barra que se
 * sale, una división entre cero).
 *
 * Se ejecutan con: npm run test --workspace @tkbot/bot
 */

// ── formatearDuracion ────────────────────────────────────────────

test('formatea duraciones en minutos y segundos', () => {
  assert.equal(music.formatearDuracion(0), '0:00');
  assert.equal(music.formatearDuracion(5000), '0:05');
  assert.equal(music.formatearDuracion(65_000), '1:05');
  assert.equal(music.formatearDuracion(225_000), '3:45');
});

test('pasa a horas cuando hace falta', () => {
  assert.equal(music.formatearDuracion(3_600_000), '1:00:00');
  assert.equal(music.formatearDuracion(3_750_000), '1:02:30');
});

test('una duración imposible no rompe el embed', () => {
  assert.equal(music.formatearDuracion(-100), '0:00');
  assert.equal(music.formatearDuracion(NaN), '0:00');
  assert.equal(music.formatearDuracion(undefined), '0:00');
  assert.equal(music.formatearDuracion(Infinity), '0:00');
});

// ── parsearTiempo ────────────────────────────────────────────────

test('entiende el formato minuto:segundo', () => {
  assert.equal(music.parsearTiempo('1:30'), 90_000);
  assert.equal(music.parsearTiempo('0:05'), 5000);
  assert.equal(music.parsearTiempo('10:00'), 600_000);
});

test('entiende el formato hora:minuto:segundo', () => {
  assert.equal(music.parsearTiempo('1:02:30'), 3_750_000);
});

test('entiende un número suelto como segundos', () => {
  assert.equal(music.parsearTiempo('90'), 90_000);
  assert.equal(music.parsearTiempo('0'), 0);
});

test('entiende el formato con unidades', () => {
  assert.equal(music.parsearTiempo('2m30s'), 150_000);
  assert.equal(music.parsearTiempo('90s'), 90_000);
  assert.equal(music.parsearTiempo('1h'), 3_600_000);
  assert.equal(music.parsearTiempo('1h5m'), 3_900_000);
});

test('rechaza lo que no entiende en vez de devolver un número raro', () => {
  assert.equal(music.parsearTiempo('mañana'), null);
  assert.equal(music.parsearTiempo(''), null);
  assert.equal(music.parsearTiempo(null), null);
  assert.equal(music.parsearTiempo('1:2:3:4'), null);
  assert.equal(music.parsearTiempo('-30'), null);
  assert.equal(music.parsearTiempo('1:abc'), null);
});

// ── barraProgreso ────────────────────────────────────────────────

test('la barra marca el principio, el medio y el final', () => {
  const largo = 10;

  assert.equal(music.barraProgreso(0, 100, largo), `🔘${'─'.repeat(9)}`);
  assert.equal(music.barraProgreso(50, 100, largo), `${'─'.repeat(5)}🔘${'─'.repeat(4)}`);
  assert.equal(music.barraProgreso(100, 100, largo), `${'─'.repeat(9)}🔘`);
});

test('la barra mide siempre lo mismo', () => {
  // El marcador ocupa una posición, así que el total de caracteres es fijo.
  for (const posicion of [0, 1, 37, 99, 100, 500]) {
    const barra = music.barraProgreso(posicion, 100, 20);
    assert.equal([...barra].length, 20, `posición ${posicion} descuadra la barra`);
  }
});

test('la barra aguanta una duración desconocida sin dividir entre cero', () => {
  const barra = music.barraProgreso(30_000, 0, 10);

  assert.equal([...barra].length, 10);
  assert.ok(!barra.includes('NaN'));
});

test('la barra no se sale aunque la posición pase de la duración', () => {
  // Pasa de verdad: Lavalink puede reportar una posición algo mayor al final.
  const barra = music.barraProgreso(105_000, 100_000, 20);

  assert.equal([...barra].length, 20);
  assert.ok(barra.endsWith('🔘'));
});

// ── esDj ─────────────────────────────────────────────────────────

/** Miembro de mentira con los roles y permisos que se le digan. */
function miembro({ id = '1', roles = [], gestionaServidor = false } = {}) {
  return {
    id,
    roles: { cache: { has: (rol) => roles.includes(rol) } },
    permissions: { has: (permiso) => permiso === 'ManageGuild' && gestionaServidor },
  };
}

test('quien tiene el rol de DJ manda', () => {
  const settings = { music: { djRoleId: 'rol-dj' } };

  assert.equal(music.esDj(miembro({ roles: ['rol-dj'] }), settings), true);
  assert.equal(music.esDj(miembro({ roles: ['otro'] }), settings), false);
});

test('quien puede gestionar el servidor manda aunque no tenga el rol', () => {
  assert.equal(music.esDj(miembro({ gestionaServidor: true }), { music: {} }), true);
});

test('quien pidió la canción puede saltarse la suya', () => {
  const cola = { current: { pedidaPor: { id: '42' } } };

  assert.equal(music.esDj(miembro({ id: '42' }), { music: {} }, cola), true);
  assert.equal(music.esDj(miembro({ id: '99' }), { music: {} }, cola), false);
});

test('esDj no revienta sin miembro ni configuración', () => {
  assert.equal(music.esDj(null, null), false);
  assert.equal(music.esDj(miembro(), {}), false);
});

// ── Estado del módulo ────────────────────────────────────────────

test('sin Lavalink configurado el módulo no está disponible', () => {
  // En las pruebas no hay LAVALINK_HOST, así que este es el caso real.
  assert.equal(music.disponible(), false);
});

test('explica qué falta en vez de dar un error genérico', () => {
  const motivo = music.motivoNoDisponible();

  assert.match(motivo, /Lavalink/);
  assert.match(motivo, /MUSICA\.md/);
});

test('los modos de repetición están todos traducidos', () => {
  assert.deepEqual(Object.keys(music.BUCLES), ['off', 'track', 'queue']);
  for (const nombre of Object.values(music.BUCLES)) {
    assert.equal(typeof nombre, 'string');
    assert.ok(nombre.length > 0);
  }
});

test('cada filtro tiene nombre, y solo «ninguno» va sin configuración', () => {
  for (const [id, filtro] of Object.entries(music.FILTROS)) {
    assert.ok(filtro.nombre, `el filtro ${id} no tiene nombre`);

    if (id === 'ninguno') {
      assert.equal(filtro.config, null, 'quitar el filtro no debe aplicar nada');
    } else {
      assert.ok(filtro.config, `el filtro ${id} no hace nada`);
    }
  }
});

test('no hay ninguna cola abierta al arrancar', () => {
  assert.equal(music.colas.size, 0);
  assert.equal(music.getCola('123'), null);
});

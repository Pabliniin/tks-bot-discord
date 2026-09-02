import test from 'node:test';
import assert from 'node:assert/strict';

import {
  pickShape,
  contarCambios,
  resumirCambios,
  aplanar,
  compararCambios,
  nombreDeModulo,
} from '../src/lib/configHistory.js';

/**
 * Pruebas del historial de cambios del panel.
 *
 * `pickShape` es la pieza delicada: si guarda mal los valores anteriores, el
 * botón de deshacer restauraría una configuración equivocada.
 *
 * Se ejecutan con: npm run test --workspace @tkbot/web
 */

test('pickShape recorta el original a la forma de los cambios', () => {
  const actual = {
    logs: { enabled: false, defaultChannelId: '123', ignoreBots: true },
    automod: { enabled: true },
  };
  const cambios = { logs: { enabled: true } };

  assert.deepEqual(pickShape(actual, cambios), { logs: { enabled: false } });
});

test('pickShape deja a null lo que antes no existía', () => {
  const cambios = { logs: { defaultChannelId: '999' } };

  assert.deepEqual(pickShape({}, cambios), { logs: { defaultChannelId: null } });
});

test('pickShape guarda los arrays enteros, no elemento a elemento', () => {
  const actual = { modRoles: ['1', '2', '3'] };
  const cambios = { modRoles: ['1'] };

  assert.deepEqual(pickShape(actual, cambios), { modRoles: ['1', '2', '3'] });
});

test('pickShape no baja de nivel si el tipo cambia', () => {
  // Antes era un objeto, ahora se sustituye por un array.
  const actual = { embeds: { a: 1 } };
  const cambios = { embeds: [{ id: 'x' }] };

  assert.deepEqual(pickShape(actual, cambios), { embeds: { a: 1 } });
});

test('lo que devuelve pickShape sirve para volver al estado anterior', () => {
  const original = { logs: { enabled: false, ignoreBots: true } };
  const cambios = { logs: { enabled: true, ignoreBots: false } };

  const previos = pickShape(original, cambios);

  // Aplicar `previos` sobre el estado ya cambiado debe devolver el original.
  const trasCambio = { logs: { ...original.logs, ...cambios.logs } };
  const restaurado = { logs: { ...trasCambio.logs, ...previos.logs } };

  assert.deepEqual(restaurado, original);
});

test('contarCambios cuenta valores finales, no ramas', () => {
  assert.equal(contarCambios({ logs: { enabled: true, ignoreBots: false } }), 2);
  assert.equal(contarCambios({ prefix: '!' }), 1);
  // Un array es un solo cambio: se sustituye la lista entera.
  assert.equal(contarCambios({ modRoles: ['1', '2', '3'] }), 1);
});

test('resumirCambios usa los nombres en castellano de los módulos', () => {
  const resumen = resumirCambios({ logs: { enabled: true } });

  assert.match(resumen, /Logs/);
  assert.match(resumen, /1 valor$/);
});

test('resumirCambios enumera hasta tres módulos y luego resume', () => {
  assert.match(resumirCambios({ logs: { a: 1 }, automod: { b: 2 } }), /Logs y AutoMod/);

  const muchos = resumirCambios({
    logs: { a: 1 },
    automod: { b: 2 },
    tickets: { c: 3 },
    levels: { d: 4 },
  });
  assert.match(muchos, /y 2 más/);
});

test('resumirCambios no revienta sin cambios', () => {
  assert.equal(resumirCambios({}), 'Sin cambios');
  assert.equal(resumirCambios(null), 'Sin cambios');
});

test('aplanar produce rutas con puntos', () => {
  const lista = aplanar({ logs: { enabled: true, ignoreBots: false } });

  assert.deepEqual(lista, [
    { ruta: 'logs.enabled', valor: true },
    { ruta: 'logs.ignoreBots', valor: false },
  ]);
});

test('compararCambios empareja el antes y el después', () => {
  const comparacion = compararCambios(
    { logs: { enabled: true } },
    { logs: { enabled: false } }
  );

  assert.deepEqual(comparacion, [{ ruta: 'logs.enabled', antes: false, despues: true }]);
});

test('nombreDeModulo traduce las claves conocidas y deja pasar las demás', () => {
  assert.equal(nombreDeModulo('logs'), 'Logs');
  assert.equal(nombreDeModulo('prefix'), 'Prefijo');
  assert.equal(nombreDeModulo('inventado'), 'inventado');
});

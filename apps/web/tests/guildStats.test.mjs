import test from 'node:test';
import assert from 'node:assert/strict';

import {
  rangoDeDias,
  rellenarDias,
  resumir,
  canalesMasActivos,
  trazarSerie,
} from '../src/lib/guildStats.js';

/**
 * Pruebas de las series de estadísticas.
 *
 * Se ejecutan con: npm run test --workspace @tkbot/web
 */

test('rangoDeDias devuelve los días en orden, del más antiguo al más nuevo', () => {
  const dias = rangoDeDias(3, new Date('2026-03-15T12:00:00Z'));

  assert.deepEqual(dias, ['2026-03-13', '2026-03-14', '2026-03-15']);
});

test('rangoDeDias cruza bien el cambio de mes', () => {
  const dias = rangoDeDias(3, new Date('2026-03-02T12:00:00Z'));

  assert.deepEqual(dias, ['2026-02-28', '2026-03-01', '2026-03-02']);
});

test('rangoDeDias no se sale de los límites razonables', () => {
  assert.equal(rangoDeDias(0).length, 1);
  assert.equal(rangoDeDias(9999).length, 365);
});

test('rellenarDias pone ceros en los días sin datos', () => {
  const serie = rellenarDias(
    [{ date: '2026-03-14', joins: 5, leaves: 2, messages: 100 }],
    ['2026-03-13', '2026-03-14', '2026-03-15']
  );

  assert.equal(serie.length, 3);
  assert.equal(serie[0].joins, 0, 'el día sin datos vale cero, no queda hueco');
  assert.equal(serie[1].joins, 5);
  assert.equal(serie[2].messages, 0);
});

test('el neto diario es entradas menos salidas', () => {
  const serie = rellenarDias([{ date: '2026-03-14', joins: 5, leaves: 8 }], ['2026-03-14']);

  assert.equal(serie[0].neto, -3);
});

test('el recuento de miembros se arrastra a los días sin dato', () => {
  const serie = rellenarDias(
    [
      { date: '2026-03-13', memberCount: 500 },
      { date: '2026-03-15', memberCount: 510 },
    ],
    ['2026-03-13', '2026-03-14', '2026-03-15']
  );

  assert.equal(serie[0].memberCount, 500);
  assert.equal(serie[1].memberCount, 500, 'sin dato se mantiene el último, no baja a cero');
  assert.equal(serie[2].memberCount, 510);
});

test('resumir suma los totales del periodo', () => {
  const serie = rellenarDias(
    [
      { date: '2026-03-14', joins: 5, messages: 100 },
      { date: '2026-03-15', joins: 3, messages: 50 },
    ],
    ['2026-03-14', '2026-03-15']
  );

  const resumen = resumir(serie);

  assert.equal(resumen.joins.valor, 8);
  assert.equal(resumen.messages.valor, 150);
});

test('resumir calcula la variación frente al periodo anterior', () => {
  const actual = rellenarDias([{ date: '2026-03-15', messages: 150 }], ['2026-03-15']);
  const anterior = rellenarDias([{ date: '2026-03-14', messages: 100 }], ['2026-03-14']);

  const resumen = resumir(actual, anterior);

  assert.equal(resumen.messages.variacion, 50, 'de 100 a 150 es un 50 % más');
});

test('sin periodo anterior no se inventa un porcentaje', () => {
  const serie = rellenarDias([{ date: '2026-03-15', messages: 150 }], ['2026-03-15']);

  assert.equal(resumir(serie, []).messages.variacion, null);
});

test('el crecimiento compara el primer y el último día', () => {
  const serie = rellenarDias(
    [
      { date: '2026-03-14', memberCount: 500 },
      { date: '2026-03-15', memberCount: 540 },
    ],
    ['2026-03-14', '2026-03-15']
  );

  const resumen = resumir(serie);

  assert.equal(resumen.crecimiento.valor, 40);
  assert.equal(resumen.crecimiento.inicio, 500);
  assert.equal(resumen.crecimiento.fin, 540);
});

test('la retención dice cuántos de los que entran se quedan', () => {
  const serie = rellenarDias([{ date: '2026-03-15', joins: 100, leaves: 25 }], ['2026-03-15']);

  assert.equal(resumir(serie).retencion, 75);
});

test('la retención no baja de cero aunque se vayan más de los que entran', () => {
  const serie = rellenarDias([{ date: '2026-03-15', joins: 10, leaves: 50 }], ['2026-03-15']);

  assert.equal(resumir(serie).retencion, 0);
});

test('sin nadie que entre no hay retención que calcular', () => {
  const serie = rellenarDias([{ date: '2026-03-15', joins: 0, leaves: 5 }], ['2026-03-15']);

  assert.equal(resumir(serie).retencion, null);
});

test('canalesMasActivos suma los días y ordena de mayor a menor', () => {
  const top = canalesMasActivos([
    { channelMessages: { general: 50, memes: 30 } },
    { channelMessages: { general: 20, ayuda: 45 } },
  ]);

  assert.deepEqual(top, [
    { channelId: 'general', mensajes: 70 },
    { channelId: 'ayuda', mensajes: 45 },
    { channelId: 'memes', mensajes: 30 },
  ]);
});

test('canalesMasActivos entiende un Map de mongoose', () => {
  const top = canalesMasActivos([{ channelMessages: new Map([['general', 10]]) }]);

  assert.deepEqual(top, [{ channelId: 'general', mensajes: 10 }]);
});

test('canalesMasActivos no revienta sin datos', () => {
  assert.deepEqual(canalesMasActivos([]), []);
  assert.deepEqual(canalesMasActivos(null), []);
  assert.deepEqual(canalesMasActivos([{}]), []);
});

/*
 * El trazado del SVG. Un NaN aquí no da ningún error visible: simplemente la
 * gráfica no se pinta, y eso es justo lo que no se detecta hasta producción.
 */

test('el trazado no produce NaN con datos normales', () => {
  const serie = rellenarDias(
    [
      { date: '2026-03-14', messages: 100 },
      { date: '2026-03-15', messages: 250 },
    ],
    ['2026-03-14', '2026-03-15']
  );

  const { linea, area } = trazarSerie(serie, 'messages');

  assert.ok(!linea.includes('NaN'), `la línea tiene NaN: ${linea}`);
  assert.ok(!area.includes('NaN'), `el área tiene NaN: ${area}`);
  assert.match(linea, /^M[\d.]+,[\d.]+ L/);
});

test('el trazado aguanta que todos los valores sean iguales', () => {
  // Es el caso que divide entre cero: un servidor sin actividad ninguna.
  const serie = rellenarDias([], ['2026-03-14', '2026-03-15', '2026-03-16']);

  const { linea, area } = trazarSerie(serie, 'messages');

  assert.ok(!linea.includes('NaN'), `la línea tiene NaN: ${linea}`);
  assert.ok(!area.includes('NaN'), `el área tiene NaN: ${area}`);
});

test('el trazado aguanta un solo día', () => {
  const serie = rellenarDias([{ date: '2026-03-15', messages: 50 }], ['2026-03-15']);

  const { linea } = trazarSerie(serie, 'messages');

  assert.ok(!linea.includes('NaN'));
  // Con un solo punto se centra en vez de quedarse pegado al borde.
  assert.match(linea, /^M350,/);
});

test('el trazado aguanta una serie vacía', () => {
  const { linea, area } = trazarSerie([], 'messages');

  assert.ok(!linea.includes('NaN'));
  assert.ok(!area.includes('NaN'));
});

test('el valor más alto queda arriba y el más bajo abajo', () => {
  const serie = rellenarDias(
    [
      { date: '2026-03-14', messages: 0 },
      { date: '2026-03-15', messages: 100 },
    ],
    ['2026-03-14', '2026-03-15']
  );

  const { linea } = trazarSerie(serie, 'messages', { ancho: 100, alto: 100, margen: 0 });

  // En SVG el eje Y crece hacia abajo: el máximo debe dar y=0.
  assert.equal(linea, 'M0,100 L100,0');
});

test('la curva de miembros no arranca desde cero', () => {
  const serie = rellenarDias(
    [
      { date: '2026-03-14', memberCount: 5000 },
      { date: '2026-03-15', memberCount: 5100 },
    ],
    ['2026-03-14', '2026-03-15']
  );

  const { minimo } = trazarSerie(serie, 'memberCount');

  assert.equal(minimo, 5000, 'forzar el cero dejaría la curva plana e inútil');
});

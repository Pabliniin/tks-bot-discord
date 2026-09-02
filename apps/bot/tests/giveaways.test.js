'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { elegirGanadores, puedeParticipar, describirRequisitos } = require('@tkbot/shared');

/**
 * Pruebas de la lógica de sorteos.
 *
 * El reparto al azar es lo que más importa: si no es uniforme, unos
 * participantes tienen más posibilidades que otros y nadie lo nota a simple
 * vista. Por eso hay una prueba estadística además de las de comportamiento.
 *
 * Se ejecutan con: npm run test --workspace @tkbot/bot
 */

// ── elegirGanadores ──────────────────────────────────────────────

test('saca el número de ganadores pedido', () => {
  const participantes = ['a', 'b', 'c', 'd', 'e'];

  assert.equal(elegirGanadores(participantes, 1).length, 1);
  assert.equal(elegirGanadores(participantes, 3).length, 3);
});

test('nunca saca el mismo dos veces', () => {
  const participantes = ['a', 'b', 'c', 'd', 'e'];

  for (let i = 0; i < 200; i += 1) {
    const ganadores = elegirGanadores(participantes, 3);
    assert.equal(new Set(ganadores).size, 3, 'ha salido alguien repetido');
  }
});

test('con menos participantes que premios, gana todo el mundo', () => {
  const ganadores = elegirGanadores(['a', 'b'], 5);

  assert.equal(ganadores.length, 2);
  assert.deepEqual([...ganadores].sort(), ['a', 'b']);
});

test('descarta participaciones duplicadas', () => {
  // No debería pasar, pero si pasara, alguien tendría doble oportunidad.
  const ganadores = elegirGanadores(['a', 'a', 'a', 'b'], 2);

  assert.equal(new Set(ganadores).size, ganadores.length);
});

test('sin participantes no revienta', () => {
  assert.deepEqual(elegirGanadores([], 3), []);
  assert.deepEqual(elegirGanadores(null, 3), []);
  assert.deepEqual(elegirGanadores(['a'], 0), []);
});

test('todos los participantes ganan aproximadamente igual', () => {
  /*
   * Con 10 participantes, 1 ganador y 60.000 sorteos, cada uno debería salir
   * unas 6.000 veces. Se acepta un 20 % de desviación, que con esa muestra
   * detecta un sesgo real sin fallar por azar.
   *
   * Esta prueba es la que justifica usar Fisher-Yates en vez del truco de
   * `sort(() => Math.random() - 0.5)`, que NO reparte uniformemente.
   */
  const participantes = Array.from({ length: 10 }, (_, i) => `p${i}`);
  const veces = new Map(participantes.map((p) => [p, 0]));

  const SORTEOS = 60_000;
  for (let i = 0; i < SORTEOS; i += 1) {
    const [ganador] = elegirGanadores(participantes, 1);
    veces.set(ganador, veces.get(ganador) + 1);
  }

  const esperado = SORTEOS / participantes.length;

  for (const [participante, total] of veces) {
    const desviacion = Math.abs(total - esperado) / esperado;
    assert.ok(
      desviacion < 0.2,
      `${participante} salió ${total} veces, se esperaban ~${esperado} (${Math.round(desviacion * 100)} % de desviación)`
    );
  }
});

test('se puede inyectar el azar para probarlo de forma determinista', () => {
  // Con un azar que siempre devuelve 0, se coge siempre el primero libre.
  const ganadores = elegirGanadores(['a', 'b', 'c'], 2, () => 0);

  assert.deepEqual(ganadores, ['a', 'b']);
});

// ── puedeParticipar ──────────────────────────────────────────────

/** Miembro de mentira. */
function miembro({ roles = [], diasEnServidor = 100, level = 0, esBot = false } = {}) {
  return {
    roleIds: roles,
    joinedAt: new Date(Date.now() - diasEnServidor * 86_400_000),
    level,
    esBot,
  };
}

test('sin requisitos participa cualquiera', () => {
  assert.equal(puedeParticipar(miembro(), {}).ok, true);
});

test('los bots nunca participan', () => {
  assert.equal(puedeParticipar(miembro({ esBot: true }), {}).ok, false);
});

test('un rol bloqueado impide participar', () => {
  const resultado = puedeParticipar(miembro({ roles: ['malo'] }), { blockedRoles: ['malo'] });

  assert.equal(resultado.ok, false);
  assert.match(resultado.motivo, /rol/i);
});

test('hace falta tener alguno de los roles necesarios', () => {
  const requisitos = { requiredRoles: ['vip', 'boost'] };

  assert.equal(puedeParticipar(miembro({ roles: ['vip'] }), requisitos).ok, true);
  assert.equal(puedeParticipar(miembro({ roles: ['boost'] }), requisitos).ok, true);
  assert.equal(puedeParticipar(miembro({ roles: ['otro'] }), requisitos).ok, false);
});

test('el rol bloqueado manda sobre el necesario', () => {
  // Tener el rol de VIP no salva a quien está en la lista negra.
  const resultado = puedeParticipar(miembro({ roles: ['vip', 'malo'] }), {
    requiredRoles: ['vip'],
    blockedRoles: ['malo'],
  });

  assert.equal(resultado.ok, false);
});

test('exige llevar un mínimo de días en el servidor', () => {
  const requisitos = { minAccountDays: 30 };

  assert.equal(puedeParticipar(miembro({ diasEnServidor: 60 }), requisitos).ok, true);
  assert.equal(puedeParticipar(miembro({ diasEnServidor: 5 }), requisitos).ok, false);
});

test('sin fecha de entrada no se cuela quien no se puede comprobar', () => {
  // Dejar pasar aquí sería saltarse justo la protección contra cuentas nuevas.
  const resultado = puedeParticipar(
    { roleIds: [], joinedAt: null, level: 0 },
    { minAccountDays: 30 }
  );

  assert.equal(resultado.ok, false);
});

test('sin requisito de antigüedad, da igual no tener fecha', () => {
  assert.equal(puedeParticipar({ roleIds: [], joinedAt: null }, {}).ok, true);
});

test('exige un nivel mínimo', () => {
  const requisitos = { minLevel: 10 };

  assert.equal(puedeParticipar(miembro({ level: 15 }), requisitos).ok, true);
  assert.equal(puedeParticipar(miembro({ level: 10 }), requisitos).ok, true);
  assert.equal(puedeParticipar(miembro({ level: 3 }), requisitos).ok, false);
});

test('el motivo del rechazo dice qué falta', () => {
  const resultado = puedeParticipar(miembro({ level: 3 }), { minLevel: 10 });

  assert.match(resultado.motivo, /nivel 10/);
  assert.match(resultado.motivo, /nivel 3/);
});

// ── describirRequisitos ──────────────────────────────────────────

test('sin requisitos no se enseña nada', () => {
  assert.deepEqual(describirRequisitos({}), []);
  assert.deepEqual(describirRequisitos(), []);
});

test('describe cada requisito en castellano', () => {
  const lineas = describirRequisitos({
    requiredRoles: ['111'],
    blockedRoles: ['222'],
    minAccountDays: 7,
    minLevel: 5,
  });

  assert.equal(lineas.length, 4);
  assert.ok(lineas.some((l) => l.includes('<@&111>')));
  assert.ok(lineas.some((l) => l.includes('NO tener')));
  assert.ok(lineas.some((l) => l.includes('7 día')));
  assert.ok(lineas.some((l) => l.includes('nivel 5')));
});

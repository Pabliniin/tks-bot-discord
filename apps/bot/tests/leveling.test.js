'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  xpForLevel,
  totalXpForLevel,
  levelFromXp,
  progressFromXp,
  calculateMessageXp,
  rolesForLevel,
} = require('@tkbot/shared');

test('la XP por nivel crece de forma estrictamente creciente', () => {
  assert.equal(xpForLevel(0), 100);
  for (let level = 1; level < 100; level += 1) {
    assert.ok(
      xpForLevel(level) > xpForLevel(level - 1),
      `el nivel ${level} debería costar más que el ${level - 1}`
    );
  }
});

test('levelFromXp y totalXpForLevel son inversas coherentes', () => {
  for (let level = 0; level <= 60; level += 1) {
    const total = totalXpForLevel(level);
    // Con la XP exacta se está en ese nivel.
    assert.equal(levelFromXp(total), level, `XP total del nivel ${level}`);
    // Con un punto menos, en el anterior.
    if (level > 0) assert.equal(levelFromXp(total - 1), level - 1);
  }
});

test('levelFromXp trata valores límite sin romperse', () => {
  assert.equal(levelFromXp(0), 0);
  assert.equal(levelFromXp(-500), 0);
  assert.equal(levelFromXp(99), 0);
  assert.equal(levelFromXp(100), 1);
  // Un valor absurdo no debe colgar el bucle.
  assert.ok(levelFromXp(Number.MAX_SAFE_INTEGER) <= 1001);
});

test('progressFromXp devuelve un porcentaje dentro de rango', () => {
  for (const xp of [0, 50, 100, 1234, 50_000, 1_000_000]) {
    const p = progressFromXp(xp);
    assert.ok(p.percent >= 0 && p.percent <= 100, `porcentaje fuera de rango con ${xp} XP`);
    assert.ok(p.current >= 0 && p.current < p.required, `progreso incoherente con ${xp} XP`);
    assert.equal(p.level, levelFromXp(xp));
  }
});

test('calculateMessageXp aplica el multiplicador global', () => {
  assert.equal(calculateMessageXp({ xpPerMessage: 20, xpRate: 1 }, []), 20);
  assert.equal(calculateMessageXp({ xpPerMessage: 20, xpRate: 2 }, []), 40);
  assert.equal(calculateMessageXp({ xpPerMessage: 15, xpRate: 0.5 }, []), 8);
  // Sin configuración usa los valores por defecto.
  assert.equal(calculateMessageXp({}, []), 20);
});

test('calculateMessageXp aplica el mayor multiplicador de rol que tenga el miembro', () => {
  const settings = {
    xpPerMessage: 10,
    xpRate: 1,
    multipliers: [
      { roleId: 'A', multiplier: 2 },
      { roleId: 'B', multiplier: 3 },
    ],
  };

  assert.equal(calculateMessageXp(settings, ['A']), 20);
  assert.equal(calculateMessageXp(settings, ['B']), 30);
  // Con ambos roles se aplica el mayor, no la suma.
  assert.equal(calculateMessageXp(settings, ['A', 'B']), 30);
  assert.equal(calculateMessageXp(settings, ['C']), 10);
});

test('rolesForLevel sin acumular deja solo el rol más alto', () => {
  const roles = [
    { level: 5, roleId: 'r5' },
    { level: 10, roleId: 'r10' },
    { level: 20, roleId: 'r20' },
  ];

  const result = rolesForLevel(roles, 12, false);
  assert.deepEqual(result.add, ['r10']);
  assert.ok(result.remove.includes('r5'));
  assert.ok(result.remove.includes('r20'));
});

test('rolesForLevel acumulando devuelve todos los alcanzados', () => {
  const roles = [
    { level: 5, roleId: 'r5' },
    { level: 10, roleId: 'r10' },
    { level: 20, roleId: 'r20' },
  ];

  const result = rolesForLevel(roles, 12, true);
  assert.deepEqual(result.add, ['r5', 'r10']);
  assert.deepEqual(result.remove, []);
});

test('rolesForLevel no otorga nada por debajo del primer umbral', () => {
  const roles = [{ level: 5, roleId: 'r5' }];
  assert.deepEqual(rolesForLevel(roles, 1, false), { add: [], remove: [] });
});

test('rolesForLevel ignora entradas mal formadas', () => {
  const roles = [
    { level: 5, roleId: 'r5' },
    { level: 'no-es-un-numero', roleId: 'malo' },
    { level: 10 },
    null,
  ];

  const result = rolesForLevel(roles, 50, true);
  assert.deepEqual(result.add, ['r5']);
  assert.deepEqual(rolesForLevel(undefined, 10, true), { add: [], remove: [] });
});

test('los roles desordenados se ordenan por nivel', () => {
  const roles = [
    { level: 20, roleId: 'r20' },
    { level: 5, roleId: 'r5' },
    { level: 10, roleId: 'r10' },
  ];
  assert.deepEqual(rolesForLevel(roles, 25, false).add, ['r20']);
});

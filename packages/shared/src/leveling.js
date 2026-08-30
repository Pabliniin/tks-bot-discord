'use strict';

/**
 * Fórmulas del sistema de niveles.
 *
 * La curva es la clásica de MEE6/ProBot: cada nivel cuesta progresivamente más,
 * de modo que el nivel 1 son 100 XP, el 10 unos 9.500 y el 50 unos 385.000.
 */

/** XP necesaria para pasar del nivel `level` al siguiente. */
function xpForLevel(level) {
  const l = Math.max(0, Math.floor(level));
  return 5 * l * l + 50 * l + 100;
}

/** XP total acumulada necesaria para alcanzar `level`. */
function totalXpForLevel(level) {
  let total = 0;
  for (let i = 0; i < Math.max(0, Math.floor(level)); i += 1) {
    total += xpForLevel(i);
  }
  return total;
}

/** Nivel correspondiente a una cantidad total de XP. */
function levelFromXp(xp) {
  let level = 0;
  let remaining = Math.max(0, Math.floor(xp));
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level += 1;
    // Tope defensivo: evita bucles infinitos con valores corruptos.
    if (level > 1000) break;
  }
  return level;
}

/**
 * Progreso dentro del nivel actual.
 * @param {number} xp XP total del miembro.
 * @returns {{ level: number, current: number, required: number, percent: number }}
 */
function progressFromXp(xp) {
  const level = levelFromXp(xp);
  const consumed = totalXpForLevel(level);
  const current = Math.max(0, Math.floor(xp) - consumed);
  const required = xpForLevel(level);
  return {
    level,
    current,
    required,
    percent: required > 0 ? Math.min(100, (current / required) * 100) : 0,
  };
}

/**
 * XP que otorga un mensaje, aplicando el multiplicador global y los de rol.
 *
 * @param {object} settings Configuración `levels` del servidor.
 * @param {string[]} memberRoleIds Roles del miembro.
 * @returns {number} XP entera a sumar.
 */
function calculateMessageXp(settings, memberRoleIds = []) {
  const base = Number(settings?.xpPerMessage) || 20;
  const rate = Number(settings?.xpRate) || 1;

  // De todos los roles con multiplicador que tenga el miembro se aplica el mayor.
  let roleMultiplier = 1;
  const multipliers = Array.isArray(settings?.multipliers) ? settings.multipliers : [];
  for (const entry of multipliers) {
    if (memberRoleIds.includes(entry.roleId)) {
      roleMultiplier = Math.max(roleMultiplier, Number(entry.multiplier) || 1);
    }
  }

  return Math.max(0, Math.round(base * rate * roleMultiplier));
}

/**
 * Roles que corresponden a un nivel.
 * @param {Array<{level:number, roleId:string}>} roles Roles configurados.
 * @param {number} level Nivel alcanzado.
 * @param {boolean} stack Si `true` devuelve todos los roles hasta el nivel.
 * @returns {{ add: string[], remove: string[] }}
 */
function rolesForLevel(roles, level, stack = false) {
  const list = (Array.isArray(roles) ? roles : [])
    .filter((r) => r && r.roleId && Number.isFinite(Number(r.level)))
    .sort((a, b) => a.level - b.level);

  const earned = list.filter((r) => Number(r.level) <= level);
  if (earned.length === 0) return { add: [], remove: [] };

  if (stack) {
    return { add: earned.map((r) => r.roleId), remove: [] };
  }

  // Sin acumulación: solo el rol del nivel más alto alcanzado.
  const highest = earned[earned.length - 1];
  return {
    add: [highest.roleId],
    remove: list.filter((r) => r.roleId !== highest.roleId).map((r) => r.roleId),
  };
}

module.exports = {
  xpForLevel,
  totalXpForLevel,
  levelFromXp,
  progressFromXp,
  calculateMessageXp,
  rolesForLevel,
};

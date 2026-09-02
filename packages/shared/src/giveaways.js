'use strict';

/**
 * Lógica pura de los sorteos.
 *
 * Aquí no se toca Discord ni la base de datos: solo se decide quién puede
 * participar y quién gana. Así se puede probar el sorteo mil veces sin montar
 * nada, que es justo lo que hace falta para fiarse de un reparto al azar.
 */

/**
 * Elige ganadores al azar, sin repetir.
 *
 * Usa Fisher-Yates parcial en vez de «ordenar al azar»: `sort` con un
 * comparador aleatorio NO reparte de forma uniforme, y en un sorteo eso
 * significa que unos participantes tendrían más posibilidades que otros sin
 * que se note a simple vista.
 *
 * @param {string[]} participantes
 * @param {number} cuantos
 * @param {() => number} [azar] Inyectable para poder probarlo.
 * @returns {string[]}
 */
function elegirGanadores(participantes, cuantos, azar = Math.random) {
  const lista = [...new Set(participantes || [])];
  const total = Math.min(Math.max(0, Math.floor(cuantos)), lista.length);

  for (let i = 0; i < total; i += 1) {
    const j = i + Math.floor(azar() * (lista.length - i));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }

  return lista.slice(0, total);
}

/**
 * ¿Puede este miembro participar?
 *
 * @param {object} params
 * @param {string[]} params.roleIds Roles que tiene.
 * @param {Date|number} params.joinedAt Cuándo entró al servidor.
 * @param {number} [params.level] Nivel actual.
 * @param {boolean} [params.esBot]
 * @param {object} requisitos Rama `requirements` del sorteo.
 * @param {Date} [ahora]
 * @returns {{ ok: true } | { ok: false, motivo: string }}
 */
function puedeParticipar({ roleIds = [], joinedAt, level = 0, esBot = false }, requisitos = {}, ahora = new Date()) {
  if (esBot) return { ok: false, motivo: 'Los bots no pueden participar.' };

  const bloqueados = requisitos.blockedRoles || [];
  if (roleIds.some((r) => bloqueados.includes(r))) {
    return { ok: false, motivo: 'Tienes un rol que no puede participar en este sorteo.' };
  }

  const necesarios = requisitos.requiredRoles || [];
  if (necesarios.length > 0 && !roleIds.some((r) => necesarios.includes(r))) {
    return {
      ok: false,
      motivo: `Necesitas uno de estos roles: ${necesarios.map((r) => `<@&${r}>`).join(', ')}`,
    };
  }

  const diasMinimos = requisitos.minAccountDays || 0;
  if (diasMinimos > 0) {
    const entrada = joinedAt ? new Date(joinedAt).getTime() : null;

    // Sin fecha de entrada no se puede comprobar, y dejar pasar sería saltarse
    // justo la protección contra cuentas recién creadas.
    if (!entrada) {
      return { ok: false, motivo: 'No se ha podido comprobar cuánto llevas en el servidor.' };
    }

    const dias = (ahora.getTime() - entrada) / 86_400_000;
    if (dias < diasMinimos) {
      return {
        ok: false,
        motivo: `Tienes que llevar al menos ${diasMinimos} día(s) en el servidor. Llevas ${Math.floor(dias)}.`,
      };
    }
  }

  const nivelMinimo = requisitos.minLevel || 0;
  if (nivelMinimo > 0 && level < nivelMinimo) {
    return { ok: false, motivo: `Necesitas ser nivel ${nivelMinimo}. Eres nivel ${level}.` };
  }

  return { ok: true };
}

/**
 * Resume los requisitos en texto, para enseñarlos en el mensaje del sorteo.
 * @param {object} requisitos
 * @returns {string[]}
 */
function describirRequisitos(requisitos = {}) {
  const lineas = [];

  const necesarios = requisitos.requiredRoles || [];
  if (necesarios.length > 0) {
    lineas.push(`Tener ${necesarios.map((r) => `<@&${r}>`).join(' o ')}`);
  }

  const bloqueados = requisitos.blockedRoles || [];
  if (bloqueados.length > 0) {
    lineas.push(`NO tener ${bloqueados.map((r) => `<@&${r}>`).join(' ni ')}`);
  }

  if (requisitos.minAccountDays > 0) {
    lineas.push(`Llevar ${requisitos.minAccountDays} día(s) en el servidor`);
  }
  if (requisitos.minLevel > 0) {
    lineas.push(`Ser nivel ${requisitos.minLevel} o más`);
  }

  return lineas;
}

module.exports = { elegirGanadores, puedeParticipar, describirRequisitos };

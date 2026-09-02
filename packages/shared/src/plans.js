'use strict';

const { PREMIUM_TIERS } = require('./constants.json');

/**
 * Catálogo de planes de pago.
 *
 * Aquí va solo lo que se enseña (nivel, periodo, precio). Los identificadores
 * de precio de Stripe viven en variables de entorno del panel, porque cambian
 * entre la cuenta de pruebas y la real y no deben acabar en el repositorio.
 *
 * El bot también lo importa para poder decir cuánto cuesta cada cosa sin
 * duplicar los precios en dos sitios.
 */

/**
 * Planes que se pueden comprar.
 *
 * `ahorro` es el porcentaje que se ahorra pagando al año frente a doce meses
 * sueltos. Se calcula abajo para que no se quede desfasado al tocar un precio.
 */
const PLANES = [
  {
    id: 'tier1-mensual',
    tier: 1,
    periodo: 'mensual',
    /** Céntimos, para no arrastrar decimales por ahí. */
    precioCentimos: 499,
    moneda: 'EUR',
    /** Variable de entorno con el identificador de precio de Stripe. */
    envPrecio: 'STRIPE_PRICE_TIER1_MENSUAL',
  },
  {
    id: 'tier1-anual',
    tier: 1,
    periodo: 'anual',
    precioCentimos: 4990,
    moneda: 'EUR',
    envPrecio: 'STRIPE_PRICE_TIER1_ANUAL',
  },
  {
    id: 'tier2-mensual',
    tier: 2,
    periodo: 'mensual',
    precioCentimos: 999,
    moneda: 'EUR',
    envPrecio: 'STRIPE_PRICE_TIER2_MENSUAL',
  },
  {
    id: 'tier2-anual',
    tier: 2,
    periodo: 'anual',
    precioCentimos: 9990,
    moneda: 'EUR',
    envPrecio: 'STRIPE_PRICE_TIER2_ANUAL',
  },
];

/** Formatea céntimos como «4,99 €». */
function formatearPrecio(centimos, moneda = 'EUR') {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: moneda,
  }).format(centimos / 100);
}

/**
 * Cuánto se ahorra al año frente a pagar doce meses sueltos.
 * @param {number} tier
 * @returns {{ porcentaje: number, centimos: number }|null}
 */
function ahorroAnual(tier) {
  const mensual = PLANES.find((p) => p.tier === tier && p.periodo === 'mensual');
  const anual = PLANES.find((p) => p.tier === tier && p.periodo === 'anual');
  if (!mensual || !anual) return null;

  const doceMeses = mensual.precioCentimos * 12;
  const diferencia = doceMeses - anual.precioCentimos;
  if (diferencia <= 0) return null;

  return {
    porcentaje: Math.round((diferencia / doceMeses) * 100),
    centimos: diferencia,
  };
}

/** Busca un plan por su identificador. */
function getPlan(id) {
  return PLANES.find((p) => p.id === id) || null;
}

/**
 * Planes de un nivel, con el precio ya formateado.
 * @param {number} tier
 */
function planesDeNivel(tier) {
  return PLANES.filter((p) => p.tier === tier).map((plan) => ({
    ...plan,
    precio: formatearPrecio(plan.precioCentimos, plan.moneda),
    nombre: PREMIUM_TIERS[plan.tier]?.name || `Premium ${plan.tier}`,
  }));
}

module.exports = { PLANES, getPlan, planesDeNivel, formatearPrecio, ahorroAnual };

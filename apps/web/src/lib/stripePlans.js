// Import por defecto y desestructurado: el paquete compartido es CommonJS y
// Node no admite imports con nombre sobre él (webpack sí, pero las pruebas
// cargan este archivo tal cual).
import plans from '@tkbot/shared/src/plans.js';

const { PLANES, getPlan } = plans;

/**
 * Traducción entre los precios de Stripe y nuestros planes.
 *
 * Va separado de `stripe.js` a propósito: aquí no se importa el SDK de Stripe,
 * solo se leen variables de entorno. Así esta lógica —que es la que decide
 * quién tiene premium— se puede probar sin montar nada.
 */

/** ¿Están los pagos configurados y listos? */
export function pagosDisponibles() {
  if (!process.env.STRIPE_SECRET_KEY) return false;
  // Sin al menos un precio configurado no hay nada que vender.
  return PLANES.some((plan) => Boolean(process.env[plan.envPrecio]));
}

/**
 * Identificador de precio de Stripe de un plan.
 * @param {string} planId
 * @returns {string|null}
 */
export function precioDe(planId) {
  const plan = getPlan(planId);
  if (!plan) return null;

  return process.env[plan.envPrecio] || null;
}

/**
 * Traduce un precio de Stripe al nivel premium que da.
 *
 * Es la comprobación que importa de verdad: el nivel NUNCA se toma de lo que
 * diga el navegador, sino de lo que Stripe confirma que se ha pagado.
 *
 * @param {string} priceId
 * @returns {{ tier: number, periodo: string, planId: string }|null}
 */
export function nivelDePrecio(priceId) {
  if (!priceId) return null;

  for (const plan of PLANES) {
    if (process.env[plan.envPrecio] === priceId) {
      return { tier: plan.tier, periodo: plan.periodo, planId: plan.id };
    }
  }
  return null;
}

/** Planes que están realmente a la venta (tienen precio configurado). */
export function planesALaVenta() {
  return PLANES.filter((plan) => Boolean(process.env[plan.envPrecio])).map((plan) => ({
    id: plan.id,
    tier: plan.tier,
    periodo: plan.periodo,
    precioCentimos: plan.precioCentimos,
    moneda: plan.moneda,
  }));
}

/**
 * Estados de Stripe que dan derecho a usar el premium.
 *
 * `past_due` se incluye a propósito: si un cobro falla, Stripe reintenta
 * varios días. Cortar el servicio al primer fallo por una tarjeta caducada es
 * la forma más rápida de perder a un cliente que sí quería pagar.
 */
export const ESTADOS_CON_ACCESO = new Set(['active', 'trialing', 'past_due']);

/**
 * Extrae el estado de una suscripción de Stripe.
 *
 * Es lo que decide quién tiene premium y hasta cuándo, así que vive aquí
 * junto al resto de la traducción y sin tocar la base de datos: se puede
 * probar cada estado de Stripe uno a uno sin montar nada.
 *
 * @param {object} suscripcion Objeto `subscription` de Stripe.
 * @returns {{ tier: number, until: Date|null, status: string, priceId: string|null,
 *             planId: string|null, cancelAtPeriodEnd: boolean, currentPeriodEnd: Date|null }}
 */
export function leerSuscripcion(suscripcion) {
  const linea = suscripcion?.items?.data?.[0];
  const priceId = linea?.price?.id || null;
  const plan = nivelDePrecio(priceId);

  const status = suscripcion?.status || 'incomplete';
  const conAcceso = ESTADOS_CON_ACCESO.has(status);

  /*
   * `current_period_end` viene en segundos. Se le suman dos días de margen:
   * si un cobro se retrasa unas horas, nadie se queda sin servicio en mitad
   * de la renovación por un desfase de relojes.
   */
  const finConMargen = suscripcion?.current_period_end
    ? new Date(suscripcion.current_period_end * 1000 + 2 * 86_400_000)
    : null;

  return {
    tier: conAcceso && plan ? plan.tier : 0,
    // Sin acceso se pone una fecha ya pasada, que es como el resto del código
    // representa «caducado» (ver `effectiveTier` en el paquete compartido).
    until: conAcceso ? finConMargen : new Date(0),
    status,
    priceId,
    planId: plan?.planId || null,
    cancelAtPeriodEnd: Boolean(suscripcion?.cancel_at_period_end),
    currentPeriodEnd: suscripcion?.current_period_end
      ? new Date(suscripcion.current_period_end * 1000)
      : null,
  };
}

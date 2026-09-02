import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PLANES, getPlan, ahorroAnual, formatearPrecio } = require('@tkbot/shared/src/plans');

/**
 * Pruebas del catálogo de planes y de la lectura de suscripciones.
 *
 * Aquí un fallo cuesta dinero de verdad: dar premium a quien no ha pagado, o
 * quitárselo a quien sí. Por eso se prueba cada estado de Stripe uno a uno.
 *
 * Se ejecutan con: npm run test --workspace @tkbot/web
 */

// ── Catálogo de planes ───────────────────────────────────────────

test('hay un plan mensual y uno anual por cada nivel de pago', () => {
  for (const tier of [1, 2]) {
    const delNivel = PLANES.filter((p) => p.tier === tier);
    assert.equal(delNivel.length, 2, `el nivel ${tier} no tiene dos planes`);
    assert.deepEqual(
      delNivel.map((p) => p.periodo).sort(),
      ['anual', 'mensual']
    );
  }
});

test('cada plan declara su variable de entorno para el precio de Stripe', () => {
  for (const plan of PLANES) {
    assert.match(plan.envPrecio, /^STRIPE_PRICE_/, `${plan.id} no declara variable`);
    assert.ok(plan.precioCentimos > 0, `${plan.id} no tiene precio`);
  }
});

test('el anual sale más barato que doce meses sueltos', () => {
  for (const tier of [1, 2]) {
    const ahorro = ahorroAnual(tier);
    assert.ok(ahorro, `el nivel ${tier} no ahorra nada al año`);
    assert.ok(ahorro.porcentaje > 0);
  }
});

test('el precio se formatea en euros a la española', () => {
  // El espacio antes del € es un espacio duro, que es lo correcto en español.
  assert.match(formatearPrecio(499), /^4,99\s€$/);
  assert.match(formatearPrecio(4990), /^49,90\s€$/);
});

test('getPlan devuelve null en vez de reventar con un plan inventado', () => {
  assert.equal(getPlan('gratis-total'), null);
  assert.equal(getPlan(''), null);
  assert.equal(getPlan(null), null);
  assert.ok(getPlan('tier1-mensual'));
});

// ── Lectura de suscripciones de Stripe ───────────────────────────

/**
 * Carga `leerSuscripcion` con las variables de entorno puestas.
 *
 * El módulo lee `process.env` al traducir un precio a un nivel, así que hay
 * que ponerlas antes de importarlo.
 */
async function cargarLector() {
  process.env.STRIPE_PRICE_TIER1_MENSUAL = 'price_t1m';
  process.env.STRIPE_PRICE_TIER1_ANUAL = 'price_t1a';
  process.env.STRIPE_PRICE_TIER2_MENSUAL = 'price_t2m';
  process.env.STRIPE_PRICE_TIER2_ANUAL = 'price_t2a';

  const { leerSuscripcion } = await import('../src/lib/stripePlans.js');
  return leerSuscripcion;
}

/** Suscripción de Stripe de mentira. */
function suscripcion({ status = 'active', priceId = 'price_t1m', finEnDias = 30, cancela = false } = {}) {
  return {
    id: 'sub_123',
    status,
    customer: 'cus_123',
    cancel_at_period_end: cancela,
    current_period_end: Math.floor((Date.now() + finEnDias * 86_400_000) / 1000),
    items: { data: [{ price: { id: priceId } }] },
  };
}

test('una suscripción activa da el nivel del precio contratado', async () => {
  const leer = await cargarLector();

  assert.equal(leer(suscripcion({ priceId: 'price_t1m' })).tier, 1);
  assert.equal(leer(suscripcion({ priceId: 'price_t2a' })).tier, 2);
});

test('un precio desconocido no da premium', async () => {
  const leer = await cargarLector();

  // Pasa si se crea una suscripción a mano en Stripe con otro precio.
  assert.equal(leer(suscripcion({ priceId: 'price_inventado' })).tier, 0);
});

test('un pago fallido NO corta el acceso', async () => {
  const leer = await cargarLector();
  const estado = leer(suscripcion({ status: 'past_due' }));

  // Stripe reintenta varios días; casi siempre es una tarjeta caducada.
  // Cortar al primer fallo es la forma más rápida de perder a un cliente.
  assert.equal(estado.tier, 1);
  assert.equal(estado.status, 'past_due');
});

test('el periodo de prueba da acceso', async () => {
  const leer = await cargarLector();
  assert.equal(leer(suscripcion({ status: 'trialing' })).tier, 1);
});

test('una suscripción cancelada o impagada no da acceso', async () => {
  const leer = await cargarLector();

  for (const status of ['canceled', 'unpaid', 'incomplete', 'incomplete_expired']) {
    assert.equal(leer(suscripcion({ status })).tier, 0, `${status} no debería dar acceso`);
  }
});

test('el acceso se extiende un poco más allá del periodo pagado', async () => {
  const leer = await cargarLector();
  const estado = leer(suscripcion({ finEnDias: 30 }));

  const finReal = new Date(estado.currentPeriodEnd).getTime();
  const finAcceso = new Date(estado.until).getTime();

  // Dos días de margen: si la renovación se retrasa unas horas, nadie se
  // queda sin servicio por un desfase de relojes.
  assert.ok(finAcceso > finReal, 'el acceso debería durar algo más que el periodo');
  assert.ok(finAcceso - finReal <= 3 * 86_400_000, 'el margen no debería pasar de tres días');
});

test('una baja programada sigue dando acceso hasta el final', async () => {
  const leer = await cargarLector();
  const estado = leer(suscripcion({ cancela: true }));

  assert.equal(estado.tier, 1, 'ha pagado el periodo: le corresponde usarlo');
  assert.equal(estado.cancelAtPeriodEnd, true);
});

test('una suscripción sin líneas no revienta', async () => {
  const leer = await cargarLector();
  const estado = leer({ id: 'sub_1', status: 'active', items: { data: [] } });

  assert.equal(estado.tier, 0);
  assert.equal(estado.priceId, null);
});

test('leerSuscripcion aguanta datos incompletos', async () => {
  const leer = await cargarLector();

  assert.equal(leer({}).tier, 0);
  assert.equal(leer(null).tier, 0);
  assert.equal(leer(undefined).tier, 0);
});

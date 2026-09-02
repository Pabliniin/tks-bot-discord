import { User, connect } from '@tkbot/shared';

import { nivelDePrecio, ESTADOS_CON_ACCESO, leerSuscripcion } from './stripePlans.js';

// Se reexporta para que quien ya la importaba de aquí siga funcionando.
export { leerSuscripcion };

/**
 * Aplicación de lo que dice Stripe al premium del usuario.
 *
 * Va en su propio módulo, separado de las rutas, porque es la pieza que
 * decide quién tiene acceso a qué: conviene poder leerla de un tirón y
 * probarla sin montar un servidor.
 */

/**
 * Aplica una suscripción de Stripe al usuario.
 *
 * @param {string} userId Identificador de Discord.
 * @param {object} suscripcion Objeto `subscription` de Stripe.
 * @param {Date} [ocurridoEn] Cuándo pasó el evento, para descartar los tardíos.
 * @returns {Promise<{ aplicado: boolean, motivo?: string, tier?: number }>}
 */
export async function aplicarSuscripcion(userId, suscripcion, ocurridoEn = new Date()) {
  if (!/^\d{16,20}$/.test(String(userId || ''))) {
    return { aplicado: false, motivo: 'Identificador de usuario no válido.' };
  }

  await connect();

  const estado = leerSuscripcion(suscripcion);

  /*
   * Los webhooks no llegan en orden. Si este evento es más antiguo que el
   * último que aplicamos, hacerle caso revertiría un cambio más nuevo: por
   * ejemplo, procesar una «creación» después de la «cancelación».
   */
  const usuario = await User.findOne({ userId }).select('billing premium').lean();
  const ultimo = usuario?.billing?.lastEventAt;

  if (ultimo && ocurridoEn < new Date(ultimo)) {
    return { aplicado: false, motivo: 'Evento más antiguo que el último aplicado.' };
  }

  /*
   * Si alguien tiene premium regalado por más tiempo del que cubre su
   * suscripción, no se le rebaja: se respeta lo que ya tenía. Pasa cuando se
   * le da premium a mano y luego además lo compra.
   */
  const regaladoHasta = usuario?.premium?.until ? new Date(usuario.premium.until) : null;
  const sinPasarela = !usuario?.billing?.subscriptionId;

  let tier = estado.tier;
  let until = estado.until;

  if (sinPasarela && regaladoHasta && estado.tier === 0 && regaladoHasta > new Date()) {
    tier = Number(usuario.premium.tier) || 0;
    until = regaladoHasta;
  }

  await User.updateOne(
    { userId },
    {
      $set: {
        'premium.tier': tier,
        'premium.until': until,
        'billing.subscriptionId': suscripcion.id,
        'billing.status': estado.status,
        'billing.priceId': estado.priceId,
        'billing.currentPeriodEnd': estado.currentPeriodEnd,
        'billing.cancelAtPeriodEnd': estado.cancelAtPeriodEnd,
        'billing.lastEventAt': ocurridoEn,
        ...(typeof suscripcion.customer === 'string'
          ? { 'billing.stripeCustomerId': suscripcion.customer }
          : {}),
      },
      $setOnInsert: { userId },
    },
    { upsert: true }
  );

  return { aplicado: true, tier, status: estado.status };
}

/**
 * Marca una suscripción como cancelada y retira el premium.
 *
 * No se tocan los servidores donde el usuario lo había aplicado: el premium
 * del servidor tiene su propia fecha de caducidad y expira solo. Quitárselo de
 * golpe dejaría a un servidor sin Anti-Raid en mitad de la noche, sin aviso.
 *
 * @param {string} userId
 * @param {Date} [ocurridoEn]
 */
export async function cancelarSuscripcion(userId, ocurridoEn = new Date()) {
  if (!/^\d{16,20}$/.test(String(userId || ''))) {
    return { aplicado: false, motivo: 'Identificador de usuario no válido.' };
  }

  await connect();

  const usuario = await User.findOne({ userId }).select('billing').lean();
  const ultimo = usuario?.billing?.lastEventAt;

  if (ultimo && ocurridoEn < new Date(ultimo)) {
    return { aplicado: false, motivo: 'Evento más antiguo que el último aplicado.' };
  }

  await User.updateOne(
    { userId },
    {
      $set: {
        'premium.tier': 0,
        'premium.until': new Date(0),
        'billing.status': 'canceled',
        'billing.subscriptionId': null,
        'billing.cancelAtPeriodEnd': false,
        'billing.lastEventAt': ocurridoEn,
      },
    }
  );

  return { aplicado: true };
}

/**
 * Resumen de facturación para enseñar en la web.
 * @param {object} billing Rama `billing` del usuario.
 */
export function resumirFacturacion(billing) {
  if (!billing?.subscriptionId) return null;

  const fin = billing.currentPeriodEnd ? new Date(billing.currentPeriodEnd) : null;

  return {
    status: billing.status,
    activa: ESTADOS_CON_ACCESO.has(billing.status),
    cancelaAlFinal: Boolean(billing.cancelAtPeriodEnd),
    renuevaEl: fin ? fin.toISOString() : null,
    // Un cobro fallido se avisa en el panel: es la única forma de que el
    // usuario se entere antes de perder el servicio.
    pagoFallido: billing.status === 'past_due',
    plan: nivelDePrecio(billing.priceId),
  };
}

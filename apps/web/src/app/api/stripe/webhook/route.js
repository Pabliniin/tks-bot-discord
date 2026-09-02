import { NextResponse } from 'next/server';
import { StripeEvent, connect } from '@tkbot/shared';

import { getStripe } from '@/lib/stripe';
import { aplicarSuscripcion, cancelarSuscripcion } from '@/lib/subscriptions';

export const dynamic = 'force-dynamic';

/**
 * Webhook de Stripe.
 *
 * Es la ruta más delicada del proyecto: es lo único que decide quién ha pagado.
 * Tres cosas la protegen, y ninguna sobra:
 *
 *   1. **Firma.** Se comprueba con el cuerpo en crudo. Sin esto, cualquiera
 *      podría enviar un «ha pagado» falso y regalarse el premium.
 *   2. **Deduplicación.** Stripe reintenta durante 72 horas si no respondemos
 *      rápido, así que el mismo evento llega varias veces.
 *   3. **Orden.** Los eventos no llegan ordenados; cada uno trae su fecha y se
 *      descarta el que sea más antiguo que lo ya aplicado.
 */

/** Eventos que nos interesan. El resto se acepta y se ignora. */
const EVENTOS = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
]);

export async function POST(request) {
  const stripe = getStripe();
  const secreto = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !secreto) {
    // Sin configurar no se puede verificar nada, así que no se procesa nada.
    return NextResponse.json({ error: 'Webhook no configurado.' }, { status: 503 });
  }

  const firma = request.headers.get('stripe-signature');
  if (!firma) {
    return NextResponse.json({ error: 'Falta la firma.' }, { status: 400 });
  }

  /*
   * El cuerpo tiene que leerse EN CRUDO: la firma se calcula sobre los bytes
   * exactos que envió Stripe. Parsearlo antes cambiaría espacios y el orden de
   * las claves, y la verificación fallaría siempre.
   */
  let evento;
  try {
    const crudo = await request.text();
    evento = stripe.webhooks.constructEvent(crudo, firma, secreto);
  } catch (error) {
    console.error('Firma de Stripe no válida:', error.message);
    return NextResponse.json({ error: 'Firma no válida.' }, { status: 400 });
  }

  if (!EVENTOS.has(evento.type)) {
    // Se responde 200 para que Stripe no lo reintente eternamente.
    return NextResponse.json({ recibido: true, ignorado: true });
  }

  try {
    await connect();

    /*
     * Deduplicación. El índice único de `eventId` hace el trabajo: si el
     * evento ya se procesó, la inserción falla con el código 11000 y salimos.
     */
    try {
      await StripeEvent.create({ eventId: evento.id, type: evento.type });
    } catch (error) {
      if (error.code === 11000) {
        return NextResponse.json({ recibido: true, repetido: true });
      }
      throw error;
    }

    const ocurridoEn = new Date((evento.created || Math.floor(Date.now() / 1000)) * 1000);
    const resultado = await procesar(stripe, evento, ocurridoEn);

    // Se guarda a quién afectó, para poder investigar un cobro concreto.
    if (resultado?.userId) {
      await StripeEvent.updateOne({ eventId: evento.id }, { $set: { userId: resultado.userId } });
    }

    return NextResponse.json({ recibido: true, ...resultado });
  } catch (error) {
    console.error(`Error procesando ${evento.type}:`, error.message);

    /*
     * Se borra el registro para que el reintento de Stripe pueda volver a
     * intentarlo: si se quedara marcado como procesado, un fallo temporal de
     * la base de datos dejaría a alguien pagando sin premium.
     */
    await StripeEvent.deleteOne({ eventId: evento.id }).catch(() => {});

    return NextResponse.json({ error: 'Error al procesar.' }, { status: 500 });
  }
}

/** Reparte cada tipo de evento a su tratamiento. */
async function procesar(stripe, evento, ocurridoEn) {
  const objeto = evento.data.object;

  switch (evento.type) {
    /*
     * El pago se ha completado. Aquí todavía no se aplica nada: la suscripción
     * llega con todo el detalle en su propio evento, y usar una sola fuente
     * evita estados a medias.
     */
    case 'checkout.session.completed': {
      const userId = objeto.metadata?.discordUserId;
      if (!userId || !objeto.subscription) return { manejado: false };

      const suscripcion = await stripe.subscriptions.retrieve(objeto.subscription);
      const resultado = await aplicarSuscripcion(userId, suscripcion, ocurridoEn);

      return { userId, ...resultado };
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const userId = await resolverUsuario(stripe, objeto);
      if (!userId) return { manejado: false, motivo: 'Sin usuario de Discord asociado.' };

      const resultado = await aplicarSuscripcion(userId, objeto, ocurridoEn);
      return { userId, ...resultado };
    }

    case 'customer.subscription.deleted': {
      const userId = await resolverUsuario(stripe, objeto);
      if (!userId) return { manejado: false };

      const resultado = await cancelarSuscripcion(userId, ocurridoEn);
      return { userId, ...resultado };
    }

    /*
     * Un cobro ha fallado. NO se corta el acceso: Stripe reintenta varios días
     * y la mayoría de las veces es una tarjeta caducada que se arregla sola.
     * Solo se anota el estado, que el panel enseña como aviso.
     */
    case 'invoice.payment_failed': {
      if (!objeto.subscription) return { manejado: false };

      const suscripcion = await stripe.subscriptions.retrieve(objeto.subscription);
      const userId = await resolverUsuario(stripe, suscripcion);
      if (!userId) return { manejado: false };

      const resultado = await aplicarSuscripcion(userId, suscripcion, ocurridoEn);
      return { userId, ...resultado, avisoPagoFallido: true };
    }

    default:
      return { manejado: false };
  }
}

/**
 * Encuentra el usuario de Discord de una suscripción.
 *
 * Se mira primero en la propia suscripción y, si no está, en el cliente: una
 * suscripción creada a mano desde el panel de Stripe no lleva metadatos.
 */
async function resolverUsuario(stripe, suscripcion) {
  const enSuscripcion = suscripcion.metadata?.discordUserId;
  if (enSuscripcion) return enSuscripcion;

  const customerId =
    typeof suscripcion.customer === 'string' ? suscripcion.customer : suscripcion.customer?.id;
  if (!customerId) return null;

  try {
    const cliente = await stripe.customers.retrieve(customerId);
    return cliente?.metadata?.discordUserId || null;
  } catch {
    return null;
  }
}

import { NextResponse } from 'next/server';
import { User, connect, getPlan } from '@tkbot/shared';

import { getSession } from '@/lib/session';
import { getStripe, precioDe, pagosDisponibles } from '@/lib/stripe';
import { checkRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

/**
 * Inicia el pago de una suscripción.
 *
 * POST { plan: 'tier1-mensual' } → { url }
 *
 * El navegador solo elige un plan de nuestro catálogo; el precio y el nivel
 * los pone el servidor. Nunca se acepta un importe ni un nivel que venga del
 * cliente: sería regalar el premium a quien supiera editar una petición.
 */
export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Necesitas iniciar sesión.' }, { status: 401 });
  }

  if (!pagosDisponibles()) {
    return NextResponse.json(
      { error: 'Los pagos no están configurados en este sitio todavía.' },
      { status: 503 }
    );
  }

  const limite = checkRateLimit(session.userId, 'publicar');
  if (!limite.ok) {
    return NextResponse.json(
      { error: `Vas demasiado rápido. Espera ${limite.resetEnSegundos} segundos.` },
      { status: 429 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Petición no válida.' }, { status: 400 });
  }

  const plan = getPlan(String(body?.plan || ''));
  if (!plan) {
    return NextResponse.json({ error: 'Ese plan no existe.' }, { status: 400 });
  }

  const priceId = precioDe(plan.id);
  if (!priceId) {
    return NextResponse.json({ error: 'Ese plan no está a la venta ahora mismo.' }, { status: 400 });
  }

  const stripe = getStripe();
  const sitio = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');

  try {
    await connect();
    const usuario = await User.findOne({ userId: session.userId }).select('billing').lean();

    /*
     * Se reutiliza el cliente de Stripe si ya existe. Crear uno nuevo cada vez
     * llenaría la cuenta de clientes duplicados y haría imposible ver el
     * historial de alguien que ya compró antes.
     */
    let customerId = usuario?.billing?.stripeCustomerId || null;

    if (!customerId) {
      const cliente = await stripe.customers.create({
        // El identificador de Discord es lo que conecta el pago con la cuenta.
        // Sin esto el webhook no sabría a quién darle el premium.
        metadata: { discordUserId: session.userId, discordTag: session.username || '' },
      });
      customerId = cliente.id;

      await User.updateOne(
        { userId: session.userId },
        {
          $set: { 'billing.stripeCustomerId': customerId },
          $setOnInsert: { userId: session.userId },
        },
        { upsert: true }
      );
    }

    const checkout = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],

      success_url: `${sitio}/premium/gracias?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${sitio}/premium?cancelado=1`,

      // El identificador va también aquí porque el webhook de la suscripción
      // lo lee de la propia suscripción, no del cliente.
      subscription_data: {
        metadata: { discordUserId: session.userId },
      },
      metadata: { discordUserId: session.userId, planId: plan.id },

      allow_promotion_codes: true,
      // Hace falta para facturar bien dentro de la Unión Europea.
      billing_address_collection: 'auto',
      automatic_tax: { enabled: false },
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error('Error creando el pago:', error.message);
    return NextResponse.json(
      { error: 'No se pudo iniciar el pago. Inténtalo de nuevo en un minuto.' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { User, connect } from '@tkbot/shared';

import { getSession } from '@/lib/session';
import { getStripe, pagosDisponibles } from '@/lib/stripe';
import { checkRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

/**
 * Abre el portal de facturación de Stripe.
 *
 * Desde ahí el cliente cambia su tarjeta, descarga facturas y se da de baja
 * él solo. Es lo que evita que cada cancelación acabe siendo un ticket de
 * soporte, y en la Unión Europea la baja fácil además es obligatoria.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Necesitas iniciar sesión.' }, { status: 401 });
  }

  if (!pagosDisponibles()) {
    return NextResponse.json({ error: 'Los pagos no están configurados.' }, { status: 503 });
  }

  const limite = checkRateLimit(session.userId, 'publicar');
  if (!limite.ok) {
    return NextResponse.json(
      { error: `Vas demasiado rápido. Espera ${limite.resetEnSegundos} segundos.` },
      { status: 429 }
    );
  }

  try {
    await connect();
    const usuario = await User.findOne({ userId: session.userId }).select('billing').lean();

    const customerId = usuario?.billing?.stripeCustomerId;
    if (!customerId) {
      return NextResponse.json(
        { error: 'No tienes ninguna suscripción que gestionar.' },
        { status: 404 }
      );
    }

    const sitio = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');

    const portal = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${sitio}/premium`,
    });

    return NextResponse.json({ url: portal.url });
  } catch (error) {
    console.error('Error abriendo el portal de facturación:', error.message);
    return NextResponse.json(
      { error: 'No se pudo abrir la gestión de la suscripción.' },
      { status: 500 }
    );
  }
}

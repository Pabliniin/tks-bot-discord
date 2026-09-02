import { NextResponse } from 'next/server';
import { getTemplate, getGuildSettings, premiumTier } from '@tkbot/shared';

import { requireGuildAccess, sanitizePayload } from '@/lib/guards';
import { saveGuildSettings } from '@/lib/saveSettings';
import { checkRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

/**
 * Aplica una plantilla de configuración.
 *
 * POST { id: 'comunidad' }
 *
 * La plantilla se aplica por el mismo camino que un guardado normal, así que
 * queda anotada en el historial y se puede deshacer entera con un clic.
 */
export async function POST(request, { params }) {
  const { guildId } = await params;

  const access = await requireGuildAccess(guildId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const limite = checkRateLimit(access.session.userId, 'guardar');
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

  const plantilla = getTemplate(body?.id);
  if (!plantilla) {
    return NextResponse.json({ error: 'Esa plantilla no existe.' }, { status: 404 });
  }

  try {
    // Una plantilla de pago no debe poder aplicarse desde un servidor gratuito:
    // dejaría módulos encendidos que el bot luego ignora, y parecería un fallo.
    if (plantilla.premium) {
      const settings = await getGuildSettings(guildId);
      if (premiumTier(settings) === 0) {
        return NextResponse.json(
          {
            error: `La plantilla «${plantilla.nombre}» necesita TK$ Premium, porque activa módulos de pago.`,
          },
          { status: 403 }
        );
      }
    }

    const resultado = await saveGuildSettings({
      guildId,
      changes: sanitizePayload(plantilla.settings),
      actor: { userId: access.session.userId, tag: access.session.username },
      origen: 'plantilla',
    });

    if (!resultado.ok) {
      return NextResponse.json(
        { error: resultado.error, details: resultado.details },
        { status: resultado.status }
      );
    }

    return NextResponse.json({
      ok: true,
      settings: resultado.settings,
      applied: resultado.applied,
      plantilla: {
        id: plantilla.id,
        nombre: plantilla.nombre,
        pendientes: plantilla.pendientes,
      },
    });
  } catch (error) {
    console.error('Error aplicando la plantilla:', error.message);
    return NextResponse.json({ error: `No se pudo aplicar: ${error.message}` }, { status: 500 });
  }
}

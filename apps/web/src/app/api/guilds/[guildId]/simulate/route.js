import { NextResponse } from 'next/server';
import { getGuildSettings, simulateAutomod } from '@tkbot/shared';

import { requireGuildAccess } from '@/lib/guards';
import { checkRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

/** Un mensaje de Discord no pasa de 4000 caracteres. */
const MAX_MENSAJE = 4000;

/**
 * Simulador de AutoMod.
 *
 * POST { content, channelId?, roleIds?, isModerator?, hasAttachment?, borrador? }
 *
 * Dice qué haría el bot con ese mensaje **sin tocar Discord**. Sirve para
 * probar un filtro antes de encenderlo, en vez de descubrir a base de
 * sancionar a quien no tocaba.
 *
 * Si se pasa `borrador`, se simula contra esa configuración en vez de contra la
 * guardada: así se puede probar un cambio del formulario antes de guardarlo.
 */
export async function POST(request, { params }) {
  const { guildId } = await params;

  const access = await requireGuildAccess(guildId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const limite = checkRateLimit(access.session.userId, 'simular');
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

  const content = String(body?.content ?? '');
  if (content.length > MAX_MENSAJE) {
    return NextResponse.json(
      { error: `El mensaje de prueba no puede pasar de ${MAX_MENSAJE} caracteres.` },
      { status: 400 }
    );
  }

  try {
    const settings = await getGuildSettings(guildId);
    const guardada = settings.toObject();

    /*
     * El borrador solo puede aportar la rama `automod`: es lo único que el
     * simulador mira, y aceptar más sería dar una vía para inyectar
     * configuración arbitraria en un cálculo del servidor.
     */
    const configuracion =
      body?.borrador && typeof body.borrador === 'object' && !Array.isArray(body.borrador)
        ? { ...guardada, automod: body.borrador.automod ?? guardada.automod }
        : guardada;

    const resultado = simulateAutomod({
      content,
      settings: configuracion,
      channelId: typeof body?.channelId === 'string' ? body.channelId : null,
      roleIds: Array.isArray(body?.roleIds) ? body.roleIds.filter((r) => typeof r === 'string') : [],
      isModerator: Boolean(body?.isModerator),
      hasAttachment: Boolean(body?.hasAttachment),
    });

    return NextResponse.json({ ok: true, ...resultado });
  } catch (error) {
    console.error('Error simulando el AutoMod:', error.message);
    return NextResponse.json({ error: 'No se pudo simular.' }, { status: 500 });
  }
}

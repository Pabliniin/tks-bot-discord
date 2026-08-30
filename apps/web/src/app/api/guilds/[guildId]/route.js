import { NextResponse } from 'next/server';
import { getGuildSettings, premiumTier, premiumLimits } from '@tkbot/shared';

import { requireGuildAccess, sanitizePayload } from '@/lib/guards';
import { getGuildData, invalidateGuild } from '@/lib/botApi';

export const dynamic = 'force-dynamic';

/**
 * Configuración de un servidor.
 *
 *   GET   → devuelve la configuración guardada más los datos en vivo del bot.
 *   PATCH → guarda los cambios y refresca la caché del bot.
 */

export async function GET(request, { params }) {
  const { guildId } = await params;

  const access = await requireGuildAccess(guildId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const [settings, guildData] = await Promise.all([
      getGuildSettings(guildId),
      getGuildData(guildId),
    ]);

    return NextResponse.json({
      settings: settings.toObject ? settings.toObject() : settings,
      guildData,
      // `guildData` es null cuando el bot no está en el servidor o está apagado.
      botPresent: Boolean(guildData),
      premium: { tier: premiumTier(settings), limits: premiumLimits(settings) },
    });
  } catch (error) {
    console.error('Error leyendo la configuración:', error.message);
    return NextResponse.json(
      { error: 'No se pudo leer la configuración. ¿Está MongoDB en marcha?' },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  const { guildId } = await params;

  const access = await requireGuildAccess(guildId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'El cuerpo de la petición no es JSON válido.' }, { status: 400 });
  }

  // Solo se aceptan las claves que el panel puede editar.
  const changes = sanitizePayload(body);
  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ error: 'No hay cambios que guardar.' }, { status: 400 });
  }

  try {
    const settings = await getGuildSettings(guildId);

    for (const [key, value] of Object.entries(changes)) {
      settings.set(key, value);
    }

    // `validate` devuelve los errores del esquema antes de escribir.
    const validationError = settings.validateSync();
    if (validationError) {
      const details = Object.values(validationError.errors || {})
        .map((e) => e.message)
        .slice(0, 5);
      return NextResponse.json(
        { error: 'Hay valores no válidos.', details },
        { status: 400 }
      );
    }

    await settings.save();

    // El bot cachea la configuración 60 s: se le avisa para que la recargue ya.
    await invalidateGuild(guildId);

    return NextResponse.json({
      ok: true,
      settings: settings.toObject(),
      premium: { tier: premiumTier(settings), limits: premiumLimits(settings) },
    });
  } catch (error) {
    console.error('Error guardando la configuración:', error.message);
    return NextResponse.json(
      { error: `No se pudo guardar: ${error.message}` },
      { status: 500 }
    );
  }
}

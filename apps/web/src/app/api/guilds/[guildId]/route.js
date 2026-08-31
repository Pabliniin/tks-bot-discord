import { NextResponse } from 'next/server';
import { getGuildSettings, premiumTier, premiumLimits } from '@tkbot/shared';

import { requireGuildAccess, sanitizePayload } from '@/lib/guards';
import { validateSettings } from '@/lib/validateSettings';
import { mergeLogEvents } from '@/lib/mergeLogEvents';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rateLimit';
import { getGuildData, invalidateGuild } from '@/lib/botApi';

export const dynamic = 'force-dynamic';

/** Tamaño máximo del cuerpo de la petición: 512 KB. */
const MAX_BODY = 512 * 1024;

/**
 * Configuración de un servidor.
 *
 *   GET   → devuelve la configuración guardada más los datos en vivo del bot.
 *   PATCH → valida, guarda y refresca la caché del bot.
 */

/** Respuesta cuando se supera el límite de peticiones. */
function tooManyRequests(resultado, tipo) {
  return NextResponse.json(
    {
      error: `Vas demasiado rápido. Inténtalo de nuevo en ${resultado.resetEnSegundos} segundos.`,
    },
    { status: 429, headers: { ...rateLimitHeaders(resultado, tipo), 'Retry-After': String(resultado.resetEnSegundos) } }
  );
}

export async function GET(request, { params }) {
  const { guildId } = await params;

  const access = await requireGuildAccess(guildId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const limite = checkRateLimit(access.session.userId, 'leer');
  if (!limite.ok) return tooManyRequests(limite, 'leer');

  try {
    const [settings, guildData] = await Promise.all([
      getGuildSettings(guildId),
      getGuildData(guildId),
    ]);

    return NextResponse.json(
      {
        settings: settings.toObject ? settings.toObject() : settings,
        guildData,
        // `guildData` es null cuando el bot no está en el servidor o está apagado.
        botPresent: Boolean(guildData),
        premium: { tier: premiumTier(settings), limits: premiumLimits(settings) },
      },
      { headers: rateLimitHeaders(limite, 'leer') }
    );
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

  const limite = checkRateLimit(access.session.userId, 'guardar');
  if (!limite.ok) return tooManyRequests(limite, 'guardar');

  // Un cuerpo enorme podría agotar la memoria del servidor.
  const longitud = Number(request.headers.get('content-length') || 0);
  if (longitud > MAX_BODY) {
    return NextResponse.json(
      { error: 'La configuración enviada es demasiado grande.' },
      { status: 413 }
    );
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
    const tier = premiumTier(settings);

    // `logs.events` es un Map: el panel solo envía los eventos tocados en
    // este guardado, y asignarlos tal cual reemplazaría el Map entero.
    const changesConEventos = mergeLogEvents(changes, settings);

    // Los límites del plan se comprueban aquí, no solo en el navegador:
    // de lo contrario bastaría con llamar a la API para saltárselos.
    const validation = validateSettings(changesConEventos, settings, tier);
    if (!validation.ok) {
      return NextResponse.json(
        { error: 'La configuración no es válida.', details: validation.errors },
        { status: 400, headers: rateLimitHeaders(limite, 'guardar') }
      );
    }

    for (const [key, value] of Object.entries(changesConEventos)) {
      settings.set(key, value);
    }

    // `validateSync` aplica las reglas del esquema (rangos, enumerados…).
    const validationError = settings.validateSync();
    if (validationError) {
      const details = Object.values(validationError.errors || {})
        .map((e) => e.message)
        .slice(0, 5);
      return NextResponse.json({ error: 'Hay valores no válidos.', details }, { status: 400 });
    }

    await settings.save();

    // El bot cachea la configuración 60 s: se le avisa para que la recargue ya.
    const notificado = await invalidateGuild(guildId);

    return NextResponse.json(
      {
        ok: true,
        settings: settings.toObject(),
        premium: { tier: premiumTier(settings), limits: premiumLimits(settings) },
        // Si el bot está apagado, el cambio tardará como mucho un minuto en aplicarse.
        applied: notificado,
      },
      { headers: rateLimitHeaders(limite, 'guardar') }
    );
  } catch (error) {
    console.error('Error guardando la configuración:', error.message);
    return NextResponse.json({ error: `No se pudo guardar: ${error.message}` }, { status: 500 });
  }
}

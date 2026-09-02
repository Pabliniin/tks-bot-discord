import { NextResponse } from 'next/server';
import { getGuildSettings, premiumTier, premiumLimits } from '@tkbot/shared';

import { requireGuildAccess, sanitizePayload } from '@/lib/guards';
import { saveGuildSettings } from '@/lib/saveSettings';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rateLimit';
import { getGuildData } from '@/lib/botApi';

export const dynamic = 'force-dynamic';

/** Tamaño máximo del cuerpo de la petición: 512 KB. */
const MAX_BODY = 512 * 1024;

/**
 * Configuración de un servidor.
 *
 *   GET   → devuelve la configuración guardada más los datos en vivo del bot.
 *   PATCH → valida, guarda, anota en el historial y refresca la caché del bot.
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

  try {
    const resultado = await saveGuildSettings({
      guildId,
      changes,
      actor: { userId: access.session.userId, tag: access.session.username },
    });

    if (!resultado.ok) {
      return NextResponse.json(
        { error: resultado.error, details: resultado.details },
        { status: resultado.status, headers: rateLimitHeaders(limite, 'guardar') }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        settings: resultado.settings,
        premium: resultado.premium,
        // Si el bot está apagado, el cambio tardará como mucho un minuto en aplicarse.
        applied: resultado.applied,
      },
      { headers: rateLimitHeaders(limite, 'guardar') }
    );
  } catch (error) {
    console.error('Error guardando la configuración:', error.message);
    return NextResponse.json({ error: `No se pudo guardar: ${error.message}` }, { status: 500 });
  }
}

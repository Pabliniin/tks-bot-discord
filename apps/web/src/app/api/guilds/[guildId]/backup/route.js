import { NextResponse } from 'next/server';
import { getGuildSettings, buildBackup, parseBackup } from '@tkbot/shared';

import { requireGuildAccess, sanitizePayload, EDITABLE_KEYS } from '@/lib/guards';
import { saveGuildSettings } from '@/lib/saveSettings';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

/** Una copia de seguridad completa no debería pasar de aquí. */
const MAX_BODY = 1024 * 1024;

/**
 * Copias de seguridad de la configuración.
 *
 *   GET  ?modo=completa|portable → descarga el archivo.
 *   POST { backup }              → lo aplica al servidor.
 */

export async function GET(request, { params }) {
  const { guildId } = await params;

  const access = await requireGuildAccess(guildId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const limite = checkRateLimit(access.session.userId, 'leer');
  if (!limite.ok) {
    return NextResponse.json({ error: 'Vas demasiado rápido.' }, { status: 429 });
  }

  const modo = request.nextUrl.searchParams.get('modo') === 'portable' ? 'portable' : 'completa';

  try {
    const settings = await getGuildSettings(guildId);

    const copia = buildBackup({
      settings: settings.toObject(),
      editableKeys: EDITABLE_KEYS,
      guildId,
      guildName: access.guild.name,
      modo,
    });

    const fecha = new Date().toISOString().slice(0, 10);
    const nombre = `tkbot-${modo}-${guildId}-${fecha}.json`;

    // Se sirve como descarga para que el navegador no lo abra como texto.
    return new NextResponse(JSON.stringify(copia, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${nombre}"`,
        ...rateLimitHeaders(limite, 'leer'),
      },
    });
  } catch (error) {
    console.error('Error creando la copia de seguridad:', error.message);
    return NextResponse.json({ error: 'No se pudo crear la copia.' }, { status: 500 });
  }
}

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

  if (Number(request.headers.get('content-length') || 0) > MAX_BODY) {
    return NextResponse.json({ error: 'El archivo es demasiado grande.' }, { status: 413 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'El archivo no es un JSON válido.' }, { status: 400 });
  }

  const leida = parseBackup(body?.backup, EDITABLE_KEYS);
  if (!leida.ok) {
    return NextResponse.json({ error: leida.error }, { status: 400 });
  }

  try {
    // Pasa por el mismo filtro que el formulario: una copia manipulada a mano
    // no puede colar ramas que el panel no tiene permitido escribir.
    const resultado = await saveGuildSettings({
      guildId,
      changes: sanitizePayload(leida.settings),
      actor: { userId: access.session.userId, tag: access.session.username },
      origen: 'copia',
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
      meta: leida.meta,
      ignoradas: leida.ignoradas,
      // El panel avisa de que hay que volver a elegir canales y roles.
      requiereRevision: leida.meta.modo === 'portable',
    });
  } catch (error) {
    console.error('Error importando la copia:', error.message);
    return NextResponse.json({ error: `No se pudo importar: ${error.message}` }, { status: 500 });
  }
}

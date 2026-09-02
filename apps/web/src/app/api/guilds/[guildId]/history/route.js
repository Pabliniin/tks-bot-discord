import { NextResponse } from 'next/server';
import { ConfigHistory } from '@tkbot/shared';

import { requireGuildAccess, sanitizePayload } from '@/lib/guards';
import { saveGuildSettings } from '@/lib/saveSettings';
import { checkRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

/** Entradas por página del historial. */
const POR_PAGINA = 20;

/**
 * Historial de cambios del panel.
 *
 *   GET  ?pagina=0        → lista quién cambió qué y cuándo.
 *   POST { id }           → deshace esa entrada, devolviendo los valores previos.
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

  const pagina = Math.max(0, Number(request.nextUrl.searchParams.get('pagina') || 0));

  try {
    const [entradas, total] = await Promise.all([
      ConfigHistory.find({ guildId })
        .sort({ createdAt: -1 })
        .skip(pagina * POR_PAGINA)
        .limit(POR_PAGINA)
        .lean(),
      ConfigHistory.countDocuments({ guildId }),
    ]);

    return NextResponse.json({
      entradas: entradas.map((e) => ({
        id: String(e._id),
        userId: e.userId,
        userTag: e.userTag,
        modules: e.modules,
        summary: e.summary,
        changes: e.changes,
        previous: e.previous,
        revert: e.revert,
        createdAt: e.createdAt,
      })),
      total,
      pagina,
      porPagina: POR_PAGINA,
      hayMas: (pagina + 1) * POR_PAGINA < total,
    });
  } catch (error) {
    console.error('Error leyendo el historial:', error.message);
    return NextResponse.json({ error: 'No se pudo leer el historial.' }, { status: 500 });
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

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Petición no válida.' }, { status: 400 });
  }

  if (!/^[a-f0-9]{24}$/i.test(String(body?.id || ''))) {
    return NextResponse.json({ error: 'Identificador de cambio no válido.' }, { status: 400 });
  }

  try {
    // Se busca acotando por servidor: sin esto, con un id de otro servidor se
    // podría restaurar configuración ajena.
    const entrada = await ConfigHistory.findOne({ _id: body.id, guildId }).lean();
    if (!entrada) {
      return NextResponse.json({ error: 'Ese cambio ya no está en el historial.' }, { status: 404 });
    }

    if (!entrada.previous || Object.keys(entrada.previous).length === 0) {
      return NextResponse.json(
        { error: 'Ese cambio no guardó los valores anteriores, así que no se puede deshacer.' },
        { status: 400 }
      );
    }

    const resultado = await saveGuildSettings({
      guildId,
      changes: sanitizePayload(entrada.previous),
      actor: { userId: access.session.userId, tag: access.session.username },
      revert: true,
      revertOf: entrada._id,
      origen: 'deshacer',
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
      deshecho: { id: String(entrada._id), summary: entrada.summary },
    });
  } catch (error) {
    console.error('Error deshaciendo el cambio:', error.message);
    return NextResponse.json({ error: `No se pudo deshacer: ${error.message}` }, { status: 500 });
  }
}

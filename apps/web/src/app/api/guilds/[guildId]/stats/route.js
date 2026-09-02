import { NextResponse } from 'next/server';
import { GuildStats } from '@tkbot/shared';

import { requireGuildAccess } from '@/lib/guards';
import { checkRateLimit } from '@/lib/rateLimit';
import { getGuildData } from '@/lib/botApi';
import { rangoDeDias, rellenarDias, resumir, canalesMasActivos, RANGOS } from '@/lib/guildStats';

export const dynamic = 'force-dynamic';

/**
 * Estadísticas de un servidor para las gráficas del panel.
 *
 * GET ?dias=7|30|90
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

  const pedidos = Number(request.nextUrl.searchParams.get('dias'));
  const dias = RANGOS.includes(pedidos) ? pedidos : 30;

  try {
    const diasActual = rangoDeDias(dias);

    /*
     * Se piden también los `dias` anteriores para poder comparar. Es una sola
     * consulta sobre el rango completo, no dos: el índice por servidor y fecha
     * la resuelve igual de rápido.
     */
    const diasAnterior = rangoDeDias(dias, new Date(Date.parse(`${diasActual[0]}T00:00:00Z`) - 86_400_000));

    const documentos = await GuildStats.find({
      guildId,
      date: { $gte: diasAnterior[0], $lte: diasActual[diasActual.length - 1] },
    })
      .sort({ date: 1 })
      .lean();

    const setActual = new Set(diasActual);
    const docsActual = documentos.filter((d) => setActual.has(d.date));
    const docsAnterior = documentos.filter((d) => !setActual.has(d.date));

    const serie = rellenarDias(docsActual, diasActual);
    const resumen = resumir(serie, rellenarDias(docsAnterior, diasAnterior));

    // Los canales se enseñan por su nombre, no por su identificador.
    const top = canalesMasActivos(docsActual);
    const guildData = top.length > 0 ? await getGuildData(guildId) : null;
    const nombres = new Map((guildData?.channels || []).map((c) => [c.id, c.name]));

    return NextResponse.json({
      dias,
      serie,
      resumen,
      canales: top.map((c) => ({
        ...c,
        // Un canal borrado sigue teniendo mensajes en el histórico.
        nombre: nombres.get(c.channelId) || 'canal eliminado',
        existe: nombres.has(c.channelId),
      })),
      // Sin datos aún, el panel explica que hay que esperar en vez de pintar
      // una gráfica vacía que parece un error.
      hayDatos: docsActual.length > 0,
    });
  } catch (error) {
    console.error('Error leyendo las estadísticas:', error.message);
    return NextResponse.json({ error: 'No se pudieron leer las estadísticas.' }, { status: 500 });
  }
}

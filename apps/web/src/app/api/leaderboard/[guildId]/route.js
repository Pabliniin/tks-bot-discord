import { NextResponse } from 'next/server';

import { getLeaderboard, CRITERIOS } from '@/lib/leaderboard';
import { checkRateLimit, clientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

/**
 * Clasificación pública de un servidor.
 *
 * GET /api/leaderboard/<servidor>?criterio=xp|messages|voice|invites&limite=50
 *
 * No exige sesión: la idea es precisamente que cualquier miembro pueda mirar
 * su puesto sin iniciar sesión en ningún sitio. Se limita por IP.
 */
export async function GET(request, { params }) {
  const { guildId } = await params;

  if (!/^\d{16,20}$/.test(String(guildId || ''))) {
    return NextResponse.json({ error: 'Identificador de servidor no válido.' }, { status: 400 });
  }

  const limite = checkRateLimit(clientIp(request), 'publico');
  if (!limite.ok) {
    return NextResponse.json(
      { error: `Vas demasiado rápido. Espera ${limite.resetEnSegundos} segundos.` },
      { status: 429, headers: { 'Retry-After': String(limite.resetEnSegundos) } }
    );
  }

  const criterio = request.nextUrl.searchParams.get('criterio') || 'xp';
  const tope = Number(request.nextUrl.searchParams.get('limite')) || 50;

  try {
    const datos = await getLeaderboard(guildId, { criterio, limite: tope });

    if (!datos.disponible) {
      return NextResponse.json({ error: datos.motivo }, { status: 404 });
    }

    return NextResponse.json(
      { ...datos, criterios: CRITERIOS },
      {
        headers: {
          // Un minuto de caché: la clasificación no cambia tan rápido y así se
          // aguanta que entre medio servidor a la vez tras un anuncio.
          'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    console.error('Error leyendo la clasificación:', error.message);
    return NextResponse.json({ error: 'No se pudo leer la clasificación.' }, { status: 500 });
  }
}

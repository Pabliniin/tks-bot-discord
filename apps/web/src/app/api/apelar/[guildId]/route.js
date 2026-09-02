import { NextResponse } from 'next/server';
import { Appeal } from '@tkbot/shared';

import { getSession } from '@/lib/session';
import { buscarSancionApelable, serializarApelacion } from '@/lib/appeals';
import { checkRateLimit, clientIp } from '@/lib/rateLimit';
import { getPublicGuild } from '@/lib/botApi';

export const dynamic = 'force-dynamic';

/** Longitud máxima del texto de una apelación. */
const MAX_TEXTO = 2000;
/** Longitud mínima: una apelación de tres palabras no la revisa nadie. */
const MIN_TEXTO = 30;

/**
 * Apelaciones de un sancionado.
 *
 *   GET  → dice si tiene algo apelable y en qué estado está.
 *   POST → envía la apelación.
 *
 * Exige sesión de Discord: es la única forma de saber quién apela de verdad.
 * Sin ella, cualquiera podría mandar apelaciones en nombre de otro.
 */

export async function GET(request, { params }) {
  const { guildId } = await params;

  if (!/^\d{16,20}$/.test(String(guildId || ''))) {
    return NextResponse.json({ error: 'Servidor no válido.' }, { status: 400 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Necesitas iniciar sesión.' }, { status: 401 });
  }

  try {
    const resultado = await buscarSancionApelable(guildId, session.userId);
    const guild = await getPublicGuild(guildId);

    return NextResponse.json({
      estado: resultado.estado,
      mensaje: resultado.mensaje || null,
      caso: resultado.caso || null,
      apelacion: resultado.apelacion || null,
      instrucciones: resultado.settings?.appeals?.instructions || '',
      guild,
    });
  } catch (error) {
    console.error('Error buscando la sanción:', error.message);
    return NextResponse.json({ error: 'No se pudo consultar tu sanción.' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const { guildId } = await params;

  if (!/^\d{16,20}$/.test(String(guildId || ''))) {
    return NextResponse.json({ error: 'Servidor no válido.' }, { status: 400 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Necesitas iniciar sesión.' }, { status: 401 });
  }

  /*
   * Doble límite: por cuenta y por IP. Alguien decidido a inundar al equipo
   * puede crear cuentas de Discord, pero le cuesta cambiar de IP.
   */
  const porCuenta = checkRateLimit(session.userId, 'apelar');
  const porIp = checkRateLimit(clientIp(request), 'apelar');

  if (!porCuenta.ok || !porIp.ok) {
    const espera = Math.max(porCuenta.resetEnSegundos, porIp.resetEnSegundos);
    return NextResponse.json(
      { error: `Has enviado demasiadas apelaciones. Inténtalo dentro de ${Math.ceil(espera / 60)} minutos.` },
      { status: 429, headers: { 'Retry-After': String(espera) } }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Petición no válida.' }, { status: 400 });
  }

  const texto = String(body?.text ?? '').trim();

  if (texto.length < MIN_TEXTO) {
    return NextResponse.json(
      { error: `Explica tu versión con algo más de detalle (al menos ${MIN_TEXTO} caracteres).` },
      { status: 400 }
    );
  }
  if (texto.length > MAX_TEXTO) {
    return NextResponse.json(
      { error: `La apelación no puede pasar de ${MAX_TEXTO} caracteres.` },
      { status: 400 }
    );
  }

  try {
    // Se vuelve a comprobar en el servidor: que el formulario se enseñara no
    // significa que siga siendo apelable cuando llega el envío.
    const resultado = await buscarSancionApelable(guildId, session.userId);

    if (resultado.estado === 'ya_apelada') {
      return NextResponse.json(
        { error: 'Ya has apelado esta sanción. El equipo la revisará.' },
        { status: 409 }
      );
    }
    if (resultado.estado !== 'apelable') {
      return NextResponse.json({ error: resultado.mensaje }, { status: 400 });
    }

    const apelacion = await Appeal.create({
      guildId,
      caseId: resultado.caso.caseId,
      userId: session.userId,
      userTag: session.username || '',
      text: texto,
    });

    // Aviso al equipo. Si falla, la apelación ya está guardada y aparecerá en
    // el panel igualmente: no tiene sentido devolver un error por esto.
    avisarAlEquipo(guildId, resultado.settings, {
      caseId: resultado.caso.caseId,
      userId: session.userId,
      userTag: session.username,
      texto,
    }).catch((err) => console.error('No se pudo avisar de la apelación:', err.message));

    return NextResponse.json({ ok: true, apelacion: serializarApelacion(apelacion.toObject()) });
  } catch (error) {
    // 11000 = índice único: ya existe una apelación para ese caso.
    if (error.code === 11000) {
      return NextResponse.json({ error: 'Ya has apelado esta sanción.' }, { status: 409 });
    }
    console.error('Error guardando la apelación:', error.message);
    return NextResponse.json({ error: 'No se pudo enviar la apelación.' }, { status: 500 });
  }
}

/** Publica un aviso en el canal que el servidor haya configurado. */
async function avisarAlEquipo(guildId, settings, datos) {
  const canal = settings?.appeals?.channelId;
  if (!canal) return;

  const { request } = await import('@/lib/botApi');
  const site = process.env.NEXT_PUBLIC_SITE_URL || '';

  await request(`/api/guilds/${guildId}/embeds/announce`, {
    method: 'POST',
    body: JSON.stringify({
      channelId: canal,
      embed: {
        title: '📝 Apelación nueva',
        description: datos.texto.slice(0, 1500),
        color: 16427034,
        fields: [
          { name: 'Caso', value: `#${datos.caseId}`, inline: true },
          { name: 'Usuario', value: `<@${datos.userId}>\n\`${datos.userTag}\``, inline: true },
        ],
        footer: site ? { text: 'Revísala en el panel · Moderación → Apelaciones' } : undefined,
      },
    }),
  });
}

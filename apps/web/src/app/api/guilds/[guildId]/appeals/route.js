import { NextResponse } from 'next/server';
import { Appeal, Case, getGuildSettings } from '@tkbot/shared';

import { requireGuildAccess } from '@/lib/guards';
import { checkRateLimit } from '@/lib/rateLimit';
import { resolveMembers, unbanUser, notifyUser } from '@/lib/botApi';
import { TIPOS_APELABLES } from '@/lib/appeals';

export const dynamic = 'force-dynamic';

const POR_PAGINA = 20;
const MAX_NOTA = 1000;

/**
 * Revisión de apelaciones desde el panel.
 *
 *   GET   ?estado=pending → bandeja de entrada del equipo.
 *   PATCH { id, decision, nota, levantarSancion } → resuelve una apelación.
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

  const estado = request.nextUrl.searchParams.get('estado');
  const pagina = Math.max(0, Number(request.nextUrl.searchParams.get('pagina') || 0));

  const filtro = { guildId };
  if (['pending', 'accepted', 'rejected'].includes(estado)) filtro.status = estado;

  try {
    const [apelaciones, total, pendientes] = await Promise.all([
      Appeal.find(filtro).sort({ createdAt: -1 }).skip(pagina * POR_PAGINA).limit(POR_PAGINA).lean(),
      Appeal.countDocuments(filtro),
      Appeal.countDocuments({ guildId, status: 'pending' }),
    ]);

    // Los casos van en una sola consulta, no una por apelación.
    const casos = await Case.find({
      guildId,
      caseId: { $in: apelaciones.map((a) => a.caseId) },
    })
      .select('caseId type reason createdAt moderatorTag moderatorId')
      .lean();

    const porCaso = new Map(casos.map((c) => [c.caseId, c]));
    const usuarios = await resolveMembers(guildId, apelaciones.map((a) => a.userId));

    return NextResponse.json({
      apelaciones: apelaciones.map((a) => {
        const caso = porCaso.get(a.caseId);
        const usuario = usuarios[a.userId];

        return {
          id: String(a._id),
          caseId: a.caseId,
          userId: a.userId,
          userTag: a.userTag,
          nombre: usuario?.name || a.userTag || a.userId,
          avatar: usuario?.avatar || null,
          sigueEnElServidor: usuario?.inGuild ?? null,
          text: a.text,
          status: a.status,
          reviewedByTag: a.reviewedByTag,
          reviewedAt: a.reviewedAt,
          reviewNote: a.reviewNote,
          sanctionLifted: a.sanctionLifted,
          createdAt: a.createdAt,
          caso: caso
            ? {
                caseId: caso.caseId,
                type: caso.type,
                tipoLegible: TIPOS_APELABLES[caso.type] || caso.type,
                reason: caso.reason,
                createdAt: caso.createdAt,
                moderatorTag: caso.moderatorTag,
                moderatorId: caso.moderatorId,
              }
            : null,
        };
      }),
      total,
      pendientes,
      pagina,
      hayMas: (pagina + 1) * POR_PAGINA < total,
    });
  } catch (error) {
    console.error('Error leyendo las apelaciones:', error.message);
    return NextResponse.json({ error: 'No se pudieron leer las apelaciones.' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
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
    return NextResponse.json({ error: 'Apelación no válida.' }, { status: 400 });
  }
  if (!['accepted', 'rejected'].includes(body?.decision)) {
    return NextResponse.json({ error: 'La decisión debe ser aceptar o rechazar.' }, { status: 400 });
  }

  const nota = String(body?.nota || '').trim().slice(0, MAX_NOTA);

  try {
    // Se acota por servidor: sin esto, con el id de una apelación de otro
    // servidor se podría resolver algo ajeno.
    const apelacion = await Appeal.findOne({ _id: body.id, guildId });
    if (!apelacion) {
      return NextResponse.json({ error: 'Esa apelación ya no existe.' }, { status: 404 });
    }
    if (apelacion.status !== 'pending') {
      return NextResponse.json({ error: 'Esa apelación ya estaba resuelta.' }, { status: 409 });
    }

    const aceptada = body.decision === 'accepted';
    let sancionLevantada = false;

    /*
     * Levantar el baneo es opcional: a veces se acepta la apelación pero el
     * equipo prefiere mantener la sanción unos días más, o levantarla a mano.
     */
    if (aceptada && body?.levantarSancion) {
      const caso = await Case.findOne({ guildId, caseId: apelacion.caseId })
        .select('type')
        .lean();

      if (caso?.type === 'ban' || caso?.type === 'softban') {
        try {
          await unbanUser(guildId, apelacion.userId, `Apelación aceptada por ${access.session.username}`);
          sancionLevantada = true;
        } catch (error) {
          // No se aborta: la decisión ya está tomada y debe quedar registrada.
          console.error('No se pudo levantar el baneo:', error.message);
        }
      }
    }

    apelacion.status = body.decision;
    apelacion.reviewedBy = access.session.userId;
    apelacion.reviewedByTag = access.session.username || '';
    apelacion.reviewedAt = new Date();
    apelacion.reviewNote = nota;
    apelacion.sanctionLifted = sancionLevantada;
    await apelacion.save();

    // Avisar al usuario del resultado. Si tiene los privados cerrados lo verá
    // igualmente al volver a la página de apelación.
    const settings = await getGuildSettings(guildId);
    const avisado = await notifyUser(guildId, apelacion.userId, {
      title: aceptada ? '✅ Tu apelación ha sido aceptada' : '❌ Tu apelación ha sido rechazada',
      description: [
        aceptada
          ? 'El equipo ha revisado tu caso y te ha dado la razón.'
          : 'El equipo ha revisado tu caso y ha decidido mantener la sanción.',
        sancionLevantada ? '\nSe ha levantado la sanción: ya puedes volver a entrar.' : '',
        nota ? `\n**Respuesta del equipo:**\n${nota}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      color: aceptada ? 3908957 : 15548997,
    });

    return NextResponse.json({
      ok: true,
      status: apelacion.status,
      sancionLevantada,
      avisado: Boolean(avisado?.ok),
      // El panel enseña por qué no se pudo avisar, si es el caso.
      motivoAviso: avisado?.motivo || null,
      instruccionesActivas: Boolean(settings.appeals?.enabled),
    });
  } catch (error) {
    console.error('Error resolviendo la apelación:', error.message);
    return NextResponse.json({ error: 'No se pudo resolver la apelación.' }, { status: 500 });
  }
}

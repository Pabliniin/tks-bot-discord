import { NextResponse } from 'next/server';
import { Case, Member } from '@tkbot/shared';

import { requireGuildAccess } from '@/lib/guards';
import { checkRateLimit } from '@/lib/rateLimit';
import { resolveMembers } from '@/lib/botApi';

export const dynamic = 'force-dynamic';

const POR_PAGINA = 25;

/** Etiqueta en castellano de cada tipo de sanción. */
const TIPOS = {
  ban: 'Baneo',
  unban: 'Desbaneo',
  softban: 'Softban',
  kick: 'Expulsión',
  vkick: 'Expulsión de voz',
  warn: 'Advertencia',
  timeout: 'Aislamiento',
  untimeout: 'Fin del aislamiento',
  mute: 'Silenciado',
  unmute: 'Sin silencio',
  vmute: 'Silenciado en voz',
  vunmute: 'Sin silencio en voz',
  clear: 'Mensajes borrados',
  points: 'Puntos',
  automod: 'AutoMod',
};

/**
 * Historial de moderación del servidor.
 *
 *   GET   ?usuario=<id>&tipo=<tipo>&pagina=0 → busca casos.
 *   PATCH { caseId, active }                 → retira o repone una advertencia.
 *
 * Poder consultar el historial de alguien sin abrir Discord y rebuscar entre
 * mensajes de log es de lo que más agradece un equipo de moderación grande.
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

  const busqueda = request.nextUrl.searchParams;
  const usuario = String(busqueda.get('usuario') || '').trim();
  const tipo = String(busqueda.get('tipo') || '').trim();
  const pagina = Math.max(0, Number(busqueda.get('pagina') || 0));

  const filtro = { guildId };

  if (usuario) {
    if (/^\d{16,20}$/.test(usuario)) {
      filtro.userId = usuario;
    } else {
      /*
       * Búsqueda por nombre sobre `userTag`, que es el nombre que tenía en el
       * momento de la sanción. Se escapan los caracteres especiales para que
       * escribir un `(` no rompa la expresión regular ni permita inyectar una.
       */
      const escapado = usuario.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filtro.userTag = new RegExp(escapado, 'i');
    }
  }

  if (TIPOS[tipo]) filtro.type = tipo;

  try {
    const [casos, total] = await Promise.all([
      Case.find(filtro).sort({ caseId: -1 }).skip(pagina * POR_PAGINA).limit(POR_PAGINA).lean(),
      Case.countDocuments(filtro),
    ]);

    // Los nombres actuales, en una sola llamada al bot para todos.
    const ids = [...new Set(casos.flatMap((c) => [c.userId, c.moderatorId]))];
    const usuarios = await resolveMembers(guildId, ids);

    /*
     * Resumen del usuario buscado: advertencias activas y total de sanciones.
     * Es lo primero que quiere saber un moderador antes de decidir qué hacer.
     */
    let resumen = null;
    if (usuario && /^\d{16,20}$/.test(usuario)) {
      const [miembro, totalCasos, avisosActivos] = await Promise.all([
        Member.findOne({ guildId, userId: usuario }).select('warnCount points').lean(),
        Case.countDocuments({ guildId, userId: usuario }),
        Case.countDocuments({ guildId, userId: usuario, type: 'warn', active: true }),
      ]);

      resumen = {
        userId: usuario,
        nombre: usuarios[usuario]?.name || null,
        avatar: usuarios[usuario]?.avatar || null,
        sigueEnElServidor: usuarios[usuario]?.inGuild ?? null,
        totalCasos,
        avisosActivos,
        puntos: miembro?.points || 0,
      };
    }

    return NextResponse.json({
      casos: casos.map((c) => ({
        caseId: c.caseId,
        type: c.type,
        tipoLegible: TIPOS[c.type] || c.type,
        userId: c.userId,
        userTag: c.userTag,
        userNombre: usuarios[c.userId]?.name || c.userTag || c.userId,
        userAvatar: usuarios[c.userId]?.avatar || null,
        moderatorId: c.moderatorId,
        moderatorTag: c.moderatorTag,
        moderatorNombre: usuarios[c.moderatorId]?.name || c.moderatorTag || c.moderatorId,
        reason: c.reason,
        duration: c.duration,
        expiresAt: c.expiresAt,
        active: c.active,
        createdAt: c.createdAt,
      })),
      resumen,
      total,
      pagina,
      hayMas: (pagina + 1) * POR_PAGINA < total,
      tipos: TIPOS,
    });
  } catch (error) {
    console.error('Error leyendo el historial de moderación:', error.message);
    return NextResponse.json({ error: 'No se pudo leer el historial.' }, { status: 500 });
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

  const caseId = Number(body?.caseId);
  if (!Number.isInteger(caseId) || caseId < 1) {
    return NextResponse.json({ error: 'Número de caso no válido.' }, { status: 400 });
  }
  if (typeof body?.active !== 'boolean') {
    return NextResponse.json({ error: 'Falta indicar si se retira o se repone.' }, { status: 400 });
  }

  try {
    const caso = await Case.findOne({ guildId, caseId });
    if (!caso) {
      return NextResponse.json({ error: 'Ese caso no existe.' }, { status: 404 });
    }

    /*
     * Solo las advertencias se pueden retirar. Un baneo no se «desactiva»
     * desde aquí: se levanta en Discord, que es otra cosa, y hacerlo desde el
     * historial daría la falsa impresión de que el usuario ya puede volver.
     */
    if (caso.type !== 'warn') {
      return NextResponse.json(
        { error: 'Solo se pueden retirar advertencias. El resto de sanciones se levantan en Discord.' },
        { status: 400 }
      );
    }

    if (caso.active === body.active) {
      return NextResponse.json({ error: 'Esa advertencia ya estaba así.' }, { status: 409 });
    }

    caso.active = body.active;
    await caso.save();

    // El contador rápido del miembro tiene que seguir cuadrando.
    await Member.updateOne(
      { guildId, userId: caso.userId },
      { $inc: { warnCount: body.active ? 1 : -1 } }
    ).catch(() => {});

    return NextResponse.json({ ok: true, caseId, active: caso.active });
  } catch (error) {
    console.error('Error actualizando el caso:', error.message);
    return NextResponse.json({ error: 'No se pudo actualizar el caso.' }, { status: 500 });
  }
}

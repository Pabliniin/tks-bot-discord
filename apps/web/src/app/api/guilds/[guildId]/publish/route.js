import { NextResponse } from 'next/server';

import { requireGuildAccess } from '@/lib/guards';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rateLimit';
import { publishEmbed, publishSelfrolePanel, publishTicketPanel, testWelcome } from '@/lib/botApi';

export const dynamic = 'force-dynamic';

/**
 * Acciones que pide el panel y ejecuta el bot: publicar un embed, un panel de
 * roles o de tickets, y previsualizar la bienvenida.
 *
 * Van limitadas aparte porque cada una consume cuota de la API de Discord.
 */
export async function POST(request, { params }) {
  const { guildId } = await params;

  const access = await requireGuildAccess(guildId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const limite = checkRateLimit(access.session.userId, 'publicar');
  if (!limite.ok) {
    return NextResponse.json(
      {
        error: `Has publicado demasiadas veces seguidas. Espera ${limite.resetEnSegundos} segundos.`,
      },
      {
        status: 429,
        headers: {
          ...rateLimitHeaders(limite, 'publicar'),
          'Retry-After': String(limite.resetEnSegundos),
        },
      }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'El cuerpo de la petición no es JSON válido.' }, { status: 400 });
  }

  const { action, id, type } = body || {};

  // El identificador viene del panel, pero conviene comprobarlo igualmente.
  if (['embed', 'selfrole', 'ticket'].includes(action) && !/^[a-z0-9]{6,32}$/i.test(String(id || ''))) {
    return NextResponse.json({ error: 'Identificador no válido.' }, { status: 400 });
  }

  try {
    let resultado;
    switch (action) {
      case 'embed':
        resultado = await publishEmbed(guildId, id);
        break;
      case 'selfrole':
        resultado = await publishSelfrolePanel(guildId, id);
        break;
      case 'ticket':
        resultado = await publishTicketPanel(guildId, id);
        break;
      case 'welcomeTest':
        // La previsualización se envía al propio usuario que la pide.
        resultado = await testWelcome(guildId, access.session.userId, type);
        break;
      default:
        return NextResponse.json({ error: `Acción desconocida: ${action}` }, { status: 400 });
    }

    return NextResponse.json(resultado, { headers: rateLimitHeaders(limite, 'publicar') });
  } catch (error) {
    // El bot apagado es el caso más frecuente: conviene decirlo con claridad.
    const message =
      error.name === 'AbortError' || error.cause?.code === 'ECONNREFUSED'
        ? 'El bot está desconectado. Enciéndelo e inténtalo de nuevo.'
        : error.message;

    return NextResponse.json({ error: message }, { status: error.status || 502 });
  }
}

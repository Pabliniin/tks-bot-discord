import { NextResponse } from 'next/server';

import { requireGuildAccess } from '@/lib/guards';
import { publishEmbed, publishSelfrolePanel, publishTicketPanel, testWelcome } from '@/lib/botApi';

export const dynamic = 'force-dynamic';

/**
 * Acciones que pide el panel y ejecuta el bot: publicar un embed, un panel de
 * roles o de tickets, y previsualizar la bienvenida.
 */
export async function POST(request, { params }) {
  const { guildId } = await params;

  const access = await requireGuildAccess(guildId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'El cuerpo de la petición no es JSON válido.' }, { status: 400 });
  }

  const { action, id, type } = body || {};

  try {
    switch (action) {
      case 'embed':
        return NextResponse.json(await publishEmbed(guildId, id));
      case 'selfrole':
        return NextResponse.json(await publishSelfrolePanel(guildId, id));
      case 'ticket':
        return NextResponse.json(await publishTicketPanel(guildId, id));
      case 'welcomeTest':
        // La previsualización se envía al propio usuario que la pide.
        return NextResponse.json(await testWelcome(guildId, access.session.userId, type));
      default:
        return NextResponse.json({ error: `Acción desconocida: ${action}` }, { status: 400 });
    }
  } catch (error) {
    // El bot apagado es el caso más frecuente: conviene decirlo con claridad.
    const message =
      error.name === 'AbortError' || error.cause?.code === 'ECONNREFUSED'
        ? 'El bot está desconectado. Enciéndelo e inténtalo de nuevo.'
        : error.message;

    return NextResponse.json({ error: message }, { status: error.status || 502 });
  }
}

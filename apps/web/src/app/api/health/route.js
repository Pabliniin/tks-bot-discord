import { NextResponse } from 'next/server';
import { isConnected } from '@tkbot/shared';

import { isBotOnline } from '@/lib/botApi';

export const dynamic = 'force-dynamic';

/**
 * Estado del panel, para el monitor de Easypanel o cualquier servicio externo.
 *
 * Devuelve 200 mientras la web pueda atender peticiones. La base de datos o el
 * bot pueden estar caídos sin que eso signifique reiniciar la web, así que su
 * estado se informa pero no cambia el código de respuesta.
 */
export async function GET() {
  const [botOnline] = await Promise.all([isBotOnline()]);

  return NextResponse.json({
    ok: true,
    servicio: 'web',
    database: isConnected() ? 'conectada' : 'sin conexion',
    bot: botOnline ? 'en linea' : 'desconectado',
    timestamp: new Date().toISOString(),
  });
}

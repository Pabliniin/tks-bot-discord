import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Trophy, ExternalLink } from 'lucide-react';
import { BRAND } from '@tkbot/shared';

import { getLeaderboard } from '@/lib/leaderboard';
import LeaderboardTable from './LeaderboardTable';

export const dynamic = 'force-dynamic';

/**
 * Clasificación pública de un servidor.
 *
 * Es una página abierta a propósito: cualquier miembro entra a ver su puesto
 * sin iniciar sesión, y de paso conoce el bot. Es el mejor canal de captación
 * que puede tener un bot de Discord, y la competencia directa no lo ofrece.
 */

export async function generateMetadata({ params }) {
  const { guildId } = await params;

  try {
    const datos = await getLeaderboard(guildId, { limite: 1 });
    if (!datos.disponible) return { title: 'Clasificación no disponible' };

    const nombre = datos.guild?.name || 'un servidor';
    return {
      title: `Clasificación de ${nombre}`,
      description: `Mira quién manda en ${nombre}: niveles, mensajes, tiempo en voz e invitaciones.`,
      // Es contenido de un servidor concreto: no interesa que lo indexen.
      robots: { index: false, follow: false },
    };
  } catch {
    return { title: 'Clasificación' };
  }
}

export default async function LeaderboardPage({ params }) {
  const { guildId } = await params;

  if (!/^\d{16,20}$/.test(String(guildId || ''))) notFound();

  /*
   * Se piden los cuatro criterios de una vez. Son consultas indexadas y
   * pequeñas, y así cambiar de pestaña no vuelve al servidor: la página se
   * siente instantánea aunque entre medio servidor tras un anuncio.
   */
  let resultados;
  try {
    resultados = await Promise.all([
      getLeaderboard(guildId, { criterio: 'xp' }),
      getLeaderboard(guildId, { criterio: 'messages' }),
      getLeaderboard(guildId, { criterio: 'voice' }),
      getLeaderboard(guildId, { criterio: 'invites' }),
    ]);
  } catch {
    return (
      <main className="container-page flex min-h-screen flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-bold text-white">No se pudo cargar la clasificación</h1>
        <p className="mt-2 text-ink-300">Inténtalo de nuevo en unos minutos.</p>
      </main>
    );
  }

  const [porXp, porMensajes, porVoz, porInvitaciones] = resultados;

  if (!porXp.disponible) {
    return (
      <main className="container-page flex min-h-screen flex-col items-center justify-center text-center">
        <Trophy size={40} className="mb-4 text-ink-600" />
        <h1 className="text-2xl font-bold text-white">Clasificación no disponible</h1>
        <p className="mt-2 max-w-md text-sm text-ink-300">{porXp.motivo}</p>
        <p className="mt-1 max-w-md text-xs text-ink-400">
          Si administras este servidor, puedes activarla en el módulo de niveles del panel.
        </p>
        <Link href="/" className="btn-secondary mt-6">
          Ir a {BRAND.name}
        </Link>
      </main>
    );
  }

  const guild = porXp.guild;
  const totalMiembros = porXp.puestos.length;

  return (
    <main className="min-h-screen">
      {/* ── Cabecera ─────────────────────────────────────────── */}
      <header className="border-b border-ink-700/60 bg-ink-900/40">
        <div className="container-page py-10 sm:py-14">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            {guild?.icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={guild.icon}
                alt=""
                className="h-16 w-16 shrink-0 rounded-2xl object-cover sm:h-20 sm:w-20"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-ink-700 text-xl font-black sm:h-20 sm:w-20">
                {String(guild?.name || '?').slice(0, 2).toUpperCase()}
              </div>
            )}

            <div className="min-w-0">
              <p className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-400 sm:justify-start">
                <Trophy size={12} />
                Clasificación
              </p>
              <h1 className="mt-1 text-2xl font-black text-white sm:text-4xl">
                {guild?.name || 'Servidor'}
              </h1>

              {porXp.descripcion ? (
                <p className="mt-2 max-w-2xl text-sm text-ink-300">{porXp.descripcion}</p>
              ) : (
                <p className="mt-2 text-sm text-ink-300">
                  {totalMiembros > 0
                    ? `Los ${totalMiembros} miembros más activos del servidor.`
                    : 'Todavía no hay actividad registrada.'}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Tabla ────────────────────────────────────────────── */}
      <div className="container-page py-8">
        <div className="mx-auto max-w-3xl">
          <LeaderboardTable
            datos={{
              xp: porXp.puestos,
              messages: porMensajes.puestos,
              voice: porVoz.puestos,
              invites: porInvitaciones.puestos,
            }}
          />

          {/* La marca, discreta pero presente: esta página la ve mucha gente. */}
          <footer className="mt-10 border-t border-ink-700/60 pt-6 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-ink-400 transition-colors hover:text-white"
            >
              Clasificación con <span className="font-bold text-brand-400">{BRAND.name}</span>
              <ExternalLink size={12} />
            </Link>
            <p className="mt-1.5 text-xs text-ink-500">
              Añade niveles, moderación y registros a tu servidor gratis.
            </p>
          </footer>
        </div>
      </div>
    </main>
  );
}

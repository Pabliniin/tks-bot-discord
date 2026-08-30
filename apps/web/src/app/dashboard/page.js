import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Settings, Plus, AlertTriangle, Crown } from 'lucide-react';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getManageableGuilds } from '@/lib/guards';
import { getBotGuildIds } from '@/lib/botApi';
import { buildInviteUrl, guildIconUrl, accessReason, ACCESS_LABELS } from '@/lib/discord';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Panel de control' };

/** Iniciales del servidor cuando no tiene icono. */
function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

/** Tarjeta de un servidor. */
function GuildCard({ guild, hasBot }) {
  const icon = guildIconUrl(guild, 128);

  return (
    <div className="card group flex flex-col p-5 transition-colors hover:border-brand-500/50">
      <div className="flex items-center gap-3">
        {icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={icon} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink-700 text-sm font-bold text-ink-100">
            {initials(guild.name)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">{guild.name}</p>
          {/* Se indica de dónde viene el acceso: dueño, administrador o gestionar servidor. */}
          <p className="truncate text-xs text-ink-400">
            {ACCESS_LABELS[accessReason(guild)] || 'Sin acceso'}
          </p>
        </div>
      </div>

      <div className="mt-4">
        {hasBot ? (
          <Link href={`/dashboard/${guild.id}`} className="btn-primary w-full">
            <Settings size={15} />
            Configurar
          </Link>
        ) : (
          <a
            href={buildInviteUrl(guild.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary w-full"
          >
            <Plus size={15} />
            Invitar el bot
          </a>
        )}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const { session, guilds, error } = await getManageableGuilds();

  // Sin sesión, al login (y de vuelta aquí al terminar).
  if (!session) redirect('/api/auth/login?redirect=/dashboard');

  const botGuildIds = await getBotGuildIds();

  const withBot = guilds.filter((g) => botGuildIds.has(g.id));
  const withoutBot = guilds.filter((g) => !botGuildIds.has(g.id));

  return (
    <>
      <Navbar />

      <main className="container-page min-h-[70vh] py-14">
        <header className="mb-10">
          <h1 className="text-3xl font-black text-white sm:text-4xl">Tus servidores</h1>
          <p className="mt-2 text-ink-300">
            Elige un servidor para configurar los módulos de TK$ Bot.
          </p>
        </header>

        {error && (
          <div className="mb-8 flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />
            <div className="text-sm text-danger">
              <p>{error}</p>
              <a href="/api/auth/login" className="mt-1 inline-block font-semibold underline">
                Iniciar sesión de nuevo
              </a>
            </div>
          </div>
        )}

        {botGuildIds.size === 0 && !error && (
          <div className="mb-8 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
            <div className="text-sm text-warning">
              <p className="font-semibold">El bot está desconectado.</p>
              <p className="mt-0.5 text-warning/80">
                Enciéndelo con <code className="rounded bg-ink-900 px-1">npm run bot</code> para ver
                en qué servidores está y poder configurarlo.
              </p>
            </div>
          </div>
        )}

        {guilds.length === 0 && !error ? (
          <div className="card px-6 py-16 text-center">
            <Crown size={36} className="mx-auto text-ink-500" />
            <p className="mt-4 font-semibold text-white">No administras ningún servidor</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-300">
              Necesitas el permiso «Gestionar servidor» en al menos un servidor de Discord para
              configurar el bot.
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {withBot.length > 0 && (
              <section>
                <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-ink-300">
                  Con TK$ Bot ({withBot.length})
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {withBot.map((guild) => (
                    <GuildCard key={guild.id} guild={guild} hasBot />
                  ))}
                </div>
              </section>
            )}

            {withoutBot.length > 0 && (
              <section>
                <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-ink-300">
                  Sin TK$ Bot ({withoutBot.length})
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {withoutBot.map((guild) => (
                    <GuildCard key={guild.id} guild={guild} hasBot={false} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <Footer />
    </>
  );
}

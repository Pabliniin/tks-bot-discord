import { redirect } from 'next/navigation';
import { getGuildSettings, premiumTier } from '@tkbot/shared';

import Navbar from '@/components/Navbar';
import Sidebar from '@/components/dashboard/Sidebar';
import { requireGuildAccess } from '@/lib/guards';
import { guildIconUrl } from '@/lib/discord';

export const dynamic = 'force-dynamic';

/**
 * Marco común de la configuración de un servidor.
 * Aquí se comprueba el acceso una sola vez para todas las páginas de módulo.
 */
export default async function GuildLayout({ children, params }) {
  const { guildId } = await params;
  const access = await requireGuildAccess(guildId);

  if (!access.ok) {
    if (access.status === 401) {
      redirect(`/api/auth/login?redirect=/dashboard/${guildId}`);
    }

    return (
      <>
        <Navbar />
        <main className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
          <h1 className="text-2xl font-bold text-white">No puedes acceder a este servidor</h1>
          <p className="mt-2 max-w-md text-ink-300">{access.error}</p>
          <a href="/dashboard" className="btn-primary mt-6">
            Volver a mis servidores
          </a>
        </main>
      </>
    );
  }

  // El nivel premium decide qué módulos se marcan con la corona.
  let tier = 0;
  try {
    const settings = await getGuildSettings(guildId);
    tier = premiumTier(settings);
  } catch {
    // Sin base de datos se asume plan gratuito; la página de módulo ya avisará.
  }

  return (
    <>
      <Navbar />
      <div className="flex">
        <Sidebar
          guildId={guildId}
          guildName={access.guild.name}
          guildIcon={guildIconUrl(access.guild, 128)}
          premiumTier={tier}
        />
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </>
  );
}

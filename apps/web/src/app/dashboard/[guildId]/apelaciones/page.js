import Link from 'next/link';
import { getGuildSettings } from '@tkbot/shared';
import { Settings } from 'lucide-react';

import AppealsInbox from './AppealsInbox';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Apelaciones' };

/**
 * Bandeja de apelaciones del equipo.
 * El acceso ya lo comprueba el layout del servidor.
 */
export default async function AppealsPage({ params }) {
  const { guildId } = await params;

  let activadas = false;
  try {
    const settings = await getGuildSettings(guildId);
    activadas = Boolean(settings.appeals?.enabled);
  } catch {
    // Sin base de datos la bandeja ya avisará al intentar cargar.
  }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white sm:text-3xl">Apelaciones</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-300">
            Quien recibe una sanción puede explicar su versión desde una página web. Aquí las
            revisas y decides, sin salir del panel.
          </p>
        </div>

        <Link href={`/dashboard/${guildId}/appeals`} className="btn-secondary shrink-0 text-sm">
          <Settings size={15} />
          Configurar
        </Link>
      </header>

      <AppealsInbox guildId={guildId} activadas={activadas} />
    </div>
  );
}

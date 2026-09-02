import { getGuildSettings, premiumTier, TEMPLATES } from '@tkbot/shared';

import ToolsPanel from './ToolsPanel';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Herramientas' };

/**
 * Copias de seguridad y plantillas de configuración.
 * El acceso ya lo comprueba el layout del servidor.
 */
export default async function ToolsPage({ params }) {
  const { guildId } = await params;

  let tier = 0;
  try {
    const settings = await getGuildSettings(guildId);
    tier = premiumTier(settings);
  } catch {
    // Sin base de datos se asume plan gratuito; las acciones ya avisarán.
  }

  // Las plantillas llevan la configuración entera, que no hace falta en el
  // navegador: solo viaja lo que se enseña.
  const plantillas = TEMPLATES.map(({ id, nombre, icono, descripcion, destacados, premium }) => ({
    id,
    nombre,
    icono,
    descripcion,
    destacados,
    premium: Boolean(premium),
  }));

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-black text-white sm:text-3xl">Herramientas</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-300">
          Guarda tu configuración, llévatela a otro servidor o empieza desde una plantilla ya
          montada.
        </p>
      </header>

      <ToolsPanel guildId={guildId} plantillas={plantillas} tier={tier} />
    </div>
  );
}

import CaseBrowser from './CaseBrowser';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Moderación' };

/**
 * Historial de moderación del servidor.
 * El acceso ya lo comprueba el layout del servidor.
 */
export default async function ModerationPage({ params }) {
  const { guildId } = await params;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-black text-white sm:text-3xl">Moderación</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-300">
          Consulta el historial de cualquier miembro sin abrir Discord: qué se le ha hecho, quién y
          por qué. También puedes retirar advertencias.
        </p>
      </header>

      <CaseBrowser guildId={guildId} />
    </div>
  );
}

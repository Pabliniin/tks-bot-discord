import HistoryList from './HistoryList';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Historial de cambios' };

/**
 * Historial de cambios del panel.
 * El acceso ya lo comprueba el layout del servidor.
 */
export default async function HistoryPage({ params }) {
  const { guildId } = await params;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-black text-white sm:text-3xl">Historial de cambios</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-300">
          Quién cambió qué y cuándo, con los valores anteriores. Si alguien rompe algo, se deshace
          con un clic. Se conservan los últimos 180 días.
        </p>
      </header>

      <HistoryList guildId={guildId} />
    </div>
  );
}

import StatsCharts from './StatsCharts';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Estadísticas' };

/**
 * Estadísticas del servidor.
 * El acceso ya lo comprueba el layout del servidor.
 */
export default async function StatsPage({ params }) {
  const { guildId } = await params;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-black text-white sm:text-3xl">Estadísticas</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-300">
          Cómo evoluciona tu servidor: cuánta gente entra y se va, dónde se habla y cuánto trabaja
          la moderación.
        </p>
      </header>

      <StatsCharts guildId={guildId} />
    </div>
  );
}

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CommandsBrowser from './CommandsBrowser';
import { getCommands } from '@/lib/botApi';
import { buildInviteUrl } from '@/lib/discord';
// Catálogo estático generado con `npm run gen:commands`.
import catalog from '@tkbot/shared/src/commands.json';

// Se regenera cada 5 minutos para reflejar los comandos que tenga el bot cargados.
export const revalidate = 300;

export const metadata = {
  title: 'Comandos',
  description:
    'Todos los comandos de TK$ Bot con ejemplos de uso: moderación, niveles, información y más.',
};

/**
 * Página pública de comandos.
 *
 * Prefiere la lista en vivo del bot; si está apagado, usa el catálogo estático
 * que genera `npm run gen:commands`.
 */
export default async function CommandsPage() {
  const live = await getCommands();

  // La lista en vivo no trae ejemplos ni subcomandos: se completa con el catálogo.
  const commands = (live && live.length > 0 ? live : catalog).map((command) => {
    const stored = catalog.find((c) => c.name === command.name);
    return { ...stored, ...command, subcommands: stored?.subcommands || [] };
  });

  const botName = process.env.NEXT_PUBLIC_BOT_NAME || 'TK$ Bot';

  return (
    <>
      <Navbar />

      <main className="container-page min-h-[70vh] py-16">
        <header className="mx-auto mb-10 max-w-2xl text-center">
          <h1 className="text-3xl font-black text-white sm:text-5xl">Comandos de {botName}</h1>
          <p className="mt-4 text-ink-300">
            ¿Eres nuevo en {botName} y quieres conocer todos los comandos y su uso? ¡Has llegado al
            lugar correcto!
          </p>
          <p className="mt-3 text-sm text-ink-400">
            Todos los comandos funcionan con el prefijo <code className="rounded bg-ink-800 px-1.5 py-0.5 text-brand-300">-</code>{' '}
            y también como comandos de barra escribiendo{' '}
            <code className="rounded bg-ink-800 px-1.5 py-0.5 text-brand-300">/</code>.
          </p>
        </header>

        <CommandsBrowser commands={commands} prefix="-" />

        <div className="mt-16 text-center">
          <a
            href={buildInviteUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary px-7 py-3"
          >
            Añadir a Discord
          </a>
        </div>
      </main>

      <Footer />
    </>
  );
}

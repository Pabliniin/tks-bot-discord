import { notFound } from 'next/navigation';
import { Scale } from 'lucide-react';
import { BRAND } from '@tkbot/shared';

import { getSession } from '@/lib/session';
import { buscarSancionApelable } from '@/lib/appeals';
import { getPublicGuild } from '@/lib/botApi';
import AppealForm from './AppealForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Apelar una sanción',
  // Es una página personal de alguien sancionado: no debe salir en buscadores.
  robots: { index: false, follow: false },
};

/**
 * Página pública para apelar una sanción.
 *
 * Exige iniciar sesión con Discord: es la única manera de saber quién apela de
 * verdad. Sin ello cualquiera podría mandar apelaciones haciéndose pasar por
 * otro, y el equipo no podría fiarse de nada de lo que lea aquí.
 */
export default async function AppealPage({ params }) {
  const { guildId } = await params;

  if (!/^\d{16,20}$/.test(String(guildId || ''))) notFound();

  const session = await getSession();
  const guild = await getPublicGuild(guildId);
  const nombreServidor = guild?.name || 'el servidor';

  const cabecera = (
    <header className="mb-8 text-center">
      {guild?.icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={guild.icon}
          alt=""
          className="mx-auto mb-4 h-16 w-16 rounded-2xl object-cover"
        />
      ) : (
        <Scale size={36} className="mx-auto mb-4 text-brand-400" />
      )}
      <h1 className="text-2xl font-black text-white sm:text-3xl">Apelar una sanción</h1>
      <p className="mt-2 text-sm text-ink-300">
        en <strong className="text-white">{nombreServidor}</strong>
      </p>
    </header>
  );

  // ── Sin sesión ─────────────────────────────────────────────
  if (!session) {
    return (
      <main className="container-page flex min-h-screen items-center justify-center py-12">
        <div className="w-full max-w-lg">
          {cabecera}

          <div className="card p-6 text-center">
            <p className="text-sm text-ink-200">
              Para apelar tienes que identificarte con tu cuenta de Discord. Así el equipo del
              servidor sabe que la apelación es tuya de verdad.
            </p>
            <a
              href={`/api/auth/login?redirect=/apelar/${guildId}`}
              className="btn-primary mt-5 w-full"
            >
              Entrar con Discord
            </a>
            <p className="help mt-3">
              Solo se usa para saber quién eres. No hace falta que estés en el servidor.
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-ink-500">
            Apelaciones gestionadas con {BRAND.name}
          </p>
        </div>
      </main>
    );
  }

  // ── Con sesión ─────────────────────────────────────────────
  let resultado;
  try {
    resultado = await buscarSancionApelable(guildId, session.userId);
  } catch {
    return (
      <main className="container-page flex min-h-screen items-center justify-center py-12">
        <div className="w-full max-w-lg text-center">
          {cabecera}
          <p className="text-sm text-ink-300">
            No se pudo consultar tu sanción ahora mismo. Inténtalo en unos minutos.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="container-page py-12">
      <div className="mx-auto w-full max-w-lg">
        {cabecera}

        <AppealForm
          guildId={guildId}
          inicial={{
            estado: resultado.estado,
            mensaje: resultado.mensaje || null,
            caso: resultado.caso || null,
            apelacion: resultado.apelacion || null,
            instrucciones: resultado.settings?.appeals?.instructions || '',
          }}
        />

        <p className="mt-8 text-center text-xs text-ink-500">
          Apelaciones gestionadas con {BRAND.name}
        </p>
      </div>
    </main>
  );
}

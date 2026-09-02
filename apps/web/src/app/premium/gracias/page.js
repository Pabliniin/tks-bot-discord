import Link from 'next/link';
import { CircleCheck, Crown, ArrowRight } from 'lucide-react';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getSession } from '@/lib/session';
import { getUserPremium } from '@/lib/premiumData';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Gracias por tu compra',
  // Es una página de confirmación personal: no pinta nada en un buscador.
  robots: { index: false, follow: false },
};

/**
 * Confirmación tras completar el pago.
 *
 * El premium lo activa el webhook, no esta página: si alguien cerrara el
 * navegador antes de llegar aquí, la suscripción se activaría igual. Por eso
 * la página no escribe nada, solo enseña el estado y explica el siguiente paso.
 *
 * Puede que el webhook aún no haya llegado cuando el usuario aterriza (tarda
 * uno o dos segundos), así que se contempla ese caso en vez de decir que algo
 * ha fallado.
 */
export default async function GraciasPage() {
  const session = await getSession();
  const premium = session ? await getUserPremium(session.userId) : null;

  const yaActivo = Boolean(premium?.active);

  return (
    <>
      <Navbar />

      <main className="container-page flex min-h-[70vh] items-center justify-center py-16">
        <div className="w-full max-w-lg text-center">
          <CircleCheck size={48} className="mx-auto mb-5 text-success" />

          <h1 className="text-3xl font-black text-white sm:text-4xl">¡Gracias por tu compra!</h1>

          {yaActivo ? (
            <>
              <p className="mt-3 text-ink-300">
                Tu <strong className="text-white">{premium.name}</strong> ya está activo.
              </p>

              <div className="card mt-8 p-6 text-left">
                <p className="flex items-center gap-2 font-bold text-white">
                  <Crown size={16} className="text-warning" />
                  Ahora, actívalo en tu servidor
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink-300">
                  Comprar el plan te da derecho a activarlo en{' '}
                  <strong className="text-white">{premium.maxGuilds}</strong>{' '}
                  {premium.maxGuilds === 1 ? 'servidor' : 'servidores'}. Elige en cuál desde tu
                  panel, o con el comando{' '}
                  <code className="rounded bg-ink-900 px-1.5 py-0.5 text-brand-300">
                    /premiumuser apply
                  </code>{' '}
                  en Discord.
                </p>

                <Link href="/dashboard" className="btn-primary mt-5 w-full">
                  Ir a mis servidores <ArrowRight size={15} />
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 text-ink-300">
                El pago se ha completado. Estamos activando tu plan.
              </p>

              <div className="card mt-8 p-6 text-left text-sm leading-relaxed text-ink-300">
                <p>
                  La activación tarda unos segundos. Si al recargar esta página sigue sin aparecer
                  tu plan, espera un minuto y vuelve a intentarlo: el cobro ya está hecho y el
                  premium se activará solo.
                </p>
                <p className="mt-3">
                  Si pasados cinco minutos sigue sin activarse, escríbenos con el correo con el que
                  pagaste y lo revisamos.
                </p>

                <Link href="/premium" className="btn-secondary mt-5 w-full">
                  Volver a Premium
                </Link>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}

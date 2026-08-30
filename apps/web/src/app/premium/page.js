import Link from 'next/link';
import { Check, X, Crown } from 'lucide-react';
import { PREMIUM_TIERS } from '@tkbot/shared';

import Navbar from '@/components/Navbar';
import PremiumStatusCard from '@/components/PremiumStatusCard';
import { getSession } from '@/lib/session';
import { getUserPremium } from '@/lib/premiumData';
import Footer from '@/components/Footer';

// Lee la sesion del usuario, asi que no se puede prerenderizar.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Premium',
  description: 'Desbloquea Anti-Raid, Protección VIP, más embeds, más paneles y bot personalizado.',
};

/** Comparativa de funciones entre los tres planes. */
const FEATURES = [
  { label: 'Todos los módulos básicos', free: true, tier1: true, tier2: true },
  { label: 'Bienvenidas con imagen', free: true, tier1: true, tier2: true },
  { label: 'Sistema de niveles y tarjetas', free: true, tier1: true, tier2: true },
  { label: 'AutoMod con 11 filtros', free: true, tier1: true, tier2: true },
  { label: 'Tickets con formularios', free: true, tier1: true, tier2: true },
  { label: 'Anti-Raid', free: false, tier1: true, tier2: true },
  { label: 'Protección VIP (anti-nuke)', free: false, tier1: true, tier2: true },
  { label: 'Soporte prioritario', free: false, tier1: true, tier2: true },
  { label: 'Bot personalizado (nombre y avatar propios)', free: false, tier1: false, tier2: true },
];

const LIMITS = [
  { label: 'Embeds guardados', key: 'maxEmbeds' },
  { label: 'Respuestas automáticas', key: 'maxAutoresponders' },
  { label: 'Paneles de roles', key: 'maxSelfroles' },
  { label: 'Paneles de tickets', key: 'maxTicketPanels' },
];

const PLANS = [
  { id: 0, price: 'Gratis', period: 'para siempre', highlight: false },
  { id: 1, price: '4,99 €', period: 'al mes', highlight: true },
  { id: 2, price: '9,99 €', period: 'al mes', highlight: false },
];

function Mark({ value }) {
  return value ? (
    <Check size={17} className="mx-auto text-success" aria-label="Incluido" />
  ) : (
    <X size={17} className="mx-auto text-ink-500" aria-label="No incluido" />
  );
}

export default async function PremiumPage() {
  const session = await getSession();
  const userPremium = session ? await getUserPremium(session.userId) : null;

  const botName = process.env.NEXT_PUBLIC_BOT_NAME || 'TK$ Bot';

  return (
    <>
      <Navbar />

      <main className="container-page min-h-[70vh] py-16">
        <header className="mx-auto mb-14 max-w-2xl text-center">
          <span className="badge bg-warning/15 text-warning">
            <Crown size={13} /> Membresía
          </span>
          <h1 className="mt-4 text-3xl font-black text-white sm:text-5xl">{botName} Premium</h1>
          <p className="mt-4 text-ink-300">
            Desbloquea la protección avanzada y amplía todos los límites de tu servidor.
          </p>
        </header>

        <PremiumStatusCard
          status={session ? userPremium : null}
          username={session?.username || ''}
        />

        {/* Planes */}
        <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-3">
          {PLANS.map((plan) => {
            const tier = PREMIUM_TIERS[plan.id];

            return (
              <div
                key={plan.id}
                className={`card relative flex flex-col p-6 ${
                  plan.highlight ? 'border-brand-500 ring-1 ring-brand-500' : ''
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                    Más popular
                  </span>
                )}

                <h2 className="text-lg font-bold text-white">{tier.name}</h2>

                <p className="mt-3">
                  <span className="text-3xl font-black text-white">{plan.price}</span>
                  <span className="ml-1.5 text-sm text-ink-400">{plan.period}</span>
                </p>

                <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                  {LIMITS.map((limit) => (
                    <li key={limit.key} className="flex items-center justify-between text-ink-200">
                      <span>{limit.label}</span>
                      <strong className="text-white">{tier[limit.key]}</strong>
                    </li>
                  ))}
                  <li className="flex items-center justify-between text-ink-200">
                    <span>Anti-Raid</span>
                    <Mark value={tier.antiraid} />
                  </li>
                  <li className="flex items-center justify-between text-ink-200">
                    <span>Bot personalizado</span>
                    <Mark value={tier.customBot} />
                  </li>
                </ul>

                <Link
                  href="/dashboard"
                  className={`mt-6 w-full ${plan.highlight ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {plan.id === 0 ? 'Empezar gratis' : 'Elegir plan'}
                </Link>
              </div>
            );
          })}
        </div>

        {/* Comparativa */}
        <section className="mx-auto mt-16 max-w-4xl">
          <h2 className="mb-6 text-center text-2xl font-bold text-white">Comparativa completa</h2>

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-ink-700">
                  <th className="px-5 py-3.5 text-left font-semibold text-ink-200">Función</th>
                  <th className="px-4 py-3.5 text-center font-semibold text-ink-200">Gratis</th>
                  <th className="px-4 py-3.5 text-center font-semibold text-brand-300">Premium 1</th>
                  <th className="px-4 py-3.5 text-center font-semibold text-warning">Premium 2</th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((feature) => (
                  <tr key={feature.label} className="border-b border-ink-700/50 last:border-0">
                    <td className="px-5 py-3 text-ink-100">{feature.label}</td>
                    <td className="px-4 py-3">
                      <Mark value={feature.free} />
                    </td>
                    <td className="px-4 py-3">
                      <Mark value={feature.tier1} />
                    </td>
                    <td className="px-4 py-3">
                      <Mark value={feature.tier2} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 rounded-lg border border-ink-700 bg-ink-800/50 p-4 text-sm leading-relaxed text-ink-300">
            <p>
              <strong className="text-ink-100">Nota para el administrador:</strong> los precios son
              un ejemplo y todavía no hay pasarela de pago conectada. Mientras tanto, el premium se
              reparte desde Discord con estos comandos:
            </p>
            <ul className="mt-3 space-y-1.5">
              <li>
                <code className="rounded bg-ink-900 px-1.5 py-0.5 text-brand-300">
                  /premium add
                </code>{' '}
                — activa un plan directamente en un servidor
              </li>
              <li>
                <code className="rounded bg-ink-900 px-1.5 py-0.5 text-brand-300">
                  /premiumuser add
                </code>{' '}
                — da premium a una persona, que luego lo activa donde quiera
              </li>
              <li>
                <code className="rounded bg-ink-900 px-1.5 py-0.5 text-brand-300">/staff add</code>{' '}
                — decide quién puede repartir premium
              </li>
            </ul>
            <p className="mt-3">
              Cuando quieras cobrar de verdad, integra Stripe o PayPal aquí y haz que al completarse
              el pago se ejecute lo mismo que hace{' '}
              <code className="rounded bg-ink-900 px-1">/premiumuser add</code>.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

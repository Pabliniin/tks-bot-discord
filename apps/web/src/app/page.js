import Link from 'next/link';
import { ArrowRight, Sparkles, ShieldCheck, Zap } from 'lucide-react';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { WelcomeMockup, EmbedMockup, SelfRolesMockup, LevelsMockup } from '@/components/mockups';
import { buildInviteUrl } from '@/lib/discord';
import { getStats } from '@/lib/botApi';

// La portada muestra estadísticas en vivo, así que se recalcula cada minuto.
export const revalidate = 60;

const FEATURES = [
  {
    eyebrow: 'MENSAJES DE BIENVENIDA',
    title: 'Demos la bienvenida a los nuevos miembros con estilo',
    description:
      '¡Crea tus propias imágenes de bienvenida, que incluyan el nombre de usuario y el avatar del usuario, así como una imagen de fondo personalizable!',
    link: { href: '/docs#bienvenida', label: 'Aprende más sobre Bienvenidas y Despedidas' },
    Mockup: WelcomeMockup,
  },
  {
    eyebrow: 'MENSAJES EMBED',
    title: '¡Crea fácilmente embeds para tu servidor!',
    description:
      'Ilustra tu creatividad en los embeds utilizando la personalización sencilla de TK$ Bot y enviándolo al canal de tu preferencia.',
    link: { href: '/docs#embeds', label: 'Aprende más sobre Mensajes Embed' },
    Mockup: EmbedMockup,
    reverse: true,
  },
  {
    eyebrow: 'ROLES ASIGNABLES',
    title: '¡Reacciona a los mensajes y obtén roles!',
    description:
      'Configura roles exclusivos basados en reacciones, botones, menús selectos, y permite que tus miembros obtengan los roles que merecen con un solo clic.',
    link: { href: '/docs#roles', label: 'Aprende más sobre Roles Asignables' },
    Mockup: SelfRolesMockup,
  },
  {
    eyebrow: 'SISTEMA DE NIVELES',
    title: 'Recompensa a tus miembros más activos y comprometidos',
    description:
      'Recompensa a los miembros activos con roles de nivel especial, permisos privilegiados y canales a medida que alcanzan cierto nivel.',
    link: { href: '/docs#niveles', label: 'Aprende más sobre el Sistema de Niveles' },
    Mockup: LevelsMockup,
    reverse: true,
  },
];

const HIGHLIGHTS = [
  {
    Icon: ShieldCheck,
    title: 'Protección real',
    text: 'AutoMod con 11 filtros, Anti-Raid y Protección VIP contra cuentas comprometidas.',
  },
  {
    Icon: Sparkles,
    title: 'Todo personalizable',
    text: '18 módulos configurables desde el panel, sin tocar una sola línea de código.',
  },
  {
    Icon: Zap,
    title: 'Comandos híbridos',
    text: 'Cada comando funciona con barra (/) y con prefijo. Usa el que prefieras.',
  },
];

/** Formatea los números grandes al estilo español (10.200.000). */
function formatCount(value) {
  return new Intl.NumberFormat('es-ES').format(value || 0);
}

export default async function HomePage() {
  const stats = await getStats();
  const inviteUrl = buildInviteUrl();
  const botName = process.env.NEXT_PUBLIC_BOT_NAME || 'TK$ Bot';

  return (
    <>
      <Navbar />

      <main>
        {/* ── Portada ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          {/* Rejilla y resplandor de fondo. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-grid-dark bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]"
          />
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-[-14rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-brand-500/25 blur-[130px]"
          />

          <div className="container-page relative py-24 text-center sm:py-32">
            <Link
              href="/premium"
              className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-brand-500/40 bg-brand-500/10 px-4 py-1.5 text-xs font-semibold text-brand-200 transition-colors hover:bg-brand-500/20"
            >
              <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-bold text-white">
                NUEVO
              </span>
              Sistema de tickets con formularios
              <ArrowRight size={13} />
            </Link>

            <h1 className="mx-auto mt-7 max-w-4xl animate-fade-up text-4xl font-black leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl">
              <span className="text-gradient">¡Crea un servidor</span>
              <br />
              <span className="text-gradient">profesional de Discord!</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl animate-fade-up text-base leading-relaxed text-ink-200 sm:text-lg">
              Un bot multipropósito muy personalizable para imagen de bienvenida, registros en
              profundidad, comandos sociales, moderación y muchos más ...
            </p>

            <div className="mt-9 flex animate-fade-up flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={inviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary w-full px-7 py-3 text-base sm:w-auto"
              >
                Añadir a Discord
              </a>
              <a href="#caracteristicas" className="btn-secondary w-full px-7 py-3 text-base sm:w-auto">
                Examinar Características
              </a>
            </div>

            {/* Cifras en vivo tomadas del propio bot. */}
            <dl className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: 'Servidores', value: formatCount(stats.guilds) },
                { label: 'Usuarios', value: formatCount(stats.users) },
                { label: 'Comandos', value: formatCount(stats.commands) },
                { label: 'Módulos', value: '15' },
              ].map((stat) => (
                <div key={stat.label} className="card px-4 py-5">
                  <dd className="text-2xl font-black text-white sm:text-3xl">{stat.value}</dd>
                  <dt className="mt-1 text-xs font-medium uppercase tracking-wider text-ink-300">
                    {stat.label}
                  </dt>
                </div>
              ))}
            </dl>

            {stats.offline && (
              <p className="mt-4 text-xs text-ink-400">
                El bot está desconectado ahora mismo: las cifras se actualizarán al encenderlo.
              </p>
            )}
          </div>
        </section>

        {/* ── Puntos fuertes ──────────────────────────────────── */}
        <section className="container-page pb-8">
          <div className="grid gap-4 md:grid-cols-3">
            {HIGHLIGHTS.map(({ Icon, title, text }) => (
              <div key={title} className="card p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-500/15 text-brand-300">
                  <Icon size={22} />
                </div>
                <h3 className="mt-4 text-base font-bold text-white">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-300">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Características ─────────────────────────────────── */}
        <section id="caracteristicas" className="container-page space-y-24 py-24 sm:space-y-32">
          {FEATURES.map((feature) => (
            <div
              key={feature.eyebrow}
              className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
            >
              <div className={feature.reverse ? 'lg:order-2' : ''}>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-400">
                  {feature.eyebrow}
                </p>
                <h2 className="mt-3 text-2xl font-black leading-tight text-white sm:text-3xl lg:text-4xl">
                  {feature.title}
                </h2>
                <p className="mt-4 text-base leading-relaxed text-ink-200">{feature.description}</p>
                <Link
                  href={feature.link.href}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-400 transition-colors hover:text-brand-300"
                >
                  {feature.link.label}
                  <ArrowRight size={15} />
                </Link>
              </div>

              <div className={feature.reverse ? 'lg:order-1' : ''}>
                <feature.Mockup />
              </div>
            </div>
          ))}
        </section>

        {/* ── Llamada a la acción ─────────────────────────────── */}
        <section className="relative overflow-hidden border-t border-ink-800">
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 h-[26rem] w-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600/20 blur-[120px]"
          />
          <div className="container-page relative py-24 text-center">
            <h2 className="text-3xl font-black text-white sm:text-4xl lg:text-5xl">
              Deja que {botName} se encargue de tu servidor
            </h2>
            <p className="mt-4 text-lg text-ink-200">
              {stats.guilds > 0
                ? `Únete a ${formatCount(stats.guilds)} servidores que ya usan ${botName}`
                : `Empieza a construir tu comunidad con ${botName}`}
            </p>
            <a
              href={inviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary mt-8 px-8 py-3 text-base"
            >
              Añadir a Discord
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

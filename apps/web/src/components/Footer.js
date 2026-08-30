import Link from 'next/link';
import Logo from './Logo';

const SITE_LINKS = [
  { href: '/premium', label: 'Membresía', badge: 'NUEVO' },
  { href: '/dashboard', label: 'Panel de control' },
  { href: '/docs', label: 'Documentación' },
  { href: '/premium', label: 'Premium' },
  { href: '/commands', label: 'Comandos' },
];

const LEGAL_LINKS = [
  { href: '/legal/rules', label: 'Reglas' },
  { href: '/legal/terms', label: 'Términos y condiciones de uso' },
  { href: '/legal/privacy', label: 'Política de privacidad' },
  { href: '/legal/refund', label: 'Política de reembolso' },
];

export default function Footer() {
  const botName = process.env.NEXT_PUBLIC_BOT_NAME || 'TK$ Bot';
  const year = new Date().getFullYear();

  // Los enlaces externos solo se muestran si están configurados en el .env.
  const external = [
    { href: process.env.NEXT_PUBLIC_TWITTER_URL, label: 'Twitter' },
    { href: process.env.NEXT_PUBLIC_SUPPORT_INVITE, label: 'Discord' },
    { href: process.env.NEXT_PUBLIC_TOPGG_URL, label: 'Top.gg' },
  ].filter((link) => link.href && link.href !== 'https://discord.gg/' && link.href.length > 12);

  return (
    <footer className="border-t border-ink-800 bg-ink-950">
      <div className="container-page py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <Logo size={36} />
              <span className="text-lg font-extrabold text-white">{botName}</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-300">
              Un bot multipropósito muy personalizable para imagen de bienvenida, registros en
              profundidad, comandos sociales, moderación y muchos más ...
            </p>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Páginas del Sitio Web
            </h3>
            <ul className="mt-4 space-y-2.5">
              {SITE_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="inline-flex items-center gap-2 text-sm text-ink-300 transition-colors hover:text-white"
                  >
                    {link.label}
                    {link.badge && (
                      <span className="rounded bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {link.badge}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Otros Enlaces</h3>
            <ul className="mt-4 space-y-2.5">
              {external.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-ink-300 transition-colors hover:text-white"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-ink-300 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-ink-800 pt-6">
          <p className="text-sm text-ink-400">
            © {year} {botName}. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}

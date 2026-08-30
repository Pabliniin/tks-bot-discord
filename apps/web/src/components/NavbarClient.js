'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronDown, LogOut, LayoutDashboard } from 'lucide-react';

import Logo from './Logo';

const LINKS = [
  { href: '/dashboard', label: 'Panel de control' },
  { href: '/docs', label: 'Documentación' },
  { href: '/premium', label: 'Premium', badge: 'NUEVO' },
  { href: '/commands', label: 'Comandos' },
];

/**
 * Barra de navegación.
 * Recibe la sesión ya resuelta desde el servidor para no parpadear al cargar.
 */
export default function NavbarClient({ user, inviteUrl, botName }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // La barra se vuelve opaca al bajar, para que el texto siga legible.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Cierra el menú de usuario al pulsar fuera o con Escape.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      setMenuOpen(false);
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', close);
    };
  }, [menuOpen]);

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-200 ${
        scrolled ? 'border-b border-ink-700/60 bg-ink-950/85 backdrop-blur-lg' : 'bg-transparent'
      }`}
    >
      <nav className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Logo size={34} />
          <span className="text-lg font-extrabold tracking-tight text-white">{botName}</span>
        </Link>

        {/* Escritorio */}
        <div className="hidden items-center gap-1 lg:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="relative rounded-lg px-3 py-2 text-sm font-medium text-ink-200 transition-colors hover:bg-ink-800 hover:text-white"
            >
              {link.label}
              {link.badge && (
                <span className="ml-1.5 rounded bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {link.badge}
                </span>
              )}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <a href={inviteUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
            Añadir a Discord
          </a>

          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setMenuOpen((open) => !open);
                }}
                className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-800 px-2.5 py-1.5 text-sm font-medium text-ink-100 transition-colors hover:bg-ink-700"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={user.avatar} alt="" className="h-6 w-6 rounded-full" />
                <span className="max-w-[8rem] truncate">{user.username}</span>
                <ChevronDown size={14} className={menuOpen ? 'rotate-180 transition' : 'transition'} />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-52 overflow-hidden rounded-lg border border-ink-700 bg-ink-800 shadow-2xl"
                >
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-ink-100 hover:bg-ink-700"
                  >
                    <LayoutDashboard size={15} />
                    Mis servidores
                  </Link>
                  <a
                    href="/api/auth/logout"
                    className="flex items-center gap-2 border-t border-ink-700 px-4 py-2.5 text-sm text-danger hover:bg-ink-700"
                  >
                    <LogOut size={15} />
                    Cerrar sesión
                  </a>
                </div>
              )}
            </div>
          ) : (
            <a href="/api/auth/login" className="btn-secondary">
              Iniciar sesión
            </a>
          )}
        </div>

        {/* Móvil */}
        <button
          type="button"
          className="rounded-lg p-2 text-ink-200 hover:bg-ink-800 lg:hidden"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {mobileOpen && (
        <div className="border-t border-ink-700 bg-ink-900 lg:hidden">
          <div className="container-page space-y-1 py-4">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-ink-100 hover:bg-ink-800"
              >
                {link.label}
                {link.badge && (
                  <span className="ml-2 rounded bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {link.badge}
                  </span>
                )}
              </Link>
            ))}

            <div className="space-y-2 pt-3">
              <a
                href={inviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary w-full"
              >
                Añadir a Discord
              </a>
              {user ? (
                <a href="/api/auth/logout" className="btn-secondary w-full">
                  Cerrar sesión
                </a>
              ) : (
                <a href="/api/auth/login" className="btn-secondary w-full">
                  Iniciar sesión
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

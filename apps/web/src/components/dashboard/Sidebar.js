'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft,
  Menu,
  X,
  Settings,
  Crown,
  ChartNoAxesColumn,
  History,
  Wrench,
  Scale,
  Shield,
} from 'lucide-react';
// JSON de constantes: sin mongoose y compatible con los componentes de cliente.
// Se importa por defecto y se desestructura: webpack no admite imports con
// nombre sobre las claves de un JSON.
import constants from '@tkbot/shared/src/constants.json';

const { MODULES, MODULE_GROUPS } = constants;

/**
 * Secciones de gestión, que no son módulos de configuración.
 *
 * Son las cuatro cosas que la competencia no tiene, así que conviene que se
 * vean nada más entrar y no escondidas al final de la lista.
 */
const EXTRAS = [
  { href: 'estadisticas', label: 'Estadísticas', Icon: ChartNoAxesColumn },
  { href: 'moderacion', label: 'Moderación', Icon: Shield },
  { href: 'apelaciones', label: 'Apelaciones', Icon: Scale },
  { href: 'historial', label: 'Historial', Icon: History },
  { href: 'herramientas', label: 'Herramientas', Icon: Wrench },
];

/**
 * Barra lateral del panel con los 15 módulos agrupados.
 * En móvil se convierte en un panel deslizante.
 */
export default function Sidebar({ guildId, guildName, guildIcon, premiumTier }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const base = `/dashboard/${guildId}`;

  /** Módulos ordenados por grupo, respetando el orden de `MODULE_GROUPS`. */
  const grouped = Object.entries(MODULE_GROUPS).map(([groupId, group]) => ({
    id: groupId,
    label: group.es,
    modules: MODULES.filter((m) => m.group === groupId),
  }));

  const isActive = (href) => pathname === href;

  const content = (
    <nav className="flex h-full flex-col">
      <div className="border-b border-ink-700/60 p-4">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-ink-300 transition-colors hover:text-white"
        >
          <ArrowLeft size={13} />
          Todos los servidores
        </Link>

        <div className="flex items-center gap-3">
          {guildIcon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={guildIcon} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-700 text-xs font-bold">
              {String(guildName || '?').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{guildName}</p>
            {premiumTier > 0 ? (
              <p className="flex items-center gap-1 text-[11px] font-semibold text-warning">
                <Crown size={10} /> Premium {premiumTier}
              </p>
            ) : (
              <p className="text-[11px] text-ink-400">Plan gratuito</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <Link
          href={base}
          onClick={() => setOpen(false)}
          className={`mb-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            isActive(base) ? 'bg-brand-500 text-white' : 'text-ink-200 hover:bg-ink-700 hover:text-white'
          }`}
        >
          <span className="w-5 text-center">📊</span>
          Resumen
        </Link>

        <Link
          href={`${base}/general`}
          onClick={() => setOpen(false)}
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            isActive(`${base}/general`)
              ? 'bg-brand-500 text-white'
              : 'text-ink-200 hover:bg-ink-700 hover:text-white'
          }`}
        >
          <Settings size={16} className="w-5" />
          Ajustes generales
        </Link>

        {/*
          Secciones que no son módulos de configuración, sino herramientas de
          gestión. Van arriba, separadas, porque se usan a diario y buscarlas
          entre quince módulos sería absurdo.
        */}
        <div className="mb-4 mt-4">
          <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-ink-400">
            Gestión
          </p>

          {EXTRAS.map(({ href, label, Icon }) => {
            const url = `${base}/${href}`;
            const active = isActive(url);

            return (
              <Link
                key={href}
                href={url}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active ? 'bg-brand-500 text-white' : 'text-ink-200 hover:bg-ink-700 hover:text-white'
                }`}
              >
                <Icon size={16} className="w-5" />
                {label}
              </Link>
            );
          })}
        </div>

        {grouped.map((group) => (
          <div key={group.id} className="mb-4">
            <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-ink-400">
              {group.label}
            </p>

            {group.modules.map((module) => {
              const href = `${base}/${module.id}`;
              const active = isActive(href);

              return (
                <Link
                  key={module.id}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active ? 'bg-brand-500 text-white' : 'text-ink-200 hover:bg-ink-700 hover:text-white'
                  }`}
                >
                  <span className="w-5 text-center">{module.icon}</span>
                  <span className="flex-1 truncate">{module.es}</span>
                  {module.premium && premiumTier === 0 && (
                    <Crown size={12} className="shrink-0 text-warning" />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );

  return (
    <>
      {/* Botón para abrir en móvil */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary fixed bottom-4 left-4 z-40 shadow-xl lg:hidden"
        aria-label="Abrir menú de módulos"
      >
        <Menu size={16} />
        Módulos
      </button>

      {/* Escritorio */}
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-72 shrink-0 border-r border-ink-700/60 bg-ink-900/60 lg:block">
        {content}
      </aside>

      {/* Móvil */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
          />
          <div className="absolute inset-y-0 left-0 w-72 border-r border-ink-700 bg-ink-900 shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 z-10 rounded p-1.5 text-ink-300 hover:bg-ink-700 hover:text-white"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
            {content}
          </div>
        </div>
      )}
    </>
  );
}

import Link from 'next/link';
import { Crown, CalendarClock, Infinity as InfinityIcon, AlertTriangle, Server } from 'lucide-react';

import { formatDate } from '@/lib/premiumData';

/**
 * Tarjeta con el estado premium del usuario que ha iniciado sesión.
 * Se muestra arriba de la página de Premium.
 */
export default function PremiumStatusCard({ status, username }) {
  // Sin sesión: invitación a iniciarla.
  if (!status) {
    return (
      <div className="card mx-auto mb-12 max-w-3xl p-6 text-center">
        <Crown size={26} className="mx-auto text-ink-400" />
        <p className="mt-3 font-semibold text-white">¿Ya tienes premium?</p>
        <p className="mt-1 text-sm text-ink-300">
          Inicia sesión para ver tu suscripción y activarla en tus servidores.
        </p>
        <a href="/api/auth/login?redirect=/premium" className="btn-secondary mt-4">
          Iniciar sesión con Discord
        </a>
      </div>
    );
  }

  // Con sesión pero sin suscripción activa.
  if (!status.active) {
    return (
      <div className="card mx-auto mb-12 max-w-3xl p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ink-700">
            <Crown size={20} className="text-ink-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-white">
              {username}, ahora mismo no tienes premium
            </p>

            {status.expired ? (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-warning">
                <AlertTriangle size={14} />
                Tu <strong>Premium {status.storedTier}</strong> caducó
                {status.until ? ` el ${formatDate(status.until)}` : ''}.
              </p>
            ) : (
              <p className="mt-1 text-sm text-ink-300">
                Elige un plan abajo para desbloquear Anti-Raid, Protección VIP y ampliar
                todos los límites.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Suscripción activa.
  const usados = status.appliedGuilds?.length || 0;

  return (
    <div className="card mx-auto mb-12 max-w-3xl border-warning/40 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-warning/15">
            <Crown size={20} className="text-warning" />
          </div>
          <div>
            <p className="font-semibold text-white">
              {username}, tienes <span className="text-warning">{status.name}</span>
            </p>

            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-200">
              {status.permanent ? (
                <>
                  <InfinityIcon size={14} className="text-success" />
                  Sin fecha de caducidad
                </>
              ) : (
                <>
                  <CalendarClock size={14} className="text-ink-300" />
                  Caduca el <strong className="text-white">{formatDate(status.until)}</strong>
                  {status.daysLeft !== null && (
                    <span
                      className={status.daysLeft <= 7 ? 'text-danger' : 'text-ink-300'}
                    >
                      · quedan {status.daysLeft} día{status.daysLeft === 1 ? '' : 's'}
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
        </div>

        <span className="badge bg-warning/15 text-warning">Activo</span>
      </div>

      {/* Servidores donde está aplicado */}
      <div className="mt-5 border-t border-ink-700/60 pt-4">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-300">
          <Server size={12} />
          Servidores activados ({usados} / {status.maxGuilds})
        </p>

        {usados === 0 ? (
          <p className="mt-2 text-sm text-ink-300">
            Todavía no lo has activado en ninguno. Entra en el servidor que quieras y escribe{' '}
            <code className="rounded bg-ink-900 px-1.5 py-0.5 text-brand-300">
              /premiumuser activar
            </code>
            .
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {status.appliedGuilds.map((guild) => (
              <li key={guild.id} className="flex items-center justify-between gap-2 text-sm">
                <code className="truncate text-ink-200">{guild.id}</code>
                <span className="shrink-0 text-xs text-ink-400">
                  {guild.premium.active ? guild.premium.name : 'no aplicado'}
                </span>
              </li>
            ))}
          </ul>
        )}

        {usados < status.maxGuilds && usados > 0 && (
          <p className="help">
            Te queda{status.maxGuilds - usados === 1 ? '' : 'n'} {status.maxGuilds - usados}{' '}
            servidor(es) por activar.
          </p>
        )}

        <Link href="/dashboard" className="btn-secondary mt-4 text-xs">
          Ir a mis servidores
        </Link>
      </div>
    </div>
  );
}

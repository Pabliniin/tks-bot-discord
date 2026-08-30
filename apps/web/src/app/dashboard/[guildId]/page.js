import Link from 'next/link';
import { getGuildSettings, premiumTier, MODULES, PREMIUM_TIERS } from '@tkbot/shared';
import { Users, Hash, Crown, CircleCheck, CircleOff, AlertTriangle, ExternalLink } from 'lucide-react';

import { getGuildData } from '@/lib/botApi';
import { buildInviteUrl } from '@/lib/discord';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Resumen del servidor' };

/**
 * Un módulo cuenta como activo si su rama de configuración tiene `enabled`.
 * `welcome` también se considera activo si solo está la despedida.
 */
function isModuleEnabled(settings, moduleId) {
  if (moduleId === 'welcome') {
    return Boolean(settings.welcome?.enabled || settings.goodbye?.enabled);
  }
  if (moduleId === 'embeds') return (settings.embeds || []).length > 0;
  return Boolean(settings[moduleId]?.enabled);
}

export default async function GuildOverviewPage({ params }) {
  const { guildId } = await params;

  let settings = null;
  let dbError = null;
  try {
    settings = await getGuildSettings(guildId);
  } catch (error) {
    dbError = error.message;
  }

  const guildData = await getGuildData(guildId);
  const tier = settings ? premiumTier(settings) : 0;
  const limits = PREMIUM_TIERS[tier];

  if (dbError) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-5">
        <AlertTriangle size={20} className="mt-0.5 shrink-0 text-danger" />
        <div className="text-sm text-danger">
          <p className="font-semibold">No se ha podido leer la configuración.</p>
          <p className="mt-1 text-danger/80">{dbError}</p>
          <p className="mt-2 text-danger/80">
            Comprueba que MongoDB esté en marcha y que <code>MONGODB_URI</code> sea correcto.
          </p>
        </div>
      </div>
    );
  }

  const activeModules = MODULES.filter((m) => isModuleEnabled(settings, m.id));

  const stats = [
    {
      Icon: Users,
      label: 'Miembros',
      value: guildData ? new Intl.NumberFormat('es-ES').format(guildData.memberCount) : '—',
    },
    { Icon: Hash, label: 'Canales', value: guildData ? guildData.channels.length : '—' },
    { Icon: CircleCheck, label: 'Módulos activos', value: `${activeModules.length} / ${MODULES.length}` },
    { Icon: Crown, label: 'Plan', value: limits.name },
  ];

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-black text-white sm:text-3xl">Resumen</h1>
        <p className="mt-2 text-sm text-ink-300">
          Estado general del servidor y acceso rápido a los módulos.
        </p>
      </header>

      {!guildData && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
          <div className="text-sm text-warning">
            <p className="font-semibold">No hay conexión con el bot.</p>
            <p className="mt-0.5 text-warning/80">
              O bien el bot está apagado, o no está en este servidor. Puedes seguir configurando,
              pero los selectores de canales y roles aparecerán vacíos.
            </p>
            <a
              href={buildInviteUrl(guildId)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 font-semibold underline"
            >
              Invitar el bot <ExternalLink size={12} />
            </a>
          </div>
        </div>
      )}

      {/* ── Cifras ──────────────────────────────────────────────── */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ Icon, label, value }) => (
          <div key={label} className="card p-5">
            <Icon size={18} className="text-brand-400" />
            <p className="mt-3 text-2xl font-black text-white">{value}</p>
            <p className="text-xs uppercase tracking-wider text-ink-400">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Estado de cada módulo ───────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-lg font-bold text-white">Módulos</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((module) => {
            const enabled = isModuleEnabled(settings, module.id);
            const locked = module.premium && tier === 0;

            return (
              <Link
                key={module.id}
                href={`/dashboard/${guildId}/${module.id}`}
                className="card flex items-center gap-3 p-4 transition-colors hover:border-brand-500/50"
              >
                <span className="text-xl">{module.icon}</span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">{module.es}</span>
                  <span
                    className={`flex items-center gap-1 text-xs ${
                      enabled ? 'text-success' : 'text-ink-400'
                    }`}
                  >
                    {enabled ? <CircleCheck size={11} /> : <CircleOff size={11} />}
                    {enabled ? 'Activo' : 'Inactivo'}
                  </span>
                </span>

                {locked && <Crown size={14} className="shrink-0 text-warning" />}
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Datos útiles ────────────────────────────────────────── */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <h3 className="text-sm font-bold text-white">Prefijo de comandos</h3>
          <p className="mt-2 font-mono text-2xl font-black text-brand-400">{settings.prefix}</p>
          <p className="help">
            También puedes usar comandos de barra escribiendo <code>/</code> en Discord.
          </p>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-bold text-white">Límites de tu plan</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-200">
            <li>Embeds guardados: <strong>{limits.maxEmbeds}</strong></li>
            <li>Respuestas automáticas: <strong>{limits.maxAutoresponders}</strong></li>
            <li>Paneles de roles: <strong>{limits.maxSelfroles}</strong></li>
            <li>Paneles de tickets: <strong>{limits.maxTicketPanels}</strong></li>
          </ul>
          {tier === 0 && (
            <Link href="/premium" className="btn-secondary mt-4 w-full text-xs">
              <Crown size={13} /> Ver TK$ Premium
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

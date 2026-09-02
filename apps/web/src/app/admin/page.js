import { notFound } from 'next/navigation';
import {
  Server,
  Users,
  Crown,
  Euro,
  TrendingUp,
  Shield,
  TriangleAlert,
  CircleAlert,
} from 'lucide-react';
import { formatearPrecio } from '@tkbot/shared';

import Navbar from '@/components/Navbar';
import { requireAdmin } from '@/lib/adminGuard';
import { resumenGlobal, listarServidores, listarClientes } from '@/lib/adminStats';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Administración',
  robots: { index: false, follow: false },
};

const numero = new Intl.NumberFormat('es-ES');

/** Fecha corta. */
function fecha(valor) {
  if (!valor) return '—';
  return new Date(valor).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

/** Aspecto de cada estado de suscripción. */
const ESTADOS = {
  active: { texto: 'Activa', clase: 'bg-success/15 text-success' },
  trialing: { texto: 'En prueba', clase: 'bg-brand-500/15 text-brand-300' },
  past_due: { texto: 'Impago', clase: 'bg-warning/15 text-warning' },
  canceled: { texto: 'Cancelada', clase: 'bg-ink-700 text-ink-300' },
};

/**
 * Panel de administración del bot.
 *
 * Solo para los dueños y el personal. Contesta a «¿cómo va esto?»: cuántos
 * servidores hay, cuántos pagan y cuánto entra al mes.
 */
export default async function AdminPage() {
  const acceso = await requireAdmin();

  // Se responde 404 a quien no debe entrar: ni siquiera se le confirma que
  // esta página exista.
  if (!acceso.ok) notFound();

  let resumen;
  let servidores;
  let clientes;

  try {
    [resumen, servidores, clientes] = await Promise.all([
      resumenGlobal(),
      listarServidores({ orden: 'premium', limite: 40 }),
      listarClientes(40),
    ]);
  } catch (error) {
    return (
      <>
        <Navbar />
        <main className="container-page py-12">
          <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-5 text-sm text-danger">
            <TriangleAlert size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">No se pudieron cargar los datos.</p>
              <p className="mt-1 text-danger/80">{error.message}</p>
            </div>
          </div>
        </main>
      </>
    );
  }

  const cifras = [
    {
      Icon: Server,
      etiqueta: 'Servidores activos',
      valor: numero.format(resumen.servidores.activos),
      detalle: `${numero.format(resumen.servidores.nuevos30d)} nuevos en 30 días`,
    },
    {
      Icon: Users,
      etiqueta: 'Alcance',
      valor: numero.format(resumen.usuarios.alcance),
      detalle: `${numero.format(resumen.usuarios.total)} con perfil guardado`,
    },
    {
      Icon: Crown,
      etiqueta: 'Servidores con premium',
      valor: numero.format(resumen.premium.servidoresConPremium),
      detalle: `${resumen.premium.conversion} % del total`,
    },
    {
      Icon: Euro,
      etiqueta: 'Ingreso mensual',
      valor: formatearPrecio(resumen.suscripciones.ingresoMensualCentimos),
      detalle: `${resumen.suscripciones.activas} suscripción(es) activa(s)`,
    },
  ];

  return (
    <>
      <Navbar />

      <main className="container-page py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-black text-white sm:text-3xl">Administración</h1>
          <p className="mt-2 text-sm text-ink-300">
            Estado del negocio.{' '}
            {acceso.esDueno ? (
              <span className="badge bg-warning/15 text-warning">Dueño</span>
            ) : (
              <span className="badge bg-brand-500/15 text-brand-300">Personal</span>
            )}
          </p>
        </header>

        {/* ── Avisos que exigen actuar ────────────────────────── */}
        {resumen.actividad.instancias > 1 && (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
            <CircleAlert size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">
                Hay {resumen.actividad.instancias} instancias del bot funcionando a la vez.
              </p>
              <p className="mt-0.5 text-danger/80">
                Discord repartirá los comandos entre todas y la mitad de las acciones fallarán.
                Deja encendida solo una.
              </p>
            </div>
          </div>
        )}

        {resumen.actividad.offline && (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
            <TriangleAlert size={18} className="mt-0.5 shrink-0" />
            <p className="font-semibold">El bot no responde. Las cifras en vivo salen a cero.</p>
          </div>
        )}

        {resumen.suscripciones.impagadas > 0 && (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
            <Euro size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">
                {resumen.suscripciones.impagadas} suscripción(es) con el cobro fallido.
              </p>
              <p className="mt-0.5 text-warning/80">
                Stripe reintenta unos días. Siguen teniendo acceso mientras tanto.
              </p>
            </div>
          </div>
        )}

        {/* ── Cifras ──────────────────────────────────────────── */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cifras.map(({ Icon, etiqueta, valor, detalle }) => (
            <div key={etiqueta} className="card p-5">
              <Icon size={18} className="text-brand-400" />
              <p className="mt-3 text-2xl font-black text-white">{valor}</p>
              <p className="text-xs uppercase tracking-wider text-ink-400">{etiqueta}</p>
              <p className="mt-1 text-xs text-ink-400">{detalle}</p>
            </div>
          ))}
        </div>

        {/* ── Reparto del premium ─────────────────────────────── */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="card p-5">
            <p className="text-xs uppercase tracking-wider text-ink-400">Premium 1</p>
            <p className="mt-1 text-xl font-black text-white">{resumen.premium.tier1}</p>
          </div>
          <div className="card p-5">
            <p className="text-xs uppercase tracking-wider text-ink-400">Premium 2</p>
            <p className="mt-1 text-xl font-black text-warning">{resumen.premium.tier2}</p>
          </div>
          <div className="card p-5">
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-ink-400">
              <Shield size={12} /> Sanciones (30 d)
            </p>
            <p className="mt-1 text-xl font-black text-white">
              {numero.format(resumen.actividad.sanciones30d)}
            </p>
          </div>
        </div>

        {/* ── Clientes de pago ────────────────────────────────── */}
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
            <Euro size={17} className="text-brand-400" />
            Clientes de pago
          </h2>

          {clientes.length === 0 ? (
            <div className="card p-8 text-center text-sm text-ink-400">
              Todavía no hay ninguna suscripción de pago.
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-ink-700 text-left text-ink-300">
                    <th className="px-4 py-3 font-semibold">Usuario</th>
                    <th className="px-4 py-3 font-semibold">Plan</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 font-semibold">Renueva</th>
                    <th className="px-4 py-3 font-semibold">Servidores</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((cliente) => {
                    const estado = ESTADOS[cliente.billing.status] || {
                      texto: cliente.billing.status || '—',
                      clase: 'bg-ink-700 text-ink-300',
                    };

                    return (
                      <tr key={cliente.userId} className="border-b border-ink-700/50 last:border-0">
                        <td className="px-4 py-3 font-mono text-xs text-ink-200">
                          {cliente.userId}
                        </td>
                        <td className="px-4 py-3 text-ink-100">{cliente.premium.name}</td>
                        <td className="px-4 py-3">
                          <span className={`badge ${estado.clase}`}>{estado.texto}</span>
                          {cliente.billing.cancelaAlFinal && (
                            <span className="ml-1.5 text-xs text-ink-400">· se da de baja</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-ink-300">
                          {fecha(cliente.billing.renuevaEl)}
                        </td>
                        <td className="px-4 py-3 text-ink-300">
                          {cliente.servidoresAplicados} / {cliente.servidoresMaximos}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Servidores ──────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
            <TrendingUp size={17} className="text-brand-400" />
            Servidores
            <span className="text-sm font-normal text-ink-400">
              (los {servidores.length} con más prioridad)
            </span>
          </h2>

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-ink-700 text-left text-ink-300">
                  <th className="px-4 py-3 font-semibold">Servidor</th>
                  <th className="px-4 py-3 font-semibold">Plan</th>
                  <th className="px-4 py-3 font-semibold">Miembros</th>
                  <th className="px-4 py-3 font-semibold">Comandos</th>
                  <th className="px-4 py-3 font-semibold">Alta</th>
                </tr>
              </thead>
              <tbody>
                {servidores.map((servidor) => (
                  <tr key={servidor.guildId} className="border-b border-ink-700/50 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-ink-200">{servidor.guildId}</td>
                    <td className="px-4 py-3">
                      {servidor.premium.tier > 0 ? (
                        <span className="badge bg-warning/15 text-warning">
                          <Crown size={10} /> {servidor.premium.name}
                        </span>
                      ) : (
                        <span className="text-ink-400">Gratis</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-300">{numero.format(servidor.miembros)}</td>
                    <td className="px-4 py-3 text-ink-300">{numero.format(servidor.comandos)}</td>
                    <td className="px-4 py-3 text-ink-300">{fecha(servidor.creado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}

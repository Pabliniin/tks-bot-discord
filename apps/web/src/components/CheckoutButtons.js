'use client';

import { useState } from 'react';
import { Crown, Loader, TriangleAlert, ExternalLink, Settings } from 'lucide-react';

/**
 * Botones de compra y gestión de la suscripción.
 *
 * El precio y el nivel los decide el servidor: aquí solo se manda el
 * identificador del plan elegido. Aceptar un importe del navegador sería
 * regalar el premium a quien supiera editar una petición.
 */
export default function CheckoutButtons({ planes, sesionIniciada, tieneSuscripcion, tier }) {
  const [cargando, setCargando] = useState(null);
  const [error, setError] = useState(null);
  const [periodo, setPeriodo] = useState('mensual');

  /** Lanza el pago del plan elegido. */
  async function comprar(planId) {
    setCargando(planId);
    setError(null);

    try {
      const respuesta = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      });
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        setError(datos.error);
        return;
      }
      // Stripe se encarga del formulario de pago: nunca vemos la tarjeta.
      window.location.href = datos.url;
    } catch {
      setError('No se pudo conectar. Inténtalo de nuevo.');
    } finally {
      setCargando(null);
    }
  }

  /** Abre el portal de Stripe para cambiar tarjeta o darse de baja. */
  async function gestionar() {
    setCargando('portal');
    setError(null);

    try {
      const respuesta = await fetch('/api/stripe/portal', { method: 'POST' });
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        setError(datos.error);
        return;
      }
      window.location.href = datos.url;
    } catch {
      setError('No se pudo abrir la gestión de la suscripción.');
    } finally {
      setCargando(null);
    }
  }

  if (planes.length === 0) return null;

  const hayAnual = planes.some((p) => p.periodo === 'anual');
  const visibles = planes.filter((p) => p.periodo === periodo);

  return (
    <div className="mx-auto mb-10 max-w-5xl">
      {error && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 p-3.5 text-sm text-danger">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Ya es cliente: se le ofrece gestionar, no volver a comprar. */}
      {tieneSuscripcion ? (
        <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="font-bold text-white">Ya tienes una suscripción activa</p>
            <p className="mt-0.5 text-sm text-ink-300">
              Desde aquí puedes cambiar de plan, actualizar la tarjeta, descargar tus facturas o
              darte de baja.
            </p>
          </div>

          <button
            type="button"
            onClick={gestionar}
            disabled={cargando === 'portal'}
            className="btn-secondary shrink-0"
          >
            {cargando === 'portal' ? (
              <Loader size={15} className="animate-spin" />
            ) : (
              <Settings size={15} />
            )}
            Gestionar suscripción
          </button>
        </div>
      ) : (
        <>
          {/* Mensual / anual */}
          {hayAnual && (
            <div className="mb-5 flex justify-center">
              <div className="inline-flex rounded-lg bg-ink-800 p-1">
                {['mensual', 'anual'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriodo(p)}
                    className={`rounded-md px-4 py-1.5 text-sm font-semibold capitalize transition-colors ${
                      periodo === p ? 'bg-brand-500 text-white' : 'text-ink-300 hover:text-white'
                    }`}
                  >
                    {p}
                    {p === 'anual' && (
                      <span className="ml-1.5 text-[11px] font-bold text-success">−17 %</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {visibles.map((plan) => {
              const yaLoTiene = tier === plan.tier;

              return (
                <div
                  key={plan.id}
                  className={`card p-5 ${plan.tier === 1 ? 'border-brand-500/50' : ''}`}
                >
                  <p className="flex items-center gap-2 font-bold text-white">
                    <Crown size={15} className={plan.tier === 2 ? 'text-warning' : 'text-brand-400'} />
                    {plan.nombre}
                  </p>

                  <p className="mt-2">
                    <span className="text-2xl font-black text-white">{plan.precio}</span>
                    <span className="ml-1.5 text-sm text-ink-400">
                      {plan.periodo === 'anual' ? 'al año' : 'al mes'}
                    </span>
                  </p>

                  <button
                    type="button"
                    onClick={() => (sesionIniciada ? comprar(plan.id) : null)}
                    disabled={Boolean(cargando) || yaLoTiene}
                    className="btn-primary mt-4 w-full"
                    {...(!sesionIniciada && { 'aria-disabled': true })}
                  >
                    {cargando === plan.id && <Loader size={15} className="animate-spin" />}
                    {yaLoTiene ? 'Ya es tu plan' : sesionIniciada ? 'Contratar' : 'Inicia sesión'}
                  </button>

                  {!sesionIniciada && (
                    <a
                      href="/api/auth/login?redirect=/premium"
                      className="btn-ghost mt-2 w-full text-xs"
                    >
                      Entrar con Discord <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-center text-xs text-ink-400">
            Pago seguro con Stripe. Puedes darte de baja cuando quieras desde tu cuenta.
          </p>
        </>
      )}
    </div>
  );
}

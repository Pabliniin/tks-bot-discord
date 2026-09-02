'use client';

import { useState, useEffect, useCallback, useId } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  MessageSquare,
  Shield,
  Terminal,
  Loader,
  TriangleAlert,
  ChartNoAxesColumn,
} from 'lucide-react';

import { trazarSerie } from '@/lib/guildStats';

/**
 * Gráficas de actividad del servidor.
 *
 * Se dibujan con SVG a mano en vez de con una librería de gráficas: cualquiera
 * de las habituales añade entre 50 y 150 KB al paquete, y aquí solo hacen
 * falta una línea y unas barras. El panel carga rápido, que es media venta.
 */

const numero = new Intl.NumberFormat('es-ES');

/** Día en formato corto para los ejes. */
function diaCorto(fecha) {
  const [, mes, dia] = fecha.split('-');
  return `${Number(dia)}/${Number(mes)}`;
}

/** Convierte minutos a un texto compacto. */
function horas(minutos) {
  const total = Math.round(minutos || 0);
  if (total < 60) return `${total} min`;
  return `${numero.format(Math.round(total / 60))} h`;
}

export default function StatsCharts({ guildId }) {
  const [dias, setDias] = useState(30);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);

    try {
      const respuesta = await fetch(`/api/guilds/${guildId}/stats?dias=${dias}`);
      const cuerpo = await respuesta.json();

      if (!respuesta.ok) {
        setError(cuerpo.error);
        return;
      }
      setDatos(cuerpo);
    } catch {
      setError('No se pudieron cargar las estadísticas.');
    } finally {
      setCargando(false);
    }
  }, [guildId, dias]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (cargando && !datos) {
    return (
      <div className="card flex items-center justify-center gap-2 p-16 text-sm text-ink-400">
        <Loader size={16} className="animate-spin" />
        Cargando estadísticas…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-5 text-sm text-danger">
        <TriangleAlert size={18} className="mt-0.5 shrink-0" />
        {error}
      </div>
    );
  }

  const { serie, resumen, canales, hayDatos } = datos;

  return (
    <div className={cargando ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
      {/* ── Selector de periodo ──────────────────────────────── */}
      <div className="mb-5 flex gap-2">
        {[7, 30, 90].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setDias(n)}
            className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
              dias === n
                ? 'bg-brand-500 text-white'
                : 'bg-ink-800 text-ink-200 hover:bg-ink-700 hover:text-white'
            }`}
          >
            {n} días
          </button>
        ))}
      </div>

      {!hayDatos && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-ink-700 bg-ink-800/60 p-4">
          <ChartNoAxesColumn size={18} className="mt-0.5 shrink-0 text-ink-400" />
          <div className="text-sm">
            <p className="font-semibold text-white">Todavía no hay datos suficientes.</p>
            <p className="mt-0.5 text-ink-300">
              Las estadísticas empiezan a recogerse desde que el bot está activo en el servidor.
              Vuelve mañana y ya verás la primera curva.
            </p>
          </div>
        </div>
      )}

      {/* ── Cifras del periodo ───────────────────────────────── */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra
          Icon={Users}
          etiqueta="Crecimiento neto"
          valor={`${resumen.crecimiento.valor >= 0 ? '+' : ''}${numero.format(resumen.crecimiento.valor)}`}
          detalle={`${numero.format(resumen.crecimiento.inicio)} → ${numero.format(resumen.crecimiento.fin)} miembros`}
          positivo={resumen.crecimiento.valor >= 0}
        />
        <Cifra
          Icon={MessageSquare}
          etiqueta="Mensajes"
          valor={numero.format(resumen.messages.valor)}
          variacion={resumen.messages.variacion}
        />
        <Cifra
          Icon={Terminal}
          etiqueta="Comandos"
          valor={numero.format(resumen.commands.valor)}
          variacion={resumen.commands.variacion}
        />
        <Cifra
          Icon={Shield}
          etiqueta="Sanciones"
          valor={numero.format(resumen.moderationActions.valor)}
          variacion={resumen.moderationActions.variacion}
          // Menos sanciones es buena señal: se invierte el color.
          invertir
        />
      </div>

      {/* ── Curva de miembros ────────────────────────────────── */}
      <section className="card mb-4 p-5">
        <h2 className="text-base font-bold text-white">Miembros</h2>
        <p className="mb-4 text-xs text-ink-400">Cuánta gente hay en el servidor cada día.</p>
        <GraficaLinea serie={serie} campo="memberCount" />
      </section>

      {/* ── Entradas y salidas ───────────────────────────────── */}
      <section className="card mb-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-bold text-white">Entradas y salidas</h2>
          {resumen.retencion !== null && (
            <p className="text-xs text-ink-400">
              Retención:{' '}
              <strong
                className={resumen.retencion >= 50 ? 'text-success' : 'text-warning'}
              >
                {resumen.retencion} %
              </strong>{' '}
              de los que entran se quedan
            </p>
          )}
        </div>
        <p className="mb-4 text-xs text-ink-400">
          <span className="text-success">Verde</span> entran ·{' '}
          <span className="text-danger">rojo</span> se van
        </p>
        <GraficaBarras serie={serie} />
      </section>

      {/* ── Actividad ────────────────────────────────────────── */}
      <section className="card mb-4 p-5">
        <h2 className="text-base font-bold text-white">Mensajes por día</h2>
        <p className="mb-4 text-xs text-ink-400">
          Total del periodo: {numero.format(resumen.messages.valor)} mensajes ·{' '}
          {horas(resumen.voiceMinutes.valor)} en voz
        </p>
        <GraficaLinea serie={serie} campo="messages" />
      </section>

      {/* ── Canales más activos ──────────────────────────────── */}
      {canales.length > 0 && (
        <section className="card p-5">
          <h2 className="text-base font-bold text-white">Canales más activos</h2>
          <p className="mb-4 text-xs text-ink-400">Dónde se habla de verdad en tu servidor.</p>

          <ol className="space-y-2">
            {canales.map((canal, indice) => {
              const maximo = canales[0].mensajes || 1;
              const ancho = Math.max(2, (canal.mensajes / maximo) * 100);

              return (
                <li key={canal.channelId} className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-right text-xs font-bold text-ink-400">
                    {indice + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={`truncate text-sm font-medium ${
                          canal.existe ? 'text-white' : 'italic text-ink-400'
                        }`}
                      >
                        #{canal.nombre}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-ink-400">
                        {numero.format(canal.mensajes)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${ancho}%` }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}

/** Tarjeta con una cifra y su variación. */
function Cifra({ Icon, etiqueta, valor, detalle, variacion, positivo, invertir }) {
  // `null` significa que no había periodo anterior con el que comparar.
  const hayVariacion = typeof variacion === 'number';
  const sube = hayVariacion ? variacion > 0 : positivo;
  const bueno = invertir ? !sube : sube;

  return (
    <div className="card p-4">
      <Icon size={16} className="text-brand-400" />
      <p className="mt-2.5 text-2xl font-black text-white">{valor}</p>
      <p className="text-xs uppercase tracking-wider text-ink-400">{etiqueta}</p>

      {detalle && <p className="mt-1 text-xs text-ink-400">{detalle}</p>}

      {hayVariacion && variacion !== 0 && (
        <p
          className={`mt-1 flex items-center gap-1 text-xs font-semibold ${
            bueno ? 'text-success' : 'text-danger'
          }`}
        >
          {sube ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(variacion)} % frente al periodo anterior
        </p>
      )}
    </div>
  );
}

/** Gráfica de línea con área bajo la curva. */
function GraficaLinea({ serie, campo, color = '#5865F2' }) {
  const id = useId();

  const ANCHO = 700;
  const ALTO = 180;

  // El trazado vive en `lib/guildStats` porque allí está probado: un NaN en un
  // atributo `d` no da ningún error, solo deja la gráfica en blanco.
  const { linea, area, maximo } = trazarSerie(serie, campo, { ancho: ANCHO, alto: ALTO });
  const valores = serie.map((d) => d[campo] || 0);

  return (
    <div>
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        className="h-44 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Evolución de ${campo}: de ${numero.format(valores[0])} a ${numero.format(valores[valores.length - 1])}`}
      >
        <defs>
          <linearGradient id={`degradado-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Líneas de referencia horizontales */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="0"
            y1={ALTO * f}
            x2={ANCHO}
            y2={ALTO * f}
            stroke="currentColor"
            strokeWidth="1"
            className="text-ink-700"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        <path d={area} fill={`url(#degradado-${id})`} />
        <path
          d={linea}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="mt-1.5 flex justify-between text-[11px] text-ink-500">
        <span>{diaCorto(serie[0].date)}</span>
        <span className="font-semibold text-ink-300">
          máx. {numero.format(maximo)}
        </span>
        <span>{diaCorto(serie[serie.length - 1].date)}</span>
      </div>
    </div>
  );
}

/** Barras de entradas (arriba) y salidas (abajo). */
function GraficaBarras({ serie }) {
  const maximo = Math.max(...serie.map((d) => Math.max(d.joins, d.leaves)), 1);

  return (
    <div>
      <div className="flex h-40 items-center gap-px" role="img" aria-label="Entradas y salidas por día">
        {serie.map((d) => (
          <div
            key={d.date}
            className="group relative flex h-full flex-1 flex-col justify-center"
            title={`${diaCorto(d.date)} · +${d.joins} / −${d.leaves}`}
          >
            {/* Entradas hacia arriba */}
            <div className="flex flex-1 items-end">
              <div
                className="w-full rounded-t-sm bg-success/70 transition-colors group-hover:bg-success"
                style={{ height: `${(d.joins / maximo) * 100}%` }}
              />
            </div>

            <div className="h-px w-full bg-ink-600" />

            {/* Salidas hacia abajo */}
            <div className="flex flex-1 items-start">
              <div
                className="w-full rounded-b-sm bg-danger/70 transition-colors group-hover:bg-danger"
                style={{ height: `${(d.leaves / maximo) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-1.5 flex justify-between text-[11px] text-ink-500">
        <span>{diaCorto(serie[0].date)}</span>
        <span>{diaCorto(serie[serie.length - 1].date)}</span>
      </div>
    </div>
  );
}

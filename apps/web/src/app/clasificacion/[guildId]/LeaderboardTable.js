'use client';

import { useState } from 'react';
import { MessageSquare, Mic, UserPlus, TrendingUp, Search } from 'lucide-react';

/**
 * Tabla de la clasificación pública.
 *
 * Los cuatro criterios llegan ya calculados del servidor, así que cambiar de
 * pestaña o buscar es instantáneo y no hace ninguna petición.
 */

const CRITERIOS = [
  { id: 'xp', etiqueta: 'Nivel', Icon: TrendingUp },
  { id: 'messages', etiqueta: 'Mensajes', Icon: MessageSquare },
  { id: 'voice', etiqueta: 'Voz', Icon: Mic },
  { id: 'invites', etiqueta: 'Invitaciones', Icon: UserPlus },
];

/** Medallas de los tres primeros puestos. */
const MEDALLAS = { 1: '🥇', 2: '🥈', 3: '🥉' };

const numero = new Intl.NumberFormat('es-ES');

/** Convierte minutos a «3 h 20 min». */
function formatearMinutos(minutos) {
  const total = Math.max(0, Math.round(Number(minutos) || 0));
  if (total < 60) return `${total} min`;

  const horas = Math.floor(total / 60);
  const resto = total % 60;

  if (horas < 24) return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
  return `${Math.floor(horas / 24)} d ${horas % 24} h`;
}

/** Valor que se enseña a la derecha según el criterio activo. */
function valorPrincipal(puesto, criterio) {
  switch (criterio) {
    case 'messages':
      return { cifra: numero.format(puesto.mensajes), unidad: 'mensajes' };
    case 'voice':
      return { cifra: formatearMinutos(puesto.minutosVoz), unidad: 'en voz' };
    case 'invites':
      return { cifra: numero.format(puesto.invitaciones), unidad: 'invitaciones' };
    default:
      return { cifra: `Nivel ${puesto.nivel}`, unidad: `${numero.format(puesto.xp)} XP` };
  }
}

export default function LeaderboardTable({ datos }) {
  const [criterio, setCriterio] = useState('xp');
  const [busqueda, setBusqueda] = useState('');

  const listaCompleta = datos[criterio] || [];

  const termino = busqueda.trim().toLowerCase();
  const lista = termino
    ? listaCompleta.filter(
        (p) => p.nombre.toLowerCase().includes(termino) || p.userId.includes(termino)
      )
    : listaCompleta;

  return (
    <div>
      {/* ── Pestañas de criterio ─────────────────────────────── */}
      <div className="mb-4 flex flex-wrap gap-2">
        {CRITERIOS.map(({ id, etiqueta, Icon }) => {
          const activo = criterio === id;
          const vacio = (datos[id] || []).length === 0;

          return (
            <button
              key={id}
              type="button"
              onClick={() => setCriterio(id)}
              disabled={vacio}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
                activo
                  ? 'bg-brand-500 text-white'
                  : 'bg-ink-800 text-ink-200 hover:bg-ink-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-ink-800'
              }`}
            >
              <Icon size={14} />
              {etiqueta}
            </button>
          );
        })}
      </div>

      {/* ── Buscador ─────────────────────────────────────────── */}
      {listaCompleta.length > 8 && (
        <div className="relative mb-4">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Busca tu nombre…"
            className="input pl-9"
            aria-label="Buscar un miembro en la clasificación"
          />
        </div>
      )}

      {/* ── Puestos ──────────────────────────────────────────── */}
      {lista.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-ink-300">
            {termino
              ? `Nadie coincide con «${busqueda}».`
              : 'Todavía no hay nadie en esta clasificación.'}
          </p>
        </div>
      ) : (
        <ol className="space-y-2">
          {lista.map((puesto) => {
            const { cifra, unidad } = valorPrincipal(puesto, criterio);
            const podio = puesto.posicion <= 3;

            return (
              <li
                key={puesto.userId}
                className={`card flex items-center gap-3 p-3 sm:gap-4 sm:p-4 ${
                  podio ? 'border-warning/30 bg-warning/[0.03]' : ''
                }`}
              >
                {/* Posición */}
                <span
                  className={`w-9 shrink-0 text-center text-lg font-black sm:w-11 sm:text-xl ${
                    podio ? '' : 'text-ink-400'
                  }`}
                >
                  {MEDALLAS[puesto.posicion] || puesto.posicion}
                </span>

                {/* Avatar */}
                {puesto.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={puesto.avatar}
                    alt=""
                    loading="lazy"
                    className="h-10 w-10 shrink-0 rounded-full object-cover sm:h-11 sm:w-11"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-700 text-xs font-bold sm:h-11 sm:w-11">
                    {puesto.nombre.slice(0, 2).toUpperCase()}
                  </div>
                )}

                {/* Nombre y progreso */}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-white">
                    {puesto.nombre}
                    {puesto.sigueEnElServidor === false && (
                      <span
                        className="badge bg-ink-700 text-[10px] text-ink-300"
                        title="Ya no está en el servidor"
                      >
                        se fue
                      </span>
                    )}
                  </p>

                  {criterio === 'xp' ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div
                        className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700"
                        role="progressbar"
                        aria-valuenow={puesto.progreso}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Progreso al nivel ${puesto.nivel + 1}`}
                      >
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${puesto.progreso}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-[11px] tabular-nums text-ink-400">
                        {puesto.progreso}%
                      </span>
                    </div>
                  ) : (
                    <p className="mt-0.5 text-xs text-ink-400">Nivel {puesto.nivel}</p>
                  )}
                </div>

                {/* Cifra del criterio activo */}
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-white sm:text-base">{cifra}</p>
                  <p className="text-[11px] text-ink-400">{unidad}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

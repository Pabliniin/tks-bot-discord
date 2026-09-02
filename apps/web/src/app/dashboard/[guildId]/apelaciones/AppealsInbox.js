'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Scale,
  CircleCheck,
  CircleX,
  Clock,
  Loader,
  TriangleAlert,
  MailWarning,
} from 'lucide-react';

/**
 * Bandeja de apelaciones del equipo.
 *
 * Cada apelación se enseña junto a la sanción que la motivó, para poder
 * decidir sin salir de aquí ni buscar el caso en Discord.
 */

const FILTROS = [
  { id: 'pending', etiqueta: 'Pendientes' },
  { id: 'accepted', etiqueta: 'Aceptadas' },
  { id: 'rejected', etiqueta: 'Rechazadas' },
  { id: '', etiqueta: 'Todas' },
];

const ESTADOS = {
  pending: { Icon: Clock, clase: 'bg-warning/15 text-warning', etiqueta: 'Pendiente' },
  accepted: { Icon: CircleCheck, clase: 'bg-success/15 text-success', etiqueta: 'Aceptada' },
  rejected: { Icon: CircleX, clase: 'bg-danger/15 text-danger', etiqueta: 'Rechazada' },
};

/** Fecha legible. */
function cuando(valor) {
  return new Date(valor).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AppealsInbox({ guildId, activadas }) {
  const [filtro, setFiltro] = useState('pending');
  const [apelaciones, setApelaciones] = useState([]);
  const [pendientes, setPendientes] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const respuesta = await fetch(
        `/api/guilds/${guildId}/appeals${filtro ? `?estado=${filtro}` : ''}`
      );
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        setAviso({ tipo: 'error', texto: datos.error });
        return;
      }

      setApelaciones(datos.apelaciones);
      setPendientes(datos.pendientes);
    } catch {
      setAviso({ tipo: 'error', texto: 'No se pudieron cargar las apelaciones.' });
    } finally {
      setCargando(false);
    }
  }, [guildId, filtro]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div>
      {!activadas && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-warning" />
          <div className="text-sm text-warning">
            <p className="font-semibold">Las apelaciones están desactivadas.</p>
            <p className="mt-0.5 text-warning/80">
              Nadie puede enviar apelaciones nuevas. Actívalas en el módulo «Apelaciones» para que
              el enlace aparezca en el aviso que reciben los sancionados.
            </p>
          </div>
        </div>
      )}

      {aviso && (
        <div
          className={`mb-4 flex items-start gap-3 rounded-lg border p-4 text-sm ${
            aviso.tipo === 'error'
              ? 'border-danger/30 bg-danger/10 text-danger'
              : 'border-success/30 bg-success/10 text-success'
          }`}
          role="status"
        >
          {aviso.tipo === 'error' ? (
            <TriangleAlert size={17} className="mt-0.5 shrink-0" />
          ) : (
            <CircleCheck size={17} className="mt-0.5 shrink-0" />
          )}
          {aviso.texto}
        </div>
      )}

      {/* ── Filtros ──────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.id || 'todas'}
            type="button"
            onClick={() => setFiltro(f.id)}
            className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
              filtro === f.id
                ? 'bg-brand-500 text-white'
                : 'bg-ink-800 text-ink-200 hover:bg-ink-700 hover:text-white'
            }`}
          >
            {f.etiqueta}
            {f.id === 'pending' && pendientes > 0 && (
              <span className="ml-1.5 rounded-full bg-warning px-1.5 text-xs font-bold text-ink-950">
                {pendientes}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Lista ────────────────────────────────────────────── */}
      {cargando ? (
        <div className="card flex items-center justify-center gap-2 p-10 text-sm text-ink-400">
          <Loader size={16} className="animate-spin" />
          Cargando…
        </div>
      ) : apelaciones.length === 0 ? (
        <div className="card p-10 text-center">
          <Scale size={32} className="mx-auto mb-3 text-ink-600" />
          <p className="font-semibold text-white">
            {filtro === 'pending' ? 'No hay apelaciones pendientes' : 'No hay nada aquí'}
          </p>
          <p className="mt-1 text-sm text-ink-400">
            {filtro === 'pending'
              ? 'Cuando alguien apele una sanción, aparecerá en esta lista.'
              : 'Prueba con otro filtro.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {apelaciones.map((apelacion) => (
            <AppealCard
              key={apelacion.id}
              apelacion={apelacion}
              guildId={guildId}
              onResuelta={(texto) => {
                setAviso({ tipo: 'exito', texto });
                cargar();
              }}
              onError={(texto) => setAviso({ tipo: 'error', texto })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Una apelación con su sanción y los botones de decisión. */
function AppealCard({ apelacion, guildId, onResuelta, onError }) {
  const [nota, setNota] = useState('');
  const [levantar, setLevantar] = useState(true);
  const [decidiendo, setDecidiendo] = useState(null);
  const [abierto, setAbierto] = useState(false);

  const estado = ESTADOS[apelacion.status] || ESTADOS.pending;
  const { Icon } = estado;
  const esBaneo = apelacion.caso?.type === 'ban' || apelacion.caso?.type === 'softban';

  async function decidir(decision) {
    setDecidiendo(decision);

    try {
      const respuesta = await fetch(`/api/guilds/${guildId}/appeals`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: apelacion.id,
          decision,
          nota,
          levantarSancion: decision === 'accepted' && esBaneo && levantar,
        }),
      });
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        onError(datos.error);
        return;
      }

      const partes = [decision === 'accepted' ? 'Apelación aceptada.' : 'Apelación rechazada.'];
      if (datos.sancionLevantada) partes.push('Se ha levantado el baneo.');
      if (!datos.avisado) partes.push('No se pudo avisar al usuario por privado.');

      onResuelta(partes.join(' '));
    } catch {
      onError('No se pudo resolver la apelación.');
    } finally {
      setDecidiendo(null);
    }
  }

  return (
    <article className="card overflow-hidden">
      <div className="p-4">
        {/* Cabecera: quién apela */}
        <div className="flex flex-wrap items-start gap-3">
          {apelacion.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={apelacion.avatar} alt="" className="h-10 w-10 shrink-0 rounded-full" />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-700 text-xs font-bold">
              {apelacion.nombre.slice(0, 2).toUpperCase()}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-semibold text-white">
              {apelacion.nombre}
              <span className={`badge ${estado.clase}`}>
                <Icon size={10} /> {estado.etiqueta}
              </span>
            </p>
            <p className="mt-0.5 font-mono text-xs text-ink-400">{apelacion.userId}</p>
          </div>

          <p className="shrink-0 text-xs text-ink-400">{cuando(apelacion.createdAt)}</p>
        </div>

        {/* La sanción que se apela */}
        {apelacion.caso && (
          <div className="mt-3 rounded-lg border border-ink-700 bg-ink-900/50 p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-400">
              Sanción · caso #{apelacion.caso.caseId}
            </p>
            <p className="mt-1 text-sm text-white">
              <strong>{apelacion.caso.tipoLegible}</strong>
              <span className="text-ink-400"> · {cuando(apelacion.caso.createdAt)}</span>
            </p>
            <p className="mt-1 text-sm text-ink-200">{apelacion.caso.reason}</p>
            {apelacion.caso.moderatorTag && (
              <p className="mt-1 text-xs text-ink-400">
                Sancionado por <strong className="text-ink-300">{apelacion.caso.moderatorTag}</strong>
              </p>
            )}
          </div>
        )}

        {/* Lo que alega */}
        <div className="mt-3">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-400">Su versión</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-100">
            {apelacion.text}
          </p>
        </div>

        {/* Resolución ya tomada */}
        {apelacion.status !== 'pending' && (
          <div className="mt-3 rounded-lg border border-ink-700 bg-ink-900/50 p-3">
            <p className="text-xs text-ink-400">
              Resuelta por <strong className="text-ink-200">{apelacion.reviewedByTag}</strong> el{' '}
              {cuando(apelacion.reviewedAt)}
              {apelacion.sanctionLifted && ' · se levantó la sanción'}
            </p>
            {apelacion.reviewNote && (
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink-200">
                {apelacion.reviewNote}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Decisión */}
      {apelacion.status === 'pending' && (
        <div className="border-t border-ink-700/60 bg-ink-900/40 p-4">
          {!abierto ? (
            <button
              type="button"
              onClick={() => setAbierto(true)}
              className="btn-secondary w-full text-sm"
            >
              <Scale size={15} />
              Resolver esta apelación
            </button>
          ) : (
            <div>
              <label htmlFor={`nota-${apelacion.id}`} className="label text-xs">
                Respuesta para el usuario (opcional)
              </label>
              <textarea
                id={`nota-${apelacion.id}`}
                value={nota}
                onChange={(e) => setNota(e.target.value.slice(0, 1000))}
                rows={2}
                placeholder="Se le enviará por privado junto a la decisión."
                className="input resize-y text-sm"
              />

              {esBaneo && (
                <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-sm text-ink-200">
                  <input
                    type="checkbox"
                    checked={levantar}
                    onChange={(e) => setLevantar(e.target.checked)}
                    className="h-4 w-4 rounded border-ink-600 bg-ink-900 text-brand-500"
                  />
                  Levantar el baneo si la acepto
                </label>
              )}

              <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-400">
                <MailWarning size={13} className="mt-0.5 shrink-0" />
                Se le avisará por mensaje privado. Si los tiene cerrados, lo verá al volver a la
                página de apelación.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => decidir('accepted')}
                  disabled={Boolean(decidiendo)}
                  className="btn-primary flex-1 text-sm"
                >
                  {decidiendo === 'accepted' ? (
                    <Loader size={14} className="animate-spin" />
                  ) : (
                    <CircleCheck size={14} />
                  )}
                  Aceptar
                </button>
                <button
                  type="button"
                  onClick={() => decidir('rejected')}
                  disabled={Boolean(decidiendo)}
                  className="btn-danger flex-1 text-sm"
                >
                  {decidiendo === 'rejected' ? (
                    <Loader size={14} className="animate-spin" />
                  ) : (
                    <CircleX size={14} />
                  )}
                  Rechazar
                </button>
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  disabled={Boolean(decidiendo)}
                  className="btn-ghost text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

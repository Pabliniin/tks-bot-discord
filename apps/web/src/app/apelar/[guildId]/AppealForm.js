'use client';

import { useState } from 'react';
import { Send, CircleCheck, CircleX, Clock, TriangleAlert } from 'lucide-react';

/** Longitud mínima que exige el servidor. */
const MIN_TEXTO = 30;
const MAX_TEXTO = 2000;

/** Fecha legible en castellano. */
function fecha(valor) {
  if (!valor) return '';
  return new Date(valor).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Aspecto de cada estado de una apelación ya enviada. */
const ESTADOS = {
  pending: {
    Icon: Clock,
    color: 'text-warning',
    fondo: 'border-warning/30 bg-warning/10',
    titulo: 'Tu apelación está pendiente de revisión',
    texto: 'El equipo del servidor la verá y decidirá. No hace falta que la vuelvas a enviar.',
  },
  accepted: {
    Icon: CircleCheck,
    color: 'text-success',
    fondo: 'border-success/30 bg-success/10',
    titulo: 'Tu apelación ha sido aceptada',
    texto: 'El equipo ha revisado tu caso y te ha dado la razón.',
  },
  rejected: {
    Icon: CircleX,
    color: 'text-danger',
    fondo: 'border-danger/30 bg-danger/10',
    titulo: 'Tu apelación ha sido rechazada',
    texto: 'El equipo ha revisado tu caso y ha decidido mantener la sanción.',
  },
};

/**
 * Formulario público de apelación.
 *
 * Recibe del servidor el estado inicial ya resuelto, así que la primera
 * pintada no parpadea: quien llega aquí ya está molesto, y una página que
 * tarda en decidir qué enseñar solo empeora la experiencia.
 */
export default function AppealForm({ inicial, guildId }) {
  const [estado, setEstado] = useState(inicial.estado);
  const [apelacion, setApelacion] = useState(inicial.apelacion);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const caso = inicial.caso;

  async function enviar(evento) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);

    try {
      const respuesta = await fetch(`/api/apelar/${guildId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: texto }),
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        setError(datos.error || 'No se pudo enviar la apelación.');
        return;
      }

      setApelacion(datos.apelacion);
      setEstado('ya_apelada');
    } catch {
      setError('No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  // ── Ya hay una apelación enviada ─────────────────────────────
  if (estado === 'ya_apelada' && apelacion) {
    const meta = ESTADOS[apelacion.status] || ESTADOS.pending;
    const { Icon } = meta;

    return (
      <div>
        <div className={`flex items-start gap-3 rounded-xl border p-5 ${meta.fondo}`}>
          <Icon size={20} className={`mt-0.5 shrink-0 ${meta.color}`} />
          <div>
            <p className={`font-bold ${meta.color}`}>{meta.titulo}</p>
            <p className="mt-1 text-sm text-ink-200">{meta.texto}</p>

            {apelacion.reviewNote && (
              <div className="mt-3 rounded-lg border border-ink-700 bg-ink-900/60 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-400">
                  Respuesta del equipo
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink-100">
                  {apelacion.reviewNote}
                </p>
              </div>
            )}

            {apelacion.sanctionLifted && (
              <p className="mt-3 text-sm font-semibold text-success">
                Se ha levantado la sanción. Ya puedes volver a entrar.
              </p>
            )}
          </div>
        </div>

        <div className="card mt-4 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-400">
            Lo que escribiste · {fecha(apelacion.createdAt)}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-ink-200">{apelacion.text}</p>
        </div>
      </div>
    );
  }

  // ── Estados en los que no se puede apelar ────────────────────
  if (estado !== 'apelable') {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-ink-700 bg-ink-800/60 p-5">
        <TriangleAlert size={20} className="mt-0.5 shrink-0 text-ink-400" />
        <div>
          <p className="font-semibold text-white">No hay nada que apelar</p>
          <p className="mt-1 text-sm text-ink-300">{inicial.mensaje}</p>
        </div>
      </div>
    );
  }

  // ── Formulario ───────────────────────────────────────────────
  const restantes = MAX_TEXTO - texto.length;
  const suficiente = texto.trim().length >= MIN_TEXTO;

  return (
    <div>
      {/* Qué sanción se está apelando */}
      <div className="card mb-5 p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-400">Tu sanción</p>
        <p className="mt-2 text-lg font-bold text-white">
          {caso.tipoLegible}{' '}
          <span className="text-sm font-normal text-ink-400">· caso #{caso.caseId}</span>
        </p>
        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex gap-2">
            <dt className="shrink-0 text-ink-400">Motivo:</dt>
            <dd className="text-ink-100">{caso.reason}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-ink-400">Fecha:</dt>
            <dd className="text-ink-100">{fecha(caso.createdAt)}</dd>
          </div>
        </dl>
      </div>

      {inicial.instrucciones && (
        <div className="mb-5 rounded-lg border border-brand-500/30 bg-brand-500/5 p-4">
          <p className="whitespace-pre-wrap text-sm text-ink-200">{inicial.instrucciones}</p>
        </div>
      )}

      <form onSubmit={enviar}>
        <label htmlFor="apelacion" className="label">
          Explica tu versión
        </label>
        <textarea
          id="apelacion"
          value={texto}
          onChange={(e) => setTexto(e.target.value.slice(0, MAX_TEXTO))}
          rows={8}
          disabled={enviando}
          placeholder="Cuenta qué pasó desde tu punto de vista. Sé concreto y educado: lo va a leer una persona."
          className="input resize-y"
          required
        />

        <div className="mt-1.5 flex items-center justify-between text-xs">
          <span className={suficiente ? 'text-ink-400' : 'text-warning'}>
            {suficiente
              ? 'Se puede enviar'
              : `Faltan ${MIN_TEXTO - texto.trim().length} caracteres`}
          </span>
          <span className={restantes < 100 ? 'text-warning' : 'text-ink-400'}>
            {restantes} restantes
          </span>
        </div>

        <p className="help mt-3">
          Solo puedes apelar una vez, así que tómate tu tiempo. El equipo del servidor verá lo que
          escribas junto a tu nombre de Discord.
        </p>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!suficiente || enviando}
          className="btn-primary mt-5 w-full"
        >
          <Send size={15} />
          {enviando ? 'Enviando…' : 'Enviar apelación'}
        </button>
      </form>
    </div>
  );
}

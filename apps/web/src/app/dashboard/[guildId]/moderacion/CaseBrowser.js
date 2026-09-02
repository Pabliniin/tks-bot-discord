'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Shield,
  Loader,
  TriangleAlert,
  CircleCheck,
  Undo2,
  Gavel,
} from 'lucide-react';

/**
 * Historial de moderación consultable.
 *
 * Buscar el pasado de alguien sin abrir Discord y rebuscar entre mensajes de
 * log es de lo que más agradece un equipo grande, y ninguno de los bots
 * habituales lo ofrece.
 */

/** Color de la etiqueta según lo grave que sea la sanción. */
const COLORES = {
  ban: 'bg-danger/15 text-danger',
  softban: 'bg-danger/15 text-danger',
  kick: 'bg-warning/15 text-warning',
  vkick: 'bg-warning/15 text-warning',
  warn: 'bg-warning/15 text-warning',
  timeout: 'bg-warning/15 text-warning',
  mute: 'bg-warning/15 text-warning',
  vmute: 'bg-warning/15 text-warning',
  automod: 'bg-danger/15 text-danger',
  unban: 'bg-success/15 text-success',
  untimeout: 'bg-success/15 text-success',
  unmute: 'bg-success/15 text-success',
  vunmute: 'bg-success/15 text-success',
};

function cuando(valor) {
  return new Date(valor).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Duración en milisegundos a texto corto. */
function duracion(ms) {
  if (!ms) return null;
  const minutos = Math.round(ms / 60000);
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `${horas} h`;
  return `${Math.round(horas / 24)} días`;
}

export default function CaseBrowser({ guildId }) {
  const [consulta, setConsulta] = useState('');
  const [tipo, setTipo] = useState('');
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState(null);
  const [actuando, setActuando] = useState(null);

  const buscar = useCallback(
    async (texto, filtroTipo) => {
      setCargando(true);
      try {
        const parametros = new URLSearchParams();
        if (texto) parametros.set('usuario', texto);
        if (filtroTipo) parametros.set('tipo', filtroTipo);

        const respuesta = await fetch(`/api/guilds/${guildId}/cases?${parametros}`);
        const cuerpo = await respuesta.json();

        if (!respuesta.ok) {
          setAviso({ tipo: 'error', texto: cuerpo.error });
          return;
        }
        setDatos(cuerpo);
      } catch {
        setAviso({ tipo: 'error', texto: 'No se pudo cargar el historial.' });
      } finally {
        setCargando(false);
      }
    },
    [guildId]
  );

  // Espera a que se deje de escribir antes de consultar.
  useEffect(() => {
    const temporizador = setTimeout(() => buscar(consulta.trim(), tipo), 350);
    return () => clearTimeout(temporizador);
  }, [consulta, tipo, buscar]);

  async function cambiarAviso(caso, activa) {
    setActuando(caso.caseId);
    setAviso(null);

    try {
      const respuesta = await fetch(`/api/guilds/${guildId}/cases`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: caso.caseId, active: activa }),
      });
      const cuerpo = await respuesta.json();

      if (!respuesta.ok) {
        setAviso({ tipo: 'error', texto: cuerpo.error });
        return;
      }

      setAviso({
        tipo: 'exito',
        texto: activa
          ? `Advertencia #${caso.caseId} repuesta.`
          : `Advertencia #${caso.caseId} retirada. Ya no cuenta para el total.`,
      });
      await buscar(consulta.trim(), tipo);
    } catch {
      setAviso({ tipo: 'error', texto: 'No se pudo actualizar la advertencia.' });
    } finally {
      setActuando(null);
    }
  }

  const tipos = datos?.tipos || {};

  return (
    <div>
      {/* ── Buscador ─────────────────────────────────────────── */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <input
            type="search"
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            placeholder="Nombre o ID de usuario…"
            className="input pl-9"
            aria-label="Buscar en el historial de moderación"
          />
        </div>

        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="input sm:w-52"
          aria-label="Filtrar por tipo de sanción"
        >
          <option value="">Todas las sanciones</option>
          {Object.entries(tipos).map(([id, etiqueta]) => (
            <option key={id} value={id}>
              {etiqueta}
            </option>
          ))}
        </select>
      </div>

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

      {/* ── Ficha del usuario buscado ────────────────────────── */}
      {datos?.resumen && (
        <div className="card mb-4 flex flex-wrap items-center gap-4 p-4">
          {datos.resumen.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={datos.resumen.avatar} alt="" className="h-12 w-12 rounded-full" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-700 text-sm font-bold">
              ?
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="font-semibold text-white">
              {datos.resumen.nombre || 'Usuario desconocido'}
              {datos.resumen.sigueEnElServidor === false && (
                <span className="badge ml-2 bg-ink-700 text-[10px] text-ink-300">
                  ya no está
                </span>
              )}
            </p>
            <p className="font-mono text-xs text-ink-400">{datos.resumen.userId}</p>
          </div>

          <dl className="flex gap-5 text-center">
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-ink-400">Sanciones</dt>
              <dd className="text-xl font-black text-white">{datos.resumen.totalCasos}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-ink-400">Avisos</dt>
              <dd
                className={`text-xl font-black ${
                  datos.resumen.avisosActivos > 0 ? 'text-warning' : 'text-white'
                }`}
              >
                {datos.resumen.avisosActivos}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* ── Lista de casos ───────────────────────────────────── */}
      {cargando && !datos ? (
        <div className="card flex items-center justify-center gap-2 p-10 text-sm text-ink-400">
          <Loader size={16} className="animate-spin" />
          Cargando…
        </div>
      ) : !datos || datos.casos.length === 0 ? (
        <div className="card p-10 text-center">
          <Shield size={32} className="mx-auto mb-3 text-ink-600" />
          <p className="font-semibold text-white">
            {consulta ? 'Sin resultados' : 'No hay sanciones registradas'}
          </p>
          <p className="mt-1 text-sm text-ink-400">
            {consulta
              ? 'Prueba con el ID del usuario, que es exacto.'
              : 'Cuando tu equipo sancione a alguien, aparecerá aquí.'}
          </p>
        </div>
      ) : (
        <>
          <p className="mb-2 text-xs text-ink-400">
            {datos.total} caso{datos.total === 1 ? '' : 's'}
            {datos.hayMas && ` · se muestran los ${datos.casos.length} más recientes`}
          </p>

          <ul className="space-y-2">
            {datos.casos.map((caso) => (
              <li
                key={caso.caseId}
                className={`card p-4 ${caso.type === 'warn' && !caso.active ? 'opacity-60' : ''}`}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <span className="mt-0.5 shrink-0 font-mono text-xs text-ink-500">
                    #{caso.caseId}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className={`badge ${COLORES[caso.type] || 'bg-ink-700 text-ink-200'}`}>
                        {caso.tipoLegible}
                      </span>

                      {caso.duration && (
                        <span className="text-xs text-ink-400">{duracion(caso.duration)}</span>
                      )}

                      {caso.type === 'warn' && !caso.active && (
                        <span className="badge bg-ink-700 text-[10px] text-ink-300">retirada</span>
                      )}
                    </p>

                    <p className="mt-1.5 text-sm text-white">
                      <strong>{caso.userNombre}</strong>
                      <span className="text-ink-400"> · por {caso.moderatorNombre}</span>
                    </p>

                    <p className="mt-0.5 text-sm text-ink-200">{caso.reason}</p>
                    <p className="mt-1 text-xs text-ink-500">{cuando(caso.createdAt)}</p>
                  </div>

                  {/* Solo las advertencias se retiran desde aquí. */}
                  {caso.type === 'warn' && (
                    <button
                      type="button"
                      onClick={() => cambiarAviso(caso, !caso.active)}
                      disabled={actuando === caso.caseId}
                      className="btn-ghost shrink-0 px-2.5 py-1.5 text-xs"
                    >
                      {actuando === caso.caseId ? (
                        <Loader size={13} className="animate-spin" />
                      ) : caso.active ? (
                        <Undo2 size={13} />
                      ) : (
                        <Gavel size={13} />
                      )}
                      {caso.active ? 'Retirar' : 'Reponer'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

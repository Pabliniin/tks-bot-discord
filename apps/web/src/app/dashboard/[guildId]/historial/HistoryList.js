'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  History,
  Undo2,
  ChevronDown,
  TriangleAlert,
  CircleCheck,
  Loader,
  RotateCcw,
} from 'lucide-react';

import { compararCambios, nombreDeModulo } from '@/lib/configHistory';

/**
 * Historial de cambios con botón de deshacer.
 *
 * En un servidor con varios administradores es la diferencia entre poder
 * auditar una configuración rota y tener que adivinar quién la tocó. Ningún
 * competidor directo lo ofrece.
 */

/** Fecha y hora legibles. */
function cuando(valor) {
  const fecha = new Date(valor);
  const hoy = new Date();
  const ayer = new Date(hoy.getTime() - 86_400_000);

  const hora = fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  if (fecha.toDateString() === hoy.toDateString()) return `Hoy a las ${hora}`;
  if (fecha.toDateString() === ayer.toDateString()) return `Ayer a las ${hora}`;

  return `${fecha.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: fecha.getFullYear() === hoy.getFullYear() ? undefined : 'numeric',
  })} · ${hora}`;
}

/** Convierte un valor cualquiera en algo legible de un vistazo. */
function legible(valor) {
  if (valor === null || valor === undefined) return 'sin valor';
  if (valor === true) return 'activado';
  if (valor === false) return 'desactivado';
  if (Array.isArray(valor)) return valor.length === 0 ? 'lista vacía' : `${valor.length} elementos`;
  if (typeof valor === 'object') return 'varios valores';

  const texto = String(valor);
  if (texto.length === 0) return 'vacío';
  return texto.length > 60 ? `${texto.slice(0, 60)}…` : texto;
}

export default function HistoryList({ guildId }) {
  const router = useRouter();

  const [entradas, setEntradas] = useState([]);
  const [pagina, setPagina] = useState(0);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [desplegada, setDesplegada] = useState(null);
  const [deshaciendo, setDeshaciendo] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const [aviso, setAviso] = useState(null);

  const cargar = useCallback(
    async (nuevaPagina, acumular) => {
      setCargando(true);
      try {
        const respuesta = await fetch(`/api/guilds/${guildId}/history?pagina=${nuevaPagina}`);
        const datos = await respuesta.json();

        if (!respuesta.ok) {
          setAviso({ tipo: 'error', texto: datos.error });
          return;
        }

        setEntradas((previas) => (acumular ? [...previas, ...datos.entradas] : datos.entradas));
        setHayMas(datos.hayMas);
        setPagina(datos.pagina);
      } catch {
        setAviso({ tipo: 'error', texto: 'No se pudo cargar el historial.' });
      } finally {
        setCargando(false);
      }
    },
    [guildId]
  );

  useEffect(() => {
    cargar(0, false);
  }, [cargar]);

  async function deshacer(entrada) {
    setDeshaciendo(entrada.id);
    setConfirmar(null);
    setAviso(null);

    try {
      const respuesta = await fetch(`/api/guilds/${guildId}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entrada.id }),
      });
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        setAviso({ tipo: 'error', texto: datos.error });
        return;
      }

      setAviso({ tipo: 'exito', texto: `Cambio deshecho: ${entrada.summary}` });
      // Se recarga desde el principio: deshacer añade su propia entrada arriba.
      await cargar(0, false);
      router.refresh();
    } catch {
      setAviso({ tipo: 'error', texto: 'No se pudo deshacer el cambio.' });
    } finally {
      setDeshaciendo(null);
    }
  }

  if (cargando && entradas.length === 0) {
    return (
      <div className="card flex items-center justify-center gap-2 p-10 text-sm text-ink-400">
        <Loader size={16} className="animate-spin" />
        Cargando el historial…
      </div>
    );
  }

  if (entradas.length === 0) {
    return (
      <div className="card p-10 text-center">
        <History size={32} className="mx-auto mb-3 text-ink-600" />
        <p className="font-semibold text-white">Todavía no hay cambios registrados</p>
        <p className="mt-1 text-sm text-ink-400">
          A partir de ahora, cada vez que alguien guarde algo en el panel quedará anotado aquí.
        </p>
      </div>
    );
  }

  return (
    <div>
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

      <ol className="space-y-2">
        {entradas.map((entrada) => {
          const abierta = desplegada === entrada.id;
          const comparacion = abierta ? compararCambios(entrada.changes, entrada.previous) : [];

          return (
            <li key={entrada.id} className="card overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                    {entrada.revert && (
                      <span className="badge bg-ink-700 text-ink-200">
                        <RotateCcw size={10} /> deshacer
                      </span>
                    )}
                    {entrada.summary}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {entrada.userTag ? (
                      <>
                        Por <strong className="text-ink-200">{entrada.userTag}</strong>
                      </>
                    ) : (
                      <>Por un usuario desconocido</>
                    )}{' '}
                    · {cuando(entrada.createdAt)}
                  </p>
                </div>

                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDesplegada(abierta ? null : entrada.id)}
                    className="btn-ghost px-2.5 py-1.5 text-xs"
                    aria-expanded={abierta}
                  >
                    <ChevronDown
                      size={13}
                      className={`transition-transform ${abierta ? 'rotate-180' : ''}`}
                    />
                    Ver
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirmar(entrada.id)}
                    disabled={deshaciendo === entrada.id}
                    className="btn-secondary px-2.5 py-1.5 text-xs"
                  >
                    {deshaciendo === entrada.id ? (
                      <Loader size={13} className="animate-spin" />
                    ) : (
                      <Undo2 size={13} />
                    )}
                    Deshacer
                  </button>
                </div>
              </div>

              {/* Confirmación */}
              {confirmar === entrada.id && (
                <div className="border-t border-warning/30 bg-warning/10 px-4 py-3">
                  <p className="text-xs text-warning">
                    Se volverán a poner los valores que había antes de este cambio. Todo lo que se
                    haya tocado después en esos mismos campos se perderá.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => deshacer(entrada)}
                      className="btn-primary px-2.5 py-1 text-xs"
                    >
                      Sí, deshacer
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmar(null)}
                      className="btn-ghost px-2.5 py-1 text-xs"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Detalle antes → después */}
              {abierta && (
                <div className="border-t border-ink-700/60 bg-ink-900/40 px-4 py-3">
                  {comparacion.length === 0 ? (
                    <p className="text-xs text-ink-400">Sin detalle disponible.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-ink-400">
                          <th className="pb-1.5 font-semibold">Ajuste</th>
                          <th className="pb-1.5 font-semibold">Antes</th>
                          <th className="pb-1.5 font-semibold">Después</th>
                        </tr>
                      </thead>
                      <tbody className="align-top">
                        {comparacion.slice(0, 40).map(({ ruta, antes, despues }) => (
                          <tr key={ruta} className="border-t border-ink-700/40">
                            <td className="py-1.5 pr-3 font-mono text-ink-300">
                              {nombreDeModulo(ruta.split('.')[0])}
                              <span className="text-ink-500">
                                {ruta.includes('.') ? `.${ruta.split('.').slice(1).join('.')}` : ''}
                              </span>
                            </td>
                            <td className="py-1.5 pr-3 text-ink-400">{legible(antes)}</td>
                            <td className="py-1.5 font-medium text-ink-100">{legible(despues)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {comparacion.length > 40 && (
                    <p className="mt-2 text-xs text-ink-500">
                      y {comparacion.length - 40} cambios más
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {hayMas && (
        <button
          type="button"
          onClick={() => cargar(pagina + 1, true)}
          disabled={cargando}
          className="btn-secondary mt-4 w-full"
        >
          {cargando ? <Loader size={15} className="animate-spin" /> : null}
          {cargando ? 'Cargando…' : 'Ver más cambios'}
        </button>
      )}
    </div>
  );
}

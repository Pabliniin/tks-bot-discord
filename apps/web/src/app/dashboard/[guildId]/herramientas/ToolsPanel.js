'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Download,
  Upload,
  LayoutTemplate,
  TriangleAlert,
  CircleCheck,
  Crown,
  Loader,
} from 'lucide-react';

/**
 * Copias de seguridad y plantillas.
 *
 * Dos cosas que ningún competidor directo ofrece y que ahorran horas a quien
 * administra más de un servidor: llevarse la configuración de uno a otro, y
 * partir de un montaje sensato en vez de recorrer quince módulos en blanco.
 */
export default function ToolsPanel({ guildId, plantillas, tier }) {
  const router = useRouter();
  const archivoRef = useRef(null);

  const [ocupado, setOcupado] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [confirmar, setConfirmar] = useState(null);

  /** Descarga la copia en el modo indicado. */
  function descargar(modo) {
    setAviso(null);
    // Se navega directamente: el servidor responde con Content-Disposition y
    // el navegador lo guarda sin salir de la página.
    window.location.href = `/api/guilds/${guildId}/backup?modo=${modo}`;
  }

  /** Lee el archivo elegido y lo manda al servidor. */
  async function importar(evento) {
    const archivo = evento.target.files?.[0];
    // El input se limpia siempre: si no, elegir el mismo archivo dos veces
    // seguidas no dispararía el evento la segunda.
    evento.target.value = '';
    if (!archivo) return;

    setOcupado('importar');
    setAviso(null);

    try {
      const texto = await archivo.text();

      let contenido;
      try {
        contenido = JSON.parse(texto);
      } catch {
        setAviso({ tipo: 'error', texto: 'Ese archivo no es un JSON válido.' });
        return;
      }

      const respuesta = await fetch(`/api/guilds/${guildId}/backup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup: contenido }),
      });
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        setAviso({
          tipo: 'error',
          texto: datos.details?.length ? `${datos.error} ${datos.details.join(' · ')}` : datos.error,
        });
        return;
      }

      setAviso({
        tipo: 'exito',
        texto: datos.requiereRevision
          ? 'Configuración importada. Como era una copia portable, revisa los canales y roles: han quedado sin asignar.'
          : 'Configuración importada y aplicada.',
      });
      router.refresh();
    } catch {
      setAviso({ tipo: 'error', texto: 'No se pudo leer el archivo.' });
    } finally {
      setOcupado(null);
    }
  }

  /** Aplica una plantilla tras confirmar. */
  async function aplicar(plantilla) {
    setOcupado(plantilla.id);
    setAviso(null);
    setConfirmar(null);

    try {
      const respuesta = await fetch(`/api/guilds/${guildId}/template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: plantilla.id }),
      });
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        setAviso({ tipo: 'error', texto: datos.error });
        return;
      }

      setAviso({
        tipo: 'exito',
        texto: `Plantilla «${plantilla.nombre}» aplicada.`,
        pendientes: datos.plantilla?.pendientes || [],
      });
      router.refresh();
    } catch {
      setAviso({ tipo: 'error', texto: 'No se pudo aplicar la plantilla.' });
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Aviso del resultado ──────────────────────────────── */}
      {aviso && (
        <div
          className={`flex items-start gap-3 rounded-lg border p-4 ${
            aviso.tipo === 'error'
              ? 'border-danger/30 bg-danger/10'
              : 'border-success/30 bg-success/10'
          }`}
          role="status"
        >
          {aviso.tipo === 'error' ? (
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-danger" />
          ) : (
            <CircleCheck size={18} className="mt-0.5 shrink-0 text-success" />
          )}
          <div className={`text-sm ${aviso.tipo === 'error' ? 'text-danger' : 'text-success'}`}>
            <p className="font-semibold">{aviso.texto}</p>

            {aviso.pendientes?.length > 0 && (
              <>
                <p className="mt-2 font-semibold text-ink-100">Te queda por hacer:</p>
                <ul className="mt-1 space-y-0.5 text-ink-200">
                  {aviso.pendientes.map((p) => (
                    <li key={p}>· {p}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Copias de seguridad ──────────────────────────────── */}
      <section className="card p-5">
        <h2 className="flex items-center gap-2 text-base font-bold text-white">
          <Download size={17} className="text-brand-400" />
          Copia de seguridad
        </h2>
        <p className="mt-1 text-sm text-ink-300">
          Guarda toda la configuración en un archivo. Sirve para volver atrás si algo se rompe, o
          para montar otro servidor igual que este.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => descargar('completa')}
            className="rounded-lg border border-ink-700 bg-ink-900/50 p-4 text-left transition-colors hover:border-brand-500/50"
          >
            <p className="font-semibold text-white">Copia completa</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-300">
              Incluye los canales y roles tal cual. Úsala para restaurar{' '}
              <strong>este mismo servidor</strong>.
            </p>
          </button>

          <button
            type="button"
            onClick={() => descargar('portable')}
            className="rounded-lg border border-ink-700 bg-ink-900/50 p-4 text-left transition-colors hover:border-brand-500/50"
          >
            <p className="font-semibold text-white">Copia portable</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-300">
              Quita los canales y roles, que no existen fuera de aquí. Úsala para llevártela a{' '}
              <strong>otro servidor</strong>.
            </p>
          </button>
        </div>

        <div className="mt-5 border-t border-ink-700/60 pt-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <Upload size={15} className="text-brand-400" />
            Restaurar desde un archivo
          </h3>
          <p className="mt-1 text-xs text-ink-300">
            Se sobrescribirá la configuración actual, pero queda anotada en el historial: puedes
            deshacerlo con un clic.
          </p>

          <input
            ref={archivoRef}
            type="file"
            accept="application/json,.json"
            onChange={importar}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => archivoRef.current?.click()}
            disabled={ocupado === 'importar'}
            className="btn-secondary mt-3"
          >
            {ocupado === 'importar' ? (
              <Loader size={15} className="animate-spin" />
            ) : (
              <Upload size={15} />
            )}
            {ocupado === 'importar' ? 'Importando…' : 'Elegir archivo'}
          </button>
        </div>
      </section>

      {/* ── Plantillas ───────────────────────────────────────── */}
      <section className="card p-5">
        <h2 className="flex items-center gap-2 text-base font-bold text-white">
          <LayoutTemplate size={17} className="text-brand-400" />
          Plantillas
        </h2>
        <p className="mt-1 text-sm text-ink-300">
          Configura el bot de golpe según el tipo de servidor. Puedes ajustarlo todo después, y
          deshacerlo entero desde el historial.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {plantillas.map((plantilla) => {
            const bloqueada = plantilla.premium && tier === 0;
            const cargando = ocupado === plantilla.id;

            return (
              <div key={plantilla.id} className="rounded-lg border border-ink-700 bg-ink-900/50 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex items-center gap-2 font-semibold text-white">
                    <span className="text-lg">{plantilla.icono}</span>
                    {plantilla.nombre}
                  </p>
                  {plantilla.premium && (
                    <Crown size={13} className="mt-1 shrink-0 text-warning" />
                  )}
                </div>

                <p className="mt-1.5 text-xs leading-relaxed text-ink-300">
                  {plantilla.descripcion}
                </p>

                <ul className="mt-2.5 space-y-0.5">
                  {plantilla.destacados.map((d) => (
                    <li key={d} className="text-xs text-ink-400">
                      · {d}
                    </li>
                  ))}
                </ul>

                {confirmar === plantilla.id ? (
                  <div className="mt-3 rounded-md border border-warning/30 bg-warning/10 p-2.5">
                    <p className="text-xs text-warning">
                      Se sobrescribirán los módulos que toca esta plantilla. ¿Seguro?
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => aplicar(plantilla)}
                        className="btn-primary px-2.5 py-1 text-xs"
                      >
                        Sí, aplicar
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
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmar(plantilla.id)}
                    disabled={bloqueada || cargando}
                    title={bloqueada ? 'Esta plantilla necesita TK$ Premium' : undefined}
                    className="btn-secondary mt-3 w-full py-1.5 text-xs"
                  >
                    {cargando && <Loader size={13} className="animate-spin" />}
                    {bloqueada ? 'Necesita Premium' : cargando ? 'Aplicando…' : 'Aplicar plantilla'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

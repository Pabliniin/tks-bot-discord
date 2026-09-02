'use client';

import { useState, useEffect, useRef } from 'react';
import { FlaskConical, ShieldCheck, ShieldAlert, Paperclip, Info } from 'lucide-react';

import { useGuildData } from './GuildDataContext';

/**
 * Simulador de AutoMod.
 *
 * Escribes un mensaje y dice qué haría el bot, sin tocar Discord ni sancionar
 * a nadie. Prueba la configuración que hay en pantalla **aunque no esté
 * guardada**, que es justo lo que hace falta para no activar un filtro a ciegas.
 *
 * Es la queja más repetida sobre los automod de la competencia: se encienden
 * sin poder probarlos, castigan a quien no tocaba, y hay que apagarlos con
 * prisa y disculpas.
 */

/** Ejemplos que disparan filtros habituales, para probar de un clic. */
const EJEMPLOS = [
  { etiqueta: 'Invitación', texto: 'Éntrate a mi server discord.gg/ejemplo123' },
  { etiqueta: 'Enlace', texto: 'Mirad esto https://ejemplo.com/cosas' },
  { etiqueta: 'Mayúsculas', texto: 'HOLA A TODOS QUÉ TAL ESTÁIS' },
  { etiqueta: 'Menciones', texto: '@everyone <@111111111111111111> <@222222222222222222> mirad' },
  { etiqueta: 'Normal', texto: 'Buenas, ¿alguien sabe cuándo es el evento?' },
];

export default function AutomodSimulator({ settings }) {
  // El contexto ya entrega los canales aplanados, no el `guildData` en bruto.
  const { guildId, channels: todosLosCanales } = useGuildData();

  const [texto, setTexto] = useState('');
  const [canalId, setCanalId] = useState('');
  const [conAdjunto, setConAdjunto] = useState(false);
  const [comoModerador, setComoModerador] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  // Evita que una respuesta lenta pise a otra más reciente al teclear rápido.
  const peticionRef = useRef(0);

  // Solo canales de texto y de anuncios: en los demás no se escribe.
  const canales = (todosLosCanales || []).filter((c) => [0, 5].includes(c.type));

  useEffect(() => {
    if (texto.trim().length === 0) {
      setResultado(null);
      setError(null);
      return undefined;
    }

    // Se espera a que se deje de escribir: una petición por tecla sería absurdo.
    const temporizador = setTimeout(async () => {
      const id = ++peticionRef.current;
      setCargando(true);
      setError(null);

      try {
        const respuesta = await fetch(`/api/guilds/${guildId}/simulate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: texto,
            channelId: canalId || null,
            isModerator: comoModerador,
            hasAttachment: conAdjunto,
            // Se manda la configuración de la pantalla, no la guardada: así se
            // puede probar un cambio antes de decidir si guardarlo.
            borrador: { automod: settings.automod },
          }),
        });

        const datos = await respuesta.json();
        if (id !== peticionRef.current) return; // Llegó tarde: ya hay otra.

        if (!respuesta.ok) {
          setError(datos.error || 'No se pudo simular.');
          setResultado(null);
          return;
        }
        setResultado(datos);
      } catch {
        if (id === peticionRef.current) setError('No se pudo conectar con el servidor.');
      } finally {
        if (id === peticionRef.current) setCargando(false);
      }
    }, 400);

    return () => clearTimeout(temporizador);
  }, [texto, canalId, comoModerador, conAdjunto, settings.automod, guildId]);

  return (
    <div className="rounded-xl border border-brand-500/30 bg-brand-500/[0.03] p-5">
      <div className="mb-4 flex items-start gap-2.5">
        <FlaskConical size={18} className="mt-0.5 shrink-0 text-brand-400" />
        <div>
          <p className="font-bold text-white">Probar un mensaje</p>
          <p className="mt-0.5 text-sm text-ink-300">
            Escribe algo y verás qué haría el bot. No se envía nada a Discord ni se sanciona a
            nadie. Prueba la configuración de esta pantalla, aunque no la hayas guardado.
          </p>
        </div>
      </div>

      {/* ── Ejemplos rápidos ─────────────────────────────────── */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {EJEMPLOS.map((ejemplo) => (
          <button
            key={ejemplo.etiqueta}
            type="button"
            onClick={() => setTexto(ejemplo.texto)}
            className="rounded-md bg-ink-700 px-2 py-1 text-xs font-medium text-ink-200 transition-colors hover:bg-ink-600 hover:text-white"
          >
            {ejemplo.etiqueta}
          </button>
        ))}
      </div>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value.slice(0, 2000))}
        rows={3}
        placeholder="Escribe aquí el mensaje que quieres probar…"
        className="input resize-y font-mono text-sm"
        aria-label="Mensaje de prueba"
      />

      {/* ── Condiciones de la prueba ─────────────────────────── */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {canales.length > 0 && (
          <select
            value={canalId}
            onChange={(e) => setCanalId(e.target.value)}
            className="input w-auto py-1.5 text-xs"
            aria-label="Canal donde se enviaría"
          >
            <option value="">En cualquier canal</option>
            {canales.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </select>
        )}

        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-200">
          <input
            type="checkbox"
            checked={comoModerador}
            onChange={(e) => setComoModerador(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-ink-600 bg-ink-900 text-brand-500"
          />
          Lo escribe un moderador
        </label>

        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-200">
          <input
            type="checkbox"
            checked={conAdjunto}
            onChange={(e) => setConAdjunto(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-ink-600 bg-ink-900 text-brand-500"
          />
          <Paperclip size={11} />
          Con archivo adjunto
        </label>
      </div>

      {/* ── Resultado ────────────────────────────────────────── */}
      <div className="mt-4" aria-live="polite">
        {error && (
          <p className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            {error}
          </p>
        )}

        {cargando && !resultado && <p className="text-sm text-ink-400">Comprobando…</p>}

        {resultado && <Resultado datos={resultado} atenuado={cargando} />}
      </div>
    </div>
  );
}

/** Pinta el veredicto de la simulación. */
function Resultado({ datos, atenuado }) {
  const { bloqueado, resultado, coincidencias, noEvaluados, exento, motivoExencion, moduloActivo } =
    datos;

  return (
    <div className={atenuado ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
      {/* Veredicto principal */}
      {bloqueado ? (
        <div className="rounded-lg border border-danger/40 bg-danger/10 p-4">
          <p className="flex items-center gap-2 font-bold text-danger">
            <ShieldAlert size={17} />
            El bot actuaría sobre este mensaje
          </p>

          <div className="mt-3 space-y-1 text-sm">
            <p className="text-ink-100">
              <span className="text-ink-400">Filtro:</span>{' '}
              <strong className="text-white">{resultado.motivo}</strong>
            </p>
            <p className="text-ink-100">
              <span className="text-ink-400">Haría esto:</span> {resultado.descripcion}
            </p>

            {!resultado.sancionaAlPrimero && (
              <p className="text-warning">
                Con la primera vez solo borraría el mensaje: la sanción llega a la{' '}
                {resultado.umbral}.ª infracción seguida.
              </p>
            )}

            {resultado.avisoEnCanal && (
              <p className="text-ink-300">
                Le respondería en el canal: «{resultado.avisoEnCanal}»
              </p>
            )}
          </div>
        </div>
      ) : exento ? (
        <div className="rounded-lg border border-ink-600 bg-ink-800/60 p-4">
          <p className="flex items-center gap-2 font-bold text-ink-100">
            <Info size={17} className="text-ink-400" />
            El AutoMod ni siquiera lo revisaría
          </p>
          <p className="mt-1.5 text-sm text-ink-300">{motivoExencion}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-success/30 bg-success/10 p-4">
          <p className="flex items-center gap-2 font-bold text-success">
            <ShieldCheck size={17} />
            Este mensaje pasaría sin problema
          </p>
          <p className="mt-1.5 text-sm text-ink-300">
            {moduloActivo
              ? `Ninguno de los ${datos.filtrosActivos} filtros activos se incumple.`
              : motivoExencion}
          </p>
        </div>
      )}

      {/* Otros filtros que también saltarían */}
      {coincidencias.length > 1 && (
        <div className="mt-3 rounded-lg border border-ink-700 bg-ink-900/50 p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-400">
            También incumple, pero manda el de arriba
          </p>
          <ul className="mt-1.5 space-y-0.5 text-sm text-ink-300">
            {coincidencias.slice(1).map((c) => (
              <li key={c.id}>· {c.motivo}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Filtros que no se pueden probar con un solo mensaje */}
      {noEvaluados.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-ink-700 bg-ink-900/50 p-3">
          <Info size={14} className="mt-0.5 shrink-0 text-ink-400" />
          <div className="text-xs text-ink-300">
            <p className="font-semibold text-ink-200">No se pueden probar aquí:</p>
            <ul className="mt-1 space-y-0.5">
              {noEvaluados.map((n) => (
                <li key={n.id}>· {n.motivo}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

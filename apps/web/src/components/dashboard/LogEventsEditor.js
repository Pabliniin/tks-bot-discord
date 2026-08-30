'use client';

// JSON de constantes: sin mongoose y compatible con los componentes de cliente.
// Se importa por defecto y se desestructura: webpack no admite imports con
// nombre sobre las claves de un JSON.
import constants from '@tkbot/shared/src/constants.json';

const { LOG_EVENTS } = constants;

import { Toggle, SearchSelect } from './controls';
import { useGuildData } from './GuildDataContext';

/**
 * Editor de los eventos del módulo de Logs.
 *
 * En la base de datos es un `Map`, pero al llegar al navegador viaja como
 * objeto plano `{ messageDelete: { enabled, channelId }, … }`.
 */
export default function LogEventsEditor({ value, onChange }) {
  const { channels } = useGuildData();
  const events = value && typeof value === 'object' ? value : {};

  const channelItems = channels
    .filter((c) => [0, 5].includes(c.type))
    .map((c) => ({ value: c.id, label: c.name, type: c.type }));

  const update = (eventId, patch) => {
    onChange({
      ...events,
      [eventId]: { ...(events[eventId] || {}), ...patch },
    });
  };

  const setAll = (enabled) => {
    const next = { ...events };
    for (const event of LOG_EVENTS) {
      next[event.id] = { ...(next[event.id] || {}), enabled };
    }
    onChange(next);
  };

  const activeCount = LOG_EVENTS.filter((e) => events[e.id]?.enabled).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-300">
          <span className="font-semibold text-ink-50">{activeCount}</span> de {LOG_EVENTS.length}{' '}
          eventos activos
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setAll(true)} className="btn-secondary px-2.5 py-1 text-xs">
            Activar todos
          </button>
          <button type="button" onClick={() => setAll(false)} className="btn-ghost px-2.5 py-1 text-xs">
            Desactivar todos
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {LOG_EVENTS.map((event) => {
          const config = events[event.id] || {};

          return (
            <div
              key={event.id}
              className="flex flex-col gap-3 rounded-lg border border-ink-700 bg-ink-900/50 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <Toggle
                value={config.enabled}
                onChange={(enabled) => update(event.id, { enabled })}
                label={event.es}
              />

              {config.enabled && (
                <div className="w-full sm:w-64">
                  <SearchSelect
                    value={config.channelId || null}
                    onChange={(channelId) => update(event.id, { channelId })}
                    items={channelItems}
                    placeholder="Canal por defecto"
                    emptyLabel="Usar el canal por defecto"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

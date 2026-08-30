'use client';

import { useState } from 'react';
import { Plus, Trash2, ChevronDown, Send, Lock } from 'lucide-react';

import Field from './Field';
import { useGuildData } from './GuildDataContext';
import { generateId } from '@/lib/objectPath';

/**
 * Editor de listas repetibles: respuestas automáticas, embeds guardados,
 * paneles de roles, recompensas por nivel…
 *
 * Cada elemento se despliega para editar sus campos y, si el esquema declara
 * `publishAction`, muestra un botón para publicarlo en Discord.
 */

/** Valor inicial de un campo recién creado. */
function defaultValue(field) {
  switch (field.type) {
    case 'toggle':
      return field.key === 'enabled' || field.key === 'required';
    case 'number':
      return field.min ?? 0;
    case 'select':
      return field.options?.[0]?.value ?? '';
    case 'color':
      return '#5865F2';
    case 'channels':
    case 'roles':
    case 'tags':
    case 'list':
      return [];
    case 'channel':
    case 'role':
      return null;
    case 'embed':
      return { enabled: true, color: '#5865F2', fields: [] };
    default:
      return '';
  }
}

/** Crea un elemento nuevo con todos sus campos inicializados. */
function createItem(itemFields) {
  const item = { id: generateId() };
  for (const field of itemFields) {
    item[field.key] = defaultValue(field);
  }
  return item;
}

export default function ListEditor({ field, value, onChange, settings }) {
  const [openIndex, setOpenIndex] = useState(null);
  const [publishing, setPublishing] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const { premium, guildId, roles } = useGuildData();
  const items = Array.isArray(value) ? value : [];

  // Límite según el plan del servidor, o el máximo fijo del esquema.
  const limit = field.limitKey ? premium.limits?.[field.limitKey] : field.max;
  const atLimit = typeof limit === 'number' && items.length >= limit;

  const add = () => {
    if (atLimit) return;
    onChange([...items, createItem(field.itemFields)]);
    setOpenIndex(items.length);
  };

  const update = (index, key, newValue) => {
    onChange(items.map((item, i) => (i === index ? { ...item, [key]: newValue } : item)));
  };

  const remove = (index) => {
    onChange(items.filter((_, i) => i !== index));
    setOpenIndex(null);
  };

  /** Pide al bot que publique este elemento en Discord. */
  const publish = async (item, index) => {
    setPublishing(index);
    setFeedback(null);

    try {
      const response = await fetch(`/api/guilds/${guildId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: field.publishAction, id: item.id }),
      });
      const data = await response.json();

      setFeedback(
        response.ok
          ? { type: 'success', text: 'Publicado en Discord correctamente.' }
          : { type: 'error', text: data.error || 'No se ha podido publicar.' }
      );
    } catch {
      setFeedback({ type: 'error', text: 'No se ha podido contactar con el servidor.' });
    } finally {
      setPublishing(null);
    }
  };

  /** Etiqueta visible de cada elemento en la lista. */
  const labelFor = (item, index) => {
    const raw = item?.[field.itemLabel];
    if (raw === undefined || raw === null || raw === '') return `Elemento ${index + 1}`;

    // Los identificadores de rol se muestran con su nombre real.
    if (field.itemLabel === 'roleId') {
      const role = roles.find((r) => r.id === raw);
      return role ? role.name : `Rol ${raw}`;
    }
    return `${field.itemLabelPrefix || ''}${raw}`;
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="label mb-0">
          {field.label}
          {typeof limit === 'number' && (
            <span className="ml-2 text-xs font-normal text-ink-400">
              {items.length} / {limit}
            </span>
          )}
        </span>

        <button
          type="button"
          onClick={add}
          disabled={atLimit}
          className="btn-secondary px-2.5 py-1 text-xs"
          title={atLimit ? 'Has alcanzado el límite de tu plan' : undefined}
        >
          {atLimit ? <Lock size={13} /> : <Plus size={13} />}
          {field.addLabel || 'Añadir'}
        </button>
      </div>

      {atLimit && field.limitKey && (
        <p className="mb-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          Has llegado al límite de tu plan ({limit}). Amplía a Premium para añadir más.
        </p>
      )}

      {feedback && (
        <p
          className={`mb-2 rounded-lg px-3 py-2 text-xs ${
            feedback.type === 'success'
              ? 'border border-success/30 bg-success/10 text-success'
              : 'border border-danger/30 bg-danger/10 text-danger'
          }`}
        >
          {feedback.text}
        </p>
      )}

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink-700 px-4 py-8 text-center text-sm text-ink-400">
          Todavía no hay nada aquí. Pulsa «{field.addLabel || 'Añadir'}» para empezar.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => {
            const open = openIndex === index;

            return (
              <div
                key={item.id || index}
                className="overflow-hidden rounded-lg border border-ink-700 bg-ink-900/50"
              >
                <div className="flex items-center gap-1 px-1">
                  <button
                    type="button"
                    onClick={() => setOpenIndex(open ? null : index)}
                    className="flex flex-1 items-center justify-between gap-2 px-3 py-3 text-left"
                    aria-expanded={open}
                  >
                    <span className="truncate text-sm font-medium text-ink-50">
                      {labelFor(item, index)}
                    </span>
                    <ChevronDown
                      size={15}
                      className={`shrink-0 text-ink-300 transition-transform ${open ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {field.publishAction && (
                    <button
                      type="button"
                      onClick={() => publish(item, index)}
                      disabled={publishing === index}
                      className="btn-ghost px-2 py-1.5 text-xs"
                      title="Publicar o actualizar en Discord"
                    >
                      <Send size={13} />
                      {publishing === index ? 'Enviando…' : 'Publicar'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="rounded p-2 text-ink-300 transition-colors hover:bg-danger/10 hover:text-danger"
                    aria-label="Eliminar"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {open && (
                  <div className="space-y-4 border-t border-ink-700 bg-ink-800/40 p-4">
                    {field.itemFields.map((subField) => (
                      <Field
                        key={subField.key}
                        field={subField}
                        value={item[subField.key]}
                        onChange={(newValue) => update(index, subField.key, newValue)}
                        settings={settings}
                      />
                    ))}

                    {field.publishAction && (
                      <p className="help">
                        Recuerda guardar los cambios antes de pulsar «Publicar».
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

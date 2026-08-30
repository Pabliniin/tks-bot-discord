'use client';

import { useState } from 'react';
import { Plus, Trash2, ChevronDown } from 'lucide-react';

import { TextInput, TextArea, ColorInput, Toggle } from './controls';
import { set as setPath } from '@/lib/objectPath';

/**
 * Diseñador de embeds con vista previa en vivo.
 *
 * El objeto que edita es el mismo que guarda el bot, así que lo que se ve aquí
 * es lo que se enviará a Discord.
 */

const LIMITS = {
  title: 256,
  description: 4096,
  fieldName: 256,
  fieldValue: 1024,
  footer: 2048,
  authorName: 256,
  fields: 25,
};

/** Convierte el marcado básico de Discord a HTML para la vista previa. */
function renderMarkdown(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-ink-900 px-1 py-0.5 text-[0.85em]">$1</code>')
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<span class="text-brand-400">$1</span>')
    .replace(/\n/g, '<br />');
}

/** Vista previa con el aspecto de un embed de Discord. */
function Preview({ embed }) {
  const color = /^#[0-9a-fA-F]{6}$/.test(embed.color || '') ? embed.color : '#5865F2';
  const empty =
    !embed.title && !embed.description && !embed.author?.name && (embed.fields || []).length === 0;

  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">Vista previa</p>

      {empty ? (
        <p className="py-6 text-center text-sm text-ink-400">
          Rellena algún campo para ver la vista previa.
        </p>
      ) : (
        <div className="flex gap-3 rounded bg-ink-800 p-3" style={{ borderLeft: `4px solid ${color}` }}>
          <div className="min-w-0 flex-1">
            {embed.author?.name && (
              <div className="mb-1.5 flex items-center gap-2">
                {embed.author.icon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={embed.author.icon} alt="" className="h-5 w-5 rounded-full object-cover" />
                )}
                <span className="text-[13px] font-semibold text-white">{embed.author.name}</span>
              </div>
            )}

            {embed.title && (
              <p
                className="text-[15px] font-bold text-white"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(embed.title) }}
              />
            )}

            {embed.description && (
              <p
                className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-100"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(embed.description) }}
              />
            )}

            {(embed.fields || []).length > 0 && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {embed.fields.map((field, index) => (
                  <div key={index} className={field.inline ? '' : 'sm:col-span-2'}>
                    <p
                      className="text-[12px] font-bold text-white"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(field.name) }}
                    />
                    <p
                      className="text-[12px] text-ink-100"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(field.value) }}
                    />
                  </div>
                ))}
              </div>
            )}

            {embed.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={embed.image} alt="" className="mt-3 max-h-56 rounded object-cover" />
            )}

            {(embed.footer?.text || embed.timestamp) && (
              <div className="mt-3 flex items-center gap-2">
                {embed.footer?.icon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={embed.footer.icon} alt="" className="h-4 w-4 rounded-full object-cover" />
                )}
                <span className="text-[11px] text-ink-300">
                  {embed.footer?.text}
                  {embed.footer?.text && embed.timestamp ? ' · ' : ''}
                  {embed.timestamp ? 'hoy a las 21:04' : ''}
                </span>
              </div>
            )}
          </div>

          {embed.thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={embed.thumbnail}
              alt=""
              className="h-16 w-16 shrink-0 rounded object-cover"
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function EmbedBuilder({ value, onChange, showEnabled = true }) {
  const [openAdvanced, setOpenAdvanced] = useState(false);
  const embed = value || {};

  const update = (path, newValue) => onChange(setPath(embed, path, newValue));

  const fields = embed.fields || [];
  const addField = () => {
    if (fields.length >= LIMITS.fields) return;
    update('fields', [...fields, { name: 'Título del campo', value: 'Contenido', inline: false }]);
  };
  const updateField = (index, key, newValue) => {
    const next = fields.map((f, i) => (i === index ? { ...f, [key]: newValue } : f));
    update('fields', next);
  };
  const removeField = (index) => update('fields', fields.filter((_, i) => i !== index));

  return (
    <div className="space-y-4 rounded-lg border border-ink-700 bg-ink-800/40 p-4">
      {showEnabled && (
        <Toggle
          value={embed.enabled}
          onChange={(v) => update('enabled', v)}
          label="Usar embed"
          help="Si lo desactivas, solo se enviará el texto normal."
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Título</label>
          <TextInput
            value={embed.title}
            onChange={(v) => update('title', v)}
            maxLength={LIMITS.title}
            placeholder="Título del embed"
          />
        </div>
        <div>
          <label className="label">Color</label>
          <ColorInput value={embed.color || '#5865F2'} onChange={(v) => update('color', v)} />
        </div>
      </div>

      <div>
        <label className="label">Descripción</label>
        <TextArea
          value={embed.description}
          onChange={(v) => update('description', v)}
          rows={4}
          maxLength={LIMITS.description}
          placeholder="Admite **negrita**, *cursiva*, `código` y [enlaces](https://…)"
        />
        <p className="help">
          {(embed.description || '').length} / {LIMITS.description} caracteres
        </p>
      </div>

      {/* ── Campos ─────────────────────────────────────────────── */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="label mb-0">Campos ({fields.length}/{LIMITS.fields})</span>
          <button
            type="button"
            onClick={addField}
            disabled={fields.length >= LIMITS.fields}
            className="btn-secondary px-2.5 py-1 text-xs"
          >
            <Plus size={13} /> Añadir campo
          </button>
        </div>

        <div className="space-y-2">
          {fields.map((field, index) => (
            <div key={index} className="rounded-lg border border-ink-700 bg-ink-900/60 p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <TextInput
                  value={field.name}
                  onChange={(v) => updateField(index, 'name', v)}
                  maxLength={LIMITS.fieldName}
                  placeholder="Nombre"
                />
                <TextInput
                  value={field.value}
                  onChange={(v) => updateField(index, 'value', v)}
                  maxLength={LIMITS.fieldValue}
                  placeholder="Valor"
                />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-200">
                  <input
                    type="checkbox"
                    checked={Boolean(field.inline)}
                    onChange={(event) => updateField(index, 'inline', event.target.checked)}
                    className="h-3.5 w-3.5 rounded border-ink-600 bg-ink-900 text-brand-500"
                  />
                  En línea
                </label>
                <button
                  type="button"
                  onClick={() => removeField(index)}
                  className="text-xs text-danger hover:underline"
                >
                  <Trash2 size={13} className="inline" /> Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Opciones avanzadas ─────────────────────────────────── */}
      <div>
        <button
          type="button"
          onClick={() => setOpenAdvanced((o) => !o)}
          className="flex w-full items-center justify-between rounded-lg bg-ink-800 px-3 py-2 text-sm font-medium text-ink-100 hover:bg-ink-700"
        >
          Autor, imágenes y pie
          <ChevronDown size={15} className={openAdvanced ? 'rotate-180' : ''} />
        </button>

        {openAdvanced && (
          <div className="mt-3 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Nombre del autor</label>
                <TextInput
                  value={embed.author?.name}
                  onChange={(v) => update('author.name', v)}
                  maxLength={LIMITS.authorName}
                />
              </div>
              <div>
                <label className="label">Icono del autor (URL)</label>
                <TextInput
                  value={embed.author?.icon}
                  onChange={(v) => update('author.icon', v)}
                  placeholder="https://…"
                />
              </div>
              <div>
                <label className="label">Miniatura (URL)</label>
                <TextInput
                  value={embed.thumbnail}
                  onChange={(v) => update('thumbnail', v)}
                  placeholder="https://…"
                />
              </div>
              <div>
                <label className="label">Imagen grande (URL)</label>
                <TextInput
                  value={embed.image}
                  onChange={(v) => update('image', v)}
                  placeholder="https://…"
                />
              </div>
              <div>
                <label className="label">Texto del pie</label>
                <TextInput
                  value={embed.footer?.text}
                  onChange={(v) => update('footer.text', v)}
                  maxLength={LIMITS.footer}
                />
              </div>
              <div>
                <label className="label">Icono del pie (URL)</label>
                <TextInput
                  value={embed.footer?.icon}
                  onChange={(v) => update('footer.icon', v)}
                  placeholder="https://…"
                />
              </div>
            </div>

            <Toggle
              value={embed.timestamp}
              onChange={(v) => update('timestamp', v)}
              label="Mostrar la fecha y hora del envío"
            />
          </div>
        )}
      </div>

      <Preview embed={embed} />
    </div>
  );
}

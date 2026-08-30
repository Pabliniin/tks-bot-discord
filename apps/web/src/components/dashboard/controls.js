'use client';

import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, Search, X, Hash, Volume2, Folder, Megaphone } from 'lucide-react';

import { useGuildData } from './GuildDataContext';

/**
 * Controles reutilizables del formulario del panel.
 */

/* ── Interruptor ──────────────────────────────────────────────── */

export function Toggle({ value, onChange, label, help, disabled }) {
  return (
    <label
      className={`flex items-start gap-3 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={Boolean(value)}
        disabled={disabled}
        onClick={() => !disabled && onChange(!value)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${
          value ? 'bg-brand-500' : 'bg-ink-600'
        } ${disabled ? 'cursor-not-allowed' : ''}`}
      >
        {/*
          La bola se mueve con `left` y no con `translate`: las utilidades de
          transformación de Tailwind pasan por variables CSS y aquí no
          recalculaban la posición al cambiar de estado.
        */}
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] duration-150 ${
            value ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>

      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-50">{label}</span>
        {help && <span className="help block">{help}</span>}
      </span>
    </label>
  );
}

/* ── Texto ────────────────────────────────────────────────────── */

export function TextInput({ value, onChange, placeholder, maxLength, disabled, invalid }) {
  return (
    <input
      type="text"
      className={`input ${invalid ? 'border-danger focus:border-danger focus:ring-danger' : ''}`}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      disabled={disabled}
    />
  );
}

export function TextArea({ value, onChange, placeholder, rows = 4, maxLength, disabled }) {
  return (
    <textarea
      className="input resize-y font-normal"
      rows={rows}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      disabled={disabled}
    />
  );
}

export function NumberInput({ value, onChange, min, max, step = 1, disabled }) {
  return (
    <input
      type="number"
      className="input"
      value={value ?? ''}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(event) => {
        const raw = event.target.value;
        // Un campo vacío se guarda como el mínimo, o 0, para no romper el esquema.
        if (raw === '') {
          onChange(min ?? 0);
          return;
        }
        const parsed = step < 1 ? Number.parseFloat(raw) : Number.parseInt(raw, 10);
        if (Number.isNaN(parsed)) return;
        onChange(parsed);
      }}
      onBlur={(event) => {
        // Se ajusta al rango permitido al salir del campo.
        const parsed = Number(event.target.value);
        if (Number.isNaN(parsed)) return;
        if (typeof min === 'number' && parsed < min) onChange(min);
        if (typeof max === 'number' && parsed > max) onChange(max);
      }}
    />
  );
}

export function Select({ value, onChange, options, disabled }) {
  return (
    <select
      className="input cursor-pointer"
      value={value ?? ''}
      disabled={disabled}
      onChange={(event) => {
        const raw = event.target.value;
        // Se conserva el tipo original de la opción (número o texto).
        const match = options.find((o) => String(o.value) === raw);
        onChange(match ? match.value : raw);
      }}
    >
      {options.map((option) => (
        <option key={String(option.value)} value={String(option.value)}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function ColorInput({ value, onChange, disabled }) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : '#5865F2';

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={safe}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-ink-600 bg-ink-900 p-1"
      />
      <input
        type="text"
        className="input font-mono uppercase"
        value={value ?? ''}
        disabled={disabled}
        placeholder="#5865F2"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function EmojiInput({ value, onChange, disabled }) {
  const { emojis } = useGuildData();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <input
          type="text"
          className="input"
          value={value ?? ''}
          disabled={disabled}
          placeholder="⭐ o <:nombre:id>"
          onChange={(event) => onChange(event.target.value)}
        />
        {emojis.length > 0 && (
          <button
            type="button"
            className="btn-secondary shrink-0 px-3"
            onClick={() => setOpen((o) => !o)}
            disabled={disabled}
          >
            Emojis
          </button>
        )}
      </div>

      {open && (
        <div className="absolute right-0 z-20 mt-2 max-h-56 w-72 overflow-y-auto rounded-lg border border-ink-600 bg-ink-800 p-2 shadow-2xl">
          <div className="grid grid-cols-8 gap-1">
            {emojis.map((emoji) => (
              <button
                key={emoji.id}
                type="button"
                title={`:${emoji.name}:`}
                className="rounded p-1 hover:bg-ink-700"
                onClick={() => {
                  onChange(`<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`);
                  setOpen(false);
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={emoji.url} alt={emoji.name} className="h-6 w-6" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Selector con búsqueda ────────────────────────────────────── */

/** Icono según el tipo de canal de Discord. */
function channelIcon(type) {
  if (type === 2 || type === 13) return <Volume2 size={14} className="shrink-0 text-ink-300" />;
  if (type === 4) return <Folder size={14} className="shrink-0 text-ink-300" />;
  if (type === 5) return <Megaphone size={14} className="shrink-0 text-ink-300" />;
  return <Hash size={14} className="shrink-0 text-ink-300" />;
}

/**
 * Desplegable con buscador. Sirve para un solo valor o para varios.
 *
 * @param {object} props
 * @param {Array<{value:string,label:string,color?:string,type?:number}>} props.items
 * @param {boolean} props.multiple
 */
export function SearchSelect({
  value,
  onChange,
  items,
  multiple = false,
  placeholder = 'Selecciona…',
  emptyLabel = 'Ninguno',
  disabled,
  allowEmpty = true,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);

  // Cierra el desplegable al pulsar fuera o con Escape.
  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const selected = multiple ? (Array.isArray(value) ? value : []) : value;
  const filtered = query
    ? items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
    : items;

  const toggleItem = (itemValue) => {
    if (multiple) {
      const list = Array.isArray(value) ? value : [];
      onChange(list.includes(itemValue) ? list.filter((v) => v !== itemValue) : [...list, itemValue]);
    } else {
      onChange(itemValue === selected && allowEmpty ? null : itemValue);
      setOpen(false);
    }
  };

  const label = () => {
    if (multiple) return selected.length > 0 ? `${selected.length} seleccionado(s)` : placeholder;
    const match = items.find((item) => item.value === selected);
    return match ? match.label : placeholder;
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="input flex items-center justify-between gap-2 text-left"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={`truncate ${selected && selected.length !== 0 ? '' : 'text-ink-400'}`}>
          {label()}
        </span>
        <ChevronDown size={15} className={`shrink-0 text-ink-300 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Etiquetas de lo elegido en modo múltiple. */}
      {multiple && selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((itemValue) => {
            const item = items.find((i) => i.value === itemValue);
            return (
              <span
                key={itemValue}
                className="inline-flex items-center gap-1 rounded-md bg-ink-700 px-2 py-1 text-xs text-ink-50"
                style={item?.color && item.color !== '#000000' ? { color: item.color } : undefined}
              >
                {item?.label || `Desconocido (${itemValue})`}
                <button
                  type="button"
                  onClick={() => toggleItem(itemValue)}
                  className="text-ink-300 hover:text-danger"
                  aria-label="Quitar"
                >
                  <X size={12} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {open && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-lg border border-ink-600 bg-ink-800 shadow-2xl">
          <div className="flex items-center gap-2 border-b border-ink-700 px-3 py-2">
            <Search size={14} className="shrink-0 text-ink-400" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar…"
              className="w-full bg-transparent text-sm text-ink-50 outline-none placeholder:text-ink-400"
            />
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {!multiple && allowEmpty && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-ink-300 hover:bg-ink-700"
              >
                {emptyLabel}
                {!selected && <Check size={14} className="text-brand-400" />}
              </button>
            )}

            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-ink-400">Sin resultados</p>
            )}

            {filtered.map((item) => {
              const active = multiple ? selected.includes(item.value) : selected === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => toggleItem(item.value)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-ink-700"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {typeof item.type === 'number' && channelIcon(item.type)}
                    {item.color && item.color !== '#000000' && (
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                    )}
                    <span className="truncate text-ink-50">{item.label}</span>
                  </span>
                  {active && <Check size={14} className="shrink-0 text-brand-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Lista de textos libres ───────────────────────────────────── */

export function TagsInput({ value, onChange, placeholder, disabled }) {
  const [draft, setDraft] = useState('');
  const list = Array.isArray(value) ? value : [];

  const add = () => {
    const clean = draft.trim();
    if (!clean) return;
    // Se evita duplicar entradas iguales.
    if (list.some((item) => item.toLowerCase() === clean.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...list, clean]);
    setDraft('');
  };

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="text"
          className="input"
          value={draft}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault();
              add();
            }
            // Retroceso con el campo vacío borra la última etiqueta.
            if (event.key === 'Backspace' && draft === '' && list.length > 0) {
              onChange(list.slice(0, -1));
            }
          }}
        />
        <button type="button" className="btn-secondary shrink-0" onClick={add} disabled={disabled}>
          Añadir
        </button>
      </div>

      {list.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {list.map((item, index) => (
            <span
              key={`${item}-${index}`}
              className="inline-flex items-center gap-1 rounded-md bg-ink-700 px-2 py-1 text-xs text-ink-50"
            >
              {item}
              <button
                type="button"
                onClick={() => onChange(list.filter((_, i) => i !== index))}
                className="text-ink-300 hover:text-danger"
                aria-label={`Quitar ${item}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <p className="help">Pulsa Enter para añadir cada entrada.</p>
    </div>
  );
}

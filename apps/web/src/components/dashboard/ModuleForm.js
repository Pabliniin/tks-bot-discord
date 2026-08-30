'use client';

import { useState, useCallback, useEffect } from 'react';
import { Save, RotateCcw, ChevronDown, Crown, AlertTriangle } from 'lucide-react';

import Field from './Field';
import { GuildDataProvider } from './GuildDataContext';
import { get as getPath, set as setPath } from '@/lib/objectPath';

/**
 * Formulario de un módulo del panel.
 *
 * Dibuja las secciones que describe `moduleSchemas.js`, guarda el estado local
 * y envía solo las ramas modificadas al guardar.
 */

/** Sección plegable con su lista de campos. */
function Section({ section, settings, onChange, disabled }) {
  const [open, setOpen] = useState(!section.collapsible);

  // Cuenta los campos visibles: una sección donde todo está oculto no se pinta.
  const visible = section.fields.filter(
    (field) => !field.showIf || getPath(settings, field.showIf)
  );
  if (visible.length === 0 && section.collapsible) return null;

  return (
    <section className="card overflow-hidden">
      <button
        type="button"
        onClick={() => section.collapsible && setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-3 px-5 py-4 text-left ${
          section.collapsible ? 'hover:bg-ink-700/40' : 'cursor-default'
        }`}
        aria-expanded={open}
      >
        <span>
          <span className="block text-base font-bold text-white">{section.title}</span>
          {section.description && (
            <span className="mt-0.5 block text-sm text-ink-300">{section.description}</span>
          )}
        </span>
        {section.collapsible && (
          <ChevronDown
            size={18}
            className={`shrink-0 text-ink-300 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {open && (
        <div className="space-y-5 border-t border-ink-700/60 px-5 py-5">
          {section.fields.map((field) => (
            <Field
              key={field.key}
              field={field}
              value={getPath(settings, field.key)}
              onChange={(value) => onChange(field.key, value)}
              settings={settings}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function ModuleForm({
  schema,
  initialSettings,
  guildId,
  guildData,
  premium,
  botPresent,
  commands = [],
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [saved, setSaved] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);

  // Avisa antes de salir con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const handleChange = useCallback((path, value) => {
    setSettings((current) => setPath(current, path, value));
    setMessage(null);
  }, []);

  const locked = schema.premium && premium.tier === 0;

  /** Envía solo las ramas de primer nivel que han cambiado. */
  const save = async () => {
    setSaving(true);
    setMessage(null);

    const payload = {};
    for (const key of Object.keys(settings)) {
      if (JSON.stringify(settings[key]) !== JSON.stringify(saved[key])) {
        payload[key] = settings[key];
      }
    }

    if (Object.keys(payload).length === 0) {
      setSaving(false);
      setMessage({ type: 'info', text: 'No hay cambios que guardar.' });
      return;
    }

    try {
      const response = await fetch(`/api/guilds/${guildId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage({
          type: 'error',
          text: data.details?.length ? `${data.error} ${data.details.join(' · ')}` : data.error,
        });
        return;
      }

      // Se toma la respuesta del servidor como verdad: incluye los valores
      // por defecto que mongoose haya rellenado.
      setSettings(data.settings);
      setSaved(data.settings);
      setMessage({ type: 'success', text: 'Cambios guardados. El bot ya los está aplicando.' });
    } catch {
      setMessage({ type: 'error', text: 'No se ha podido contactar con el servidor.' });
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setSettings(saved);
    setMessage(null);
  };

  return (
    <GuildDataProvider value={{ guildData, premium, botPresent, guildId, commands }}>
      <div className="pb-28">
        <header className="mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black text-white sm:text-3xl">{schema.title}</h1>
            {schema.premium && (
              <span className="badge bg-warning/15 text-warning">
                <Crown size={12} /> Premium
              </span>
            )}
          </div>
          {schema.description && (
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-300">{schema.description}</p>
          )}
        </header>

        {!botPresent && (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
            <div className="text-sm text-warning">
              <p className="font-semibold">El bot no está disponible en este servidor.</p>
              <p className="mt-0.5 text-warning/80">
                Puedes guardar la configuración, pero los selectores de canales y roles estarán
                vacíos hasta que invites al bot y lo enciendas.
              </p>
            </div>
          </div>
        )}

        {locked && (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
            <Crown size={18} className="mt-0.5 shrink-0 text-warning" />
            <div className="text-sm text-warning">
              <p className="font-semibold">Este módulo forma parte de TK$ Premium.</p>
              <p className="mt-0.5 text-warning/80">
                Puedes configurarlo, pero no se aplicará hasta que actives Premium en el servidor.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {schema.sections.map((section) => (
            <Section
              key={section.title}
              section={section}
              settings={settings}
              onChange={handleChange}
              disabled={false}
            />
          ))}
        </div>

        {/* Barra de guardado fija al pie. */}
        <div
          className={`fixed inset-x-0 bottom-0 z-40 border-t border-ink-700 bg-ink-900/95 backdrop-blur transition-transform duration-200 ${
            dirty || message ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <p
              className={`text-sm ${
                message?.type === 'error'
                  ? 'text-danger'
                  : message?.type === 'success'
                    ? 'text-success'
                    : 'text-ink-200'
              }`}
            >
              {message?.text || 'Tienes cambios sin guardar.'}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={reset}
                disabled={!dirty || saving}
                className="btn-ghost"
              >
                <RotateCcw size={15} />
                Descartar
              </button>
              <button type="button" onClick={save} disabled={!dirty || saving} className="btn-primary">
                <Save size={15} />
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </GuildDataProvider>
  );
}

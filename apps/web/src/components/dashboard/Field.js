'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';

import {
  Toggle,
  TextInput,
  TextArea,
  NumberInput,
  Select,
  ColorInput,
  EmojiInput,
  SearchSelect,
  TagsInput,
} from './controls';
import EmbedBuilder from './EmbedBuilder';
import ListEditor from './ListEditor';
import LogEventsEditor from './LogEventsEditor';
import { useGuildData } from './GuildDataContext';
import { get as getPath } from '@/lib/objectPath';

/** Variables disponibles por contexto, para el botón de ayuda. */
const VARIABLE_HELP = {
  welcome: [
    ['[user]', 'menciona al miembro'],
    ['[userName]', 'su nombre sin mención'],
    ['[server]', 'nombre del servidor'],
    ['[memberCount]', 'número de miembros'],
    ['[inviter]', 'menciona a quien lo invitó'],
    ['[inviterName]', 'nombre de quien lo invitó'],
  ],
  autoresponder: [
    ['[user]', 'menciona al miembro'],
    ['[userName]', 'su nombre sin mención'],
    ['[invites]', 'sus invitaciones'],
  ],
  levels: [
    ['[user]', 'menciona al miembro'],
    ['[level]', 'nivel alcanzado'],
    ['[oldLevel]', 'nivel anterior'],
    ['[user.username]', 'nombre de usuario'],
  ],
};

/** Panel plegable con la lista de variables. */
function VariablesHelp({ context }) {
  const [open, setOpen] = useState(false);
  const list = VARIABLE_HELP[context];
  if (!list) return null;

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300"
      >
        <Info size={12} />
        {open ? 'Ocultar variables' : 'Ver variables disponibles'}
      </button>

      {open && (
        <div className="mt-2 grid gap-1 rounded-lg border border-ink-700 bg-ink-900 p-3 sm:grid-cols-2">
          {list.map(([tag, description]) => (
            <p key={tag} className="text-xs text-ink-300">
              <code className="rounded bg-ink-800 px-1 py-0.5 font-mono text-brand-300">{tag}</code>{' '}
              {description}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Dibuja un campo del formulario según su tipo.
 *
 * @param {object} props
 * @param {object} props.field Definición del campo (ver `moduleSchemas.js`).
 * @param {*} props.value Valor actual.
 * @param {Function} props.onChange Recibe el valor nuevo.
 * @param {object} props.settings Configuración completa, para evaluar `showIf`.
 */
export default function Field({ field, value, onChange, settings, disabled = false }) {
  const { channels, roles, commands } = useGuildData();

  // `showIf` oculta el campo mientras la opción de la que depende esté apagada.
  if (field.showIf && !getPath(settings, field.showIf)) return null;

  const channelItems = channels
    .filter((c) => !field.channelTypes || field.channelTypes.includes(c.type))
    .map((c) => ({ value: c.id, label: c.name, type: c.type }));

  const roleItems = roles.map((r) => ({ value: r.id, label: r.name, color: r.color }));

  /** Los campos que ya traen su propia etiqueta no repiten el `<label>`. */
  const selfLabeled = field.type === 'toggle' || field.type === 'embed' || field.type === 'list';

  const control = () => {
    switch (field.type) {
      case 'toggle':
        return (
          <Toggle
            value={value}
            onChange={onChange}
            label={field.label}
            help={field.help}
            disabled={disabled}
          />
        );

      case 'text':
        return (
          <TextInput
            value={value}
            onChange={onChange}
            placeholder={field.placeholder}
            maxLength={field.maxLength}
            disabled={disabled}
          />
        );

      case 'textarea':
        return (
          <TextArea
            value={value}
            onChange={onChange}
            placeholder={field.placeholder}
            rows={field.rows || 4}
            maxLength={field.maxLength}
            disabled={disabled}
          />
        );

      case 'number':
        return (
          <NumberInput
            value={value}
            onChange={onChange}
            min={field.min}
            max={field.max}
            step={field.step}
            disabled={disabled}
          />
        );

      case 'select':
        return (
          <Select value={value} onChange={onChange} options={field.options} disabled={disabled} />
        );

      case 'color':
        return <ColorInput value={value} onChange={onChange} disabled={disabled} />;

      case 'emoji':
        return <EmojiInput value={value} onChange={onChange} disabled={disabled} />;

      case 'channel':
        return (
          <SearchSelect
            value={value}
            onChange={onChange}
            items={channelItems}
            placeholder="Elige un canal"
            emptyLabel="Sin canal"
            disabled={disabled}
          />
        );

      case 'channels':
        return (
          <SearchSelect
            value={value}
            onChange={onChange}
            items={channelItems}
            multiple
            placeholder="Elige canales"
            disabled={disabled}
          />
        );

      case 'role':
        return (
          <SearchSelect
            value={value}
            onChange={onChange}
            items={roleItems}
            placeholder="Elige un rol"
            emptyLabel="Sin rol"
            disabled={disabled}
          />
        );

      case 'roles':
        return (
          <SearchSelect
            value={value}
            onChange={onChange}
            items={roleItems}
            multiple
            placeholder="Elige roles"
            disabled={disabled}
          />
        );

      case 'commands':
        return (
          <SearchSelect
            value={value}
            onChange={onChange}
            items={commands.map((c) => ({ value: c.name, label: c.name }))}
            multiple
            placeholder="Elige comandos a desactivar"
            disabled={disabled}
          />
        );

      case 'tags':
        return (
          <TagsInput
            value={value}
            onChange={onChange}
            placeholder={field.placeholder}
            disabled={disabled}
          />
        );

      case 'embed':
        return <EmbedBuilder value={value} onChange={onChange} />;

      case 'logEvents':
        return <LogEventsEditor value={value} onChange={onChange} />;

      case 'list':
        return <ListEditor field={field} value={value} onChange={onChange} settings={settings} />;

      default:
        return (
          <p className="text-sm text-danger">
            Tipo de campo desconocido: <code>{field.type}</code>
          </p>
        );
    }
  };

  return (
    <div>
      {!selfLabeled && (
        <label className="label">
          {field.label}
          {field.required && <span className="ml-1 text-danger">*</span>}
        </label>
      )}

      {control()}

      {field.help && !selfLabeled && <p className="help">{field.help}</p>}
      {field.variables && <VariablesHelp context={field.variables} />}
    </div>
  );
}

'use client';

import { useState, useMemo } from 'react';
import { Search, ChevronDown, Crown } from 'lucide-react';
// Se importa el JSON de constantes en vez del índice del paquete: el índice
// arrastra mongoose y un .js CommonJS rompe Fast Refresh en el cliente.
// Import por defecto: webpack no admite imports con nombre sobre claves de JSON.
import constants from '@tkbot/shared/src/constants.json';

const { COMMAND_CATEGORIES } = constants;

/**
 * Buscador de comandos con filtro por categoría, igual que en la web pública.
 */
export default function CommandsBrowser({ commands, prefix = '-' }) {
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [openCommand, setOpenCommand] = useState(null);

  /*
   * Las categorías conocidas salen de las constantes, pero el bot puede tener
   * comandos de una categoría más nueva que esta página (pasa justo después de
   * desplegar el bot y antes de desplegar la web). Sin esto, esos comandos se
   * contaban en «Todo» pero no aparecían en ninguna pestaña: quedaban
   * invisibles y parecía que faltaban.
   */
  const categories = useMemo(() => {
    const conocidas = Object.values(COMMAND_CATEGORIES).map((c) => ({
      id: c.id,
      label: c.es,
      emoji: c.emoji,
    }));

    const idsConocidos = new Set(conocidas.map((c) => c.id));

    const desconocidas = [...new Set(commands.map((c) => c.category))]
      .filter((id) => id && !idsConocidos.has(id))
      .map((id) => ({
        id,
        // Sin traducción disponible se enseña el identificador tal cual, que
        // es mejor que esconder el comando.
        label: id.charAt(0).toUpperCase() + id.slice(1),
        emoji: '🧩',
      }));

    return [{ id: 'all', label: 'Todo', emoji: '📋' }, ...conocidas, ...desconocidas];
  }, [commands]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();

    return commands.filter((command) => {
      if (category !== 'all' && command.category !== category) return false;
      if (!search) return true;

      return (
        command.name.includes(search) ||
        command.description.toLowerCase().includes(search) ||
        command.aliases.some((alias) => alias.includes(search))
      );
    });
  }, [commands, category, query]);

  return (
    <div>
      {/* Buscador */}
      <div className="mx-auto mb-6 max-w-xl">
        <div className="relative">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar un comando…"
            className="input py-3 pl-11"
            aria-label="Buscar comandos"
          />
        </div>
      </div>

      {/* Categorías */}
      <div className="mb-8 flex flex-wrap justify-center gap-2">
        {categories.map((item) => {
          const active = category === item.id;
          const count =
            item.id === 'all'
              ? commands.length
              : commands.filter((c) => c.category === item.id).length;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                active ? 'bg-brand-500 text-white' : 'bg-ink-800 text-ink-200 hover:bg-ink-700'
              }`}
            >
              <span className="mr-1.5">{item.emoji}</span>
              {item.label}
              <span className={`ml-2 text-xs ${active ? 'text-white/70' : 'text-ink-400'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mb-4 text-center text-sm text-ink-400">
        {filtered.length === commands.length
          ? `${commands.length} comandos disponibles`
          : `${filtered.length} resultado(s)`}
      </p>

      {/* Lista */}
      {filtered.length === 0 ? (
        <p className="card px-6 py-16 text-center text-ink-400">
          No hay ningún comando que coincida con «{query}».
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((command) => {
            const open = openCommand === command.name;

            return (
              <div key={command.name} className="card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenCommand(open ? null : command.name)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-ink-700/40"
                  aria-expanded={open}
                >
                  <code className="shrink-0 rounded-md bg-ink-900 px-2.5 py-1 font-mono text-sm font-semibold text-brand-300">
                    {prefix}
                    {command.name}
                  </code>

                  <span className="min-w-0 flex-1 truncate text-sm text-ink-200">
                    {command.description}
                  </span>

                  {command.premium && (
                    <span className="badge shrink-0 bg-warning/15 text-warning">
                      <Crown size={11} /> Premium
                    </span>
                  )}

                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                </button>

                {open && (
                  <div className="space-y-3 border-t border-ink-700/60 px-5 py-4 text-sm">
                    {command.usage && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-ink-400">Uso</p>
                        <code className="mt-1 block rounded bg-ink-900 px-3 py-2 font-mono text-brand-200">
                          {prefix}
                          {command.name} {command.usage}
                        </code>
                      </div>
                    )}

                    {command.subcommands?.length > 0 && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-ink-400">
                          Subcomandos
                        </p>
                        <ul className="mt-1 space-y-1">
                          {command.subcommands.map((sub) => (
                            <li key={sub.name} className="text-ink-200">
                              <code className="font-mono text-brand-300">
                                {prefix}
                                {command.name} {sub.name}
                              </code>{' '}
                              — {sub.description}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {command.examples?.length > 0 && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-ink-400">
                          Ejemplos
                        </p>
                        <div className="mt-1 space-y-1">
                          {command.examples.map((example) => (
                            <code
                              key={example}
                              className="block rounded bg-ink-900 px-3 py-1.5 font-mono text-xs text-ink-200"
                            >
                              {prefix}
                              {example}
                            </code>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1 text-xs text-ink-300">
                      {command.aliases?.length > 0 && (
                        <p>
                          <span className="font-semibold text-ink-100">Alias:</span>{' '}
                          {command.aliases.map((a) => `${prefix}${a}`).join(', ')}
                        </p>
                      )}
                      <p>
                        <span className="font-semibold text-ink-100">Espera:</span>{' '}
                        {command.cooldown}s
                      </p>
                      {command.userPermissions?.length > 0 && (
                        <p>
                          <span className="font-semibold text-ink-100">Permisos:</span>{' '}
                          {command.userPermissions.join(', ')}
                        </p>
                      )}
                    </div>
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

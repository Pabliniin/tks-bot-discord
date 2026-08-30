#!/usr/bin/env node
'use strict';

/**
 * Genera `packages/shared/src/commands.json` a partir de los comandos del bot.
 *
 * La web usa ese archivo para la página pública de comandos, de modo que la
 * lista se ve aunque el bot esté apagado.
 *
 * Ejecútalo cada vez que añadas o cambies un comando:
 *   npm run gen:commands
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

/**
 * Construye el catálogo y lo escribe en disco.
 * @returns {Array<object>} Los comandos escritos.
 */
function generateCatalog() {
  const TKClient = require(path.join(ROOT, 'apps', 'bot', 'src', 'structures', 'TKClient'));

  const client = new TKClient();
  client.loadCommands();

  const catalog = client.commands
    // Los comandos de administracion no salen en la web publica.
    .filter((command) => !command.hidden)
    .map((command) => {
      const json =
        command.data && typeof command.data.toJSON === 'function' ? command.data.toJSON() : null;

      return {
        name: command.name,
        category: command.category,
        description: command.description || '',
        usage: command.usage || '',
        examples: command.examples || [],
        aliases: command.aliases || [],
        premium: Boolean(command.premium),
        cooldown: command.cooldown ?? 3,
        userPermissions: command.userPermissions || [],
        // Los subcomandos se listan aparte para poder mostrarlos en la web.
        subcommands: (json?.options || [])
          .filter((option) => option.type === 1 || option.type === 2)
          .map((option) => ({ name: option.name, description: option.description })),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const target = path.join(ROOT, 'packages', 'shared', 'src', 'commands.json');
  fs.writeFileSync(target, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');

  return { catalog, target };
}

// Solo genera al ejecutarlo directamente. Importarlo no debe tener efectos:
// la comprobación estática del proyecto carga todos los scripts con `require`.
if (require.main === module) {
  const { catalog, target } = generateCatalog();

  const byCategory = catalog.reduce((acc, command) => {
    acc[command.category] = (acc[command.category] || 0) + 1;
    return acc;
  }, {});

  console.log(`Catálogo generado: ${catalog.length} comandos -> ${path.relative(ROOT, target)}`);
  for (const [category, count] of Object.entries(byCategory)) {
    console.log(`  ${category.padEnd(12)} ${count}`);
  }
}

module.exports = generateCatalog;

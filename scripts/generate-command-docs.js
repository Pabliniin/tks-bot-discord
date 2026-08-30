#!/usr/bin/env node
'use strict';

/**
 * Genera `COMANDOS.md`: la guía de todos los comandos, con ejemplos.
 *
 * Se construye leyendo los comandos de verdad, así que basta con volver a
 * ejecutarlo cuando añadas o cambies alguno:
 *
 *   npm run gen:docs
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

/** Título y orden de las categorías en el documento. */
const CATEGORIAS = [
  { id: 'general', titulo: '🎮 General', desc: 'Comandos para todo el mundo.' },
  { id: 'levels', titulo: '📈 Niveles', desc: 'Experiencia, rangos y perfiles.' },
  { id: 'info', titulo: 'ℹ️ Información', desc: 'Datos de usuarios, roles y del servidor.' },
  {
    id: 'moderation',
    titulo: '🛡️ Moderación',
    desc: 'Sanciones y control del servidor. Requieren permisos.',
  },
  { id: 'premium', titulo: '💎 Premium', desc: 'Suscripciones y administración del bot.' },
];

/** Quién puede usar cada comando. */
function nivelAcceso(command, permisosEs) {
  // Algunos comandos tienen permisos distintos según el subcomando.
  if (command.accessNote) return command.accessNote;
  if (command.ownerOnly) return '👑 **Solo los dueños del bot** (`BOT_OWNERS`)';
  if (command.staffOnly) return '🛡️ **Solo el personal del bot** (dueños incluidos)';

  if (command.userPermissions?.length) {
    return `Requiere el permiso **${permisosEs(command.userPermissions).join('** y **')}** en el servidor`;
  }
  return 'Cualquiera';
}

/** Bloque markdown de un comando. */
function bloqueComando(command, permisosEs) {
  const json =
    command.data && typeof command.data.toJSON === 'function' ? command.data.toJSON() : null;

  const subcomandos = (json?.options || [])
    .filter((o) => o.type === 1)
    .map((o) => ({ nombre: o.name, desc: o.description }));

  const grupos = (json?.options || [])
    .filter((o) => o.type === 2)
    .flatMap((g) =>
      (g.options || []).map((o) => ({ nombre: `${g.name} ${o.name}`, desc: o.description }))
    );

  const todosSubs = [...subcomandos, ...grupos];

  const lineas = [];

  lineas.push(`### \`-${command.name}\``);
  lineas.push('');
  lineas.push(command.description || 'Sin descripción.');
  lineas.push('');

  // Tabla de datos rápidos.
  lineas.push('| | |');
  lineas.push('|---|---|');
  lineas.push(`| **Quién puede usarlo** | ${nivelAcceso(command, permisosEs)} |`);
  if (command.usage) {
    lineas.push(`| **Uso** | \`-${command.name} ${command.usage}\` |`);
  }
  if (command.aliases?.length) {
    lineas.push(`| **También responde a** | ${command.aliases.map((a) => `\`-${a}\``).join(', ')} |`);
  }
  lineas.push(`| **Espera entre usos** | ${command.cooldown ?? 3} segundos |`);
  if (command.guildOnly === false) {
    lineas.push('| **Por privado** | Sí, funciona también en mensajes directos |');
  }
  lineas.push('');

  if (todosSubs.length > 0) {
    lineas.push('**Opciones disponibles:**');
    lineas.push('');
    for (const sub of todosSubs) {
      lineas.push(`- \`-${command.name} ${sub.nombre}\` — ${sub.desc}`);
    }
    lineas.push('');
  }

  if (command.examples?.length) {
    lineas.push('**Ejemplos:**');
    lineas.push('');
    lineas.push('```');
    for (const ejemplo of command.examples) lineas.push(`-${ejemplo}`);
    lineas.push('```');
    lineas.push('');
  }

  return lineas.join('\n');
}

function generarDocs() {
  const TKClient = require(path.join(ROOT, 'apps', 'bot', 'src', 'structures', 'TKClient'));
  const { translate } = require(path.join(ROOT, 'apps', 'bot', 'src', 'utils', 'permissions'));
  const { BRAND } = require(path.join(ROOT, 'packages', 'shared', 'src', 'constants.json'));

  const client = new TKClient();
  client.loadCommands();

  const fecha = new Date().toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const doc = [];

  // ── Cabecera ────────────────────────────────────────────────
  doc.push(`# Comandos de ${BRAND.name}`);
  doc.push('');
  doc.push(
    `Guía de los ${client.commands.size} comandos, con ejemplos. Actualizada el ${fecha}.`
  );
  doc.push('');
  doc.push('> Este archivo lo genera `npm run gen:docs` leyendo los comandos reales.');
  doc.push('> Si añades o cambias alguno, vuelve a ejecutarlo y se actualiza solo.');
  doc.push('');
  doc.push('---');
  doc.push('');

  // ── Cómo se usan ────────────────────────────────────────────
  doc.push('## Cómo se escriben');
  doc.push('');
  doc.push('Todos los comandos funcionan **de dos formas**, la que prefieras:');
  doc.push('');
  doc.push('| Forma | Ejemplo | Cuándo usarla |');
  doc.push('|---|---|---|');
  doc.push('| **Con prefijo** | `-ban @Rogue spam` | Más rápido de escribir |');
  doc.push('| **Con barra** | `/ban usuario:@Rogue razon:spam` | Discord te va guiando |');
  doc.push('');
  doc.push(
    'El prefijo por defecto es `-` y puedes cambiarlo en el panel, en **Ajustes generales**.'
  );
  doc.push('');
  doc.push('### Cómo leer los ejemplos');
  doc.push('');
  doc.push('| Símbolo | Significa |');
  doc.push('|---|---|');
  doc.push('| `<algo>` | **Obligatorio**: hay que ponerlo |');
  doc.push('| `[algo]` | **Opcional**: puedes omitirlo |');
  doc.push('| `a\\|b` | Elige una de las dos |');
  doc.push('');
  doc.push('Para referirte a alguien puedes mencionarle (`@Rogue`), poner su nombre');
  doc.push('(`Rogue`) o su ID (`123456789012345678`). Con los canales igual: `#general`.');
  doc.push('');
  doc.push('Si un texto lleva espacios y no va al final, ponlo entre comillas:');
  doc.push('');
  doc.push('```');
  doc.push('-warn @Rogue "spam en varios canales"');
  doc.push('```');
  doc.push('');
  doc.push('---');
  doc.push('');

  // ── Índice ──────────────────────────────────────────────────
  doc.push('## Índice');
  doc.push('');
  for (const categoria of CATEGORIAS) {
    const comandos = client.commands.filter((c) => c.category === categoria.id);
    if (comandos.size === 0) continue;

    const nombres = [...comandos.values()]
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .map((c) => `\`${c.name}\``)
      .join(' · ');

    doc.push(`**${categoria.titulo}** (${comandos.size}) — ${nombres}`);
    doc.push('');
  }
  doc.push('---');
  doc.push('');

  // ── Comandos por categoría ──────────────────────────────────
  for (const categoria of CATEGORIAS) {
    const comandos = [...client.commands.values()]
      .filter((c) => c.category === categoria.id)
      .sort((a, b) => {
        // Los de administración van al final de su categoría.
        const adminA = a.ownerOnly || a.staffOnly ? 1 : 0;
        const adminB = b.ownerOnly || b.staffOnly ? 1 : 0;
        if (adminA !== adminB) return adminA - adminB;
        return a.name.localeCompare(b.name, 'es');
      });

    if (comandos.length === 0) continue;

    doc.push(`## ${categoria.titulo}`);
    doc.push('');
    doc.push(`*${categoria.desc}*`);
    doc.push('');

    for (const command of comandos) {
      doc.push(bloqueComando(command, translate));
    }

    doc.push('---');
    doc.push('');
  }

  // ── Guía de administración ──────────────────────────────────
  doc.push('## Cómo gestionar el premium, paso a paso');
  doc.push('');
  doc.push('### 1. Ponte como dueño del bot');
  doc.push('');
  doc.push('En Discord: **Ajustes de usuario → Avanzado → Modo desarrollador**.');
  doc.push('Después, clic derecho sobre tu nombre → **Copiar ID de usuario**.');
  doc.push('');
  doc.push('Ese ID va en la variable `BOT_OWNERS` (en Easypanel: servicio `bot` →');
  doc.push('**Entorno**). Si sois varios, sepáralos por comas:');
  doc.push('');
  doc.push('```');
  doc.push('BOT_OWNERS=996608567750541392,111111111111111111');
  doc.push('```');
  doc.push('');
  doc.push('Guarda y pulsa **Implementar**. Sin esto no podrás usar `/staff`.');
  doc.push('');
  doc.push('### 2. Nombra a quien quieras que reparta premium');
  doc.push('');
  doc.push('```');
  doc.push('-staff add @Amigo');
  doc.push('-staff list');
  doc.push('```');
  doc.push('');
  doc.push('El personal puede repartir premium, pero **no** puede tocar la lista de');
  doc.push('personal ni destituirte. Eso solo lo pueden hacer los dueños.');
  doc.push('');
  doc.push('### 3. Reparte premium');
  doc.push('');
  doc.push('Hay dos maneras, según lo que quieras:');
  doc.push('');
  doc.push('**A. Activarlo directamente en un servidor**');
  doc.push('');
  doc.push('```');
  doc.push('-premium add 123456789012345678 2 30d');
  doc.push('```');
  doc.push('');
  doc.push('El servidor tendrá Premium 2 durante 30 días. Sin la duración, no caduca.');
  doc.push('');
  doc.push('**B. Dárselo a una persona, para que lo active donde quiera**');
  doc.push('');
  doc.push('```');
  doc.push('-premiumuser add @Rogue 2 365d');
  doc.push('```');
  doc.push('');
  doc.push('Esa persona recibe un mensaje privado y luego, en el servidor que elija:');
  doc.push('');
  doc.push('```');
  doc.push('-premiumuser activar');
  doc.push('```');
  doc.push('');
  doc.push('Es lo más parecido a "comprar" premium: la suscripción es suya y puede');
  doc.push('moverla de un servidor a otro con `-premiumuser desactivar`.');
  doc.push('');
  doc.push('| Nivel | Servidores que puede activar |');
  doc.push('|---|---|');
  doc.push('| Premium 1 | 1 |');
  doc.push('| Premium 2 | 3 |');
  doc.push('');
  doc.push('### 4. Comprueba cómo va');
  doc.push('');
  doc.push('```');
  doc.push('-premium list              todos los servidores con premium');
  doc.push('-premium info 1234...      un servidor concreto');
  doc.push('-premiumuser info @Rogue   la suscripción de una persona');
  doc.push('```');
  doc.push('');
  doc.push('Todo esto se ve también en la web: en **/premium** aparece tu suscripción');
  doc.push('con su caducidad, y en el panel de cada servidor, su plan.');
  doc.push('');
  doc.push('### Duraciones que se admiten');
  doc.push('');
  doc.push('| Escribes | Significa |');
  doc.push('|---|---|');
  doc.push('| `30d` | 30 días |');
  doc.push('| `12h` | 12 horas |');
  doc.push('| `2semanas` | 2 semanas |');
  doc.push('| `365d` | Un año |');
  doc.push('| `1d 12h` | Día y medio |');
  doc.push('| *(vacío)* | Para siempre |');
  doc.push('');
  doc.push('---');
  doc.push('');

  // ── Problemas frecuentes ────────────────────────────────────
  doc.push('## Si algo no funciona');
  doc.push('');
  doc.push('**Un comando no responde**');
  doc.push('Comprueba que no esté desactivado en el panel (Ajustes generales → Comandos');
  doc.push('desactivados) y que el canal no esté en la lista de canales ignorados.');
  doc.push('');
  doc.push('**Los comandos con `/` no aparecen en Discord**');
  doc.push('Los comandos globales tardan hasta una hora en propagarse. Mientras tanto,');
  doc.push('usa la forma con prefijo, que funciona al instante.');
  doc.push('');
  doc.push('**`-staff add` dice que sí pero luego `-staff list` sale vacío**');
  doc.push('Casi seguro tienes el bot encendido en **dos sitios a la vez** (tu PC y el');
  doc.push('servidor). Cada uno usa su propia base de datos, así que guardas en una y');
  doc.push('lees de la otra. Deja encendido solo uno: el bot avisa de esto en sus');
  doc.push('registros al arrancar.');
  doc.push('');
  doc.push('**El bot no da roles ni sanciona**');
  doc.push('Su rol tiene que estar **por encima** de los roles que gestiona.');
  doc.push('Ajustes del servidor → Roles, y arrástralo arriba.');
  doc.push('');

  const destino = path.join(ROOT, 'COMANDOS.md');
  fs.writeFileSync(destino, `${doc.join('\n')}\n`, 'utf8');

  return { destino, total: client.commands.size };
}

if (require.main === module) {
  const { destino, total } = generarDocs();
  console.log(`Guía generada: ${total} comandos -> ${path.relative(ROOT, destino)}`);
}

module.exports = generarDocs;

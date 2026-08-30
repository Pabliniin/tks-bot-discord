#!/usr/bin/env node
'use strict';

/**
 * Verificación estática del proyecto.
 *
 * Comprueba, sin necesidad de conectar con Discord ni con MongoDB:
 *   1. Que todos los archivos son JavaScript válido.
 *   2. Que todos los módulos se pueden cargar (`require`).
 *   3. Que las definiciones de comandos cumplen los límites de la API de Discord.
 *   4. Que no hay comandos ni alias duplicados.
 *
 * Uso: `npm run lint` desde la raíz del proyecto.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const TARGETS = [
  path.join(ROOT, 'packages', 'shared', 'src'),
  path.join(ROOT, 'apps', 'bot', 'src'),
  path.join(ROOT, 'apps', 'bot', 'scripts'),
  path.join(ROOT, 'scripts'),
];

/**
 * Archivos que arrancan algo al ejecutarse (el bot, un despliegue…).
 * Se comprueba su sintaxis, pero no se cargan con `require`.
 */
const NO_REQUIRE = new Set([
  // Arranca el bot y se conecta a Discord.
  path.join(ROOT, 'apps', 'bot', 'src', 'index.js'),
  // Este mismo archivo: cargarse a sí mismo sería recursivo.
  path.join(ROOT, 'scripts', 'check-syntax.js'),
]);

const errors = [];
const warnings = [];

/** Devuelve todos los `.js` de un directorio, de forma recursiva. */
function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

/** Ruta relativa a la raíz, con barras normales. */
function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

// ── 1. Sintaxis ────────────────────────────────────────────────
const files = TARGETS.flatMap(walk);
console.log(`Comprobando ${files.length} archivos...\n`);

for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    errors.push(`[sintaxis] ${rel(file)}\n  ${String(err.stderr || err.message).trim().split('\n')[0]}`);
  }
}

// ── 2. Carga de módulos ────────────────────────────────────────
for (const file of files) {
  if (NO_REQUIRE.has(file)) continue;
  try {
    require(file);
  } catch (err) {
    errors.push(`[carga] ${rel(file)}\n  ${err.message.split('\n')[0]}`);
  }
}

// ── 3. Definiciones de comandos ────────────────────────────────
const COMMAND_NAME_REGEX = /^[-_'\p{L}\p{N}]{1,32}$/u;
const commandDir = path.join(ROOT, 'apps', 'bot', 'src', 'commands');
const seenNames = new Map();
const seenAliases = new Map();

/** Valida recursivamente las opciones de un comando. */
function validateOptions(options, commandName, trail = '') {
  if (!Array.isArray(options)) return;

  if (options.length > 25) {
    errors.push(`[comando] ${commandName}${trail}: ${options.length} opciones (máximo 25)`);
  }

  let seenOptional = false;
  for (const option of options) {
    const where = `${commandName}${trail}.${option.name}`;

    if (!COMMAND_NAME_REGEX.test(option.name)) {
      errors.push(`[comando] ${where}: nombre de opción inválido`);
    }
    if (option.name !== option.name.toLowerCase()) {
      errors.push(`[comando] ${where}: el nombre debe ir en minúsculas`);
    }
    if (!option.description || option.description.length > 100) {
      errors.push(`[comando] ${where}: la descripción debe tener entre 1 y 100 caracteres`);
    }

    // Discord exige que las opciones obligatorias vayan antes que las opcionales.
    const isSub = option.type === 1 || option.type === 2;
    if (!isSub) {
      if (option.required) {
        if (seenOptional) {
          errors.push(`[comando] ${where}: una opción obligatoria va después de una opcional`);
        }
      } else {
        seenOptional = true;
      }
    }

    if (Array.isArray(option.choices) && option.choices.length > 25) {
      errors.push(`[comando] ${where}: ${option.choices.length} choices (máximo 25)`);
    }

    if (option.options) validateOptions(option.options, commandName, `${trail}.${option.name}`);
  }
}

for (const file of walk(commandDir)) {
  let command;
  try {
    command = require(file);
  } catch {
    continue; // El fallo de carga ya se registró antes.
  }

  const where = rel(file);

  if (!command?.name) {
    errors.push(`[comando] ${where}: falta la propiedad "name"`);
    continue;
  }
  if (typeof command.execute !== 'function') {
    errors.push(`[comando] ${where}: falta la función "execute"`);
  }

  if (seenNames.has(command.name)) {
    errors.push(`[comando] nombre duplicado "${command.name}": ${where} y ${seenNames.get(command.name)}`);
  } else {
    seenNames.set(command.name, where);
  }

  for (const alias of command.aliases || []) {
    if (seenAliases.has(alias)) {
      errors.push(`[comando] alias duplicado "${alias}": ${where} y ${seenAliases.get(alias)}`);
    } else if (seenNames.has(alias)) {
      errors.push(`[comando] el alias "${alias}" choca con un nombre de comando: ${where}`);
    } else {
      seenAliases.set(alias, where);
    }
  }

  if (!command.description) {
    warnings.push(`[comando] ${where}: sin descripción (no aparecerá bien en la web)`);
  }

  if (!command.data) {
    if (command.slash !== false) {
      warnings.push(`[comando] ${where}: sin "data", no se registrará como comando de barra`);
    }
    continue;
  }

  let json;
  try {
    json = command.data.toJSON();
  } catch (err) {
    errors.push(`[comando] ${where}: data.toJSON() falla — ${err.message.split('\n')[0]}`);
    continue;
  }

  if (json.name !== command.name) {
    errors.push(`[comando] ${where}: "name" (${command.name}) no coincide con data.name (${json.name})`);
  }
  if (!COMMAND_NAME_REGEX.test(json.name) || json.name !== json.name.toLowerCase()) {
    errors.push(`[comando] ${where}: nombre inválido para Discord: "${json.name}"`);
  }
  if (!json.description || json.description.length > 100) {
    errors.push(`[comando] ${where}: la descripción debe tener entre 1 y 100 caracteres`);
  }

  validateOptions(json.options, json.name);
}

// ── Resultado ──────────────────────────────────────────────────
console.log(`Comandos encontrados: ${seenNames.size} (${seenAliases.size} alias)\n`);

for (const warning of warnings) console.log(`AVISO  ${warning}`);
if (warnings.length > 0) console.log('');

// Se usa `process.exitCode` en lugar de `process.exit()`: en Windows, salir
// de golpe corta la salida pendiente cuando se redirige a un archivo o a otro
// proceso, y el resumen se perdía.
if (errors.length === 0) {
  console.log(`Sin errores. ${files.length} archivos verificados.`);
  process.exitCode = 0;
} else {
  for (const error of errors) console.error(`ERROR  ${error}`);
  console.error(`\n${errors.length} error(es) encontrados.`);
  process.exitCode = 1;
}

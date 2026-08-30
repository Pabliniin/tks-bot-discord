'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const TKClient = require('../src/structures/TKClient');
const { COMMAND_CATEGORIES, MODULES } = require('@tkbot/shared');

/**
 * Comprueba que el bot se ensambla correctamente sin conectar con Discord.
 * Detecta comandos rotos, alias duplicados y descuadres con la web.
 */

/** Crea un cliente y carga todo, pero sin hacer login. */
function buildClient() {
  const client = new TKClient();
  client.loadCommands();
  client.loadModules();
  return client;
}

test('todos los comandos se cargan sin errores', () => {
  const client = buildClient();
  assert.ok(client.commands.size > 0, 'no se cargó ningún comando');
});

test('cada comando declara nombre, categoría, descripción y execute', () => {
  const client = buildClient();

  for (const [name, command] of client.commands) {
    assert.equal(typeof command.name, 'string', `${name}: falta name`);
    assert.equal(command.name, name, `${name}: la clave no coincide con el nombre`);
    assert.equal(typeof command.execute, 'function', `${name}: falta execute`);
    assert.ok(command.description, `${name}: falta description`);
    assert.ok(
      COMMAND_CATEGORIES[command.category],
      `${name}: categoría desconocida "${command.category}"`
    );
  }
});

test('los nombres de comando cumplen el formato de Discord', () => {
  const client = buildClient();
  const valido = /^[-_'\p{L}\p{N}]{1,32}$/u;

  for (const [name] of client.commands) {
    assert.match(name, valido, `nombre inválido: ${name}`);
    assert.equal(name, name.toLowerCase(), `${name}: debe ir en minúsculas`);
  }
});

test('no hay alias duplicados ni que choquen con un comando', () => {
  const client = buildClient();
  const vistos = new Map();

  for (const [alias, target] of client.aliases) {
    assert.ok(!vistos.has(alias), `alias duplicado: ${alias}`);
    assert.ok(
      !client.commands.has(alias),
      `el alias "${alias}" (de ${target}) choca con un comando existente`
    );
    vistos.set(alias, target);
  }
});

test('data.toJSON() de cada comando respeta los límites de Discord', () => {
  const client = buildClient();

  for (const [name, command] of client.commands) {
    if (!command.data) continue;

    const json = command.data.toJSON();
    assert.equal(json.name, name, `${name}: data.name no coincide`);
    assert.ok(json.description.length <= 100, `${name}: descripción demasiado larga`);
    assert.ok((json.options || []).length <= 25, `${name}: demasiadas opciones`);

    for (const option of json.options || []) {
      assert.ok(
        option.description.length <= 100,
        `${name}.${option.name}: descripción demasiado larga`
      );
      assert.equal(
        option.name,
        option.name.toLowerCase(),
        `${name}.${option.name}: debe ir en minúsculas`
      );
    }
  }
});

test('las opciones obligatorias van antes que las opcionales', () => {
  const client = buildClient();

  /** Discord rechaza el registro si el orden es incorrecto. */
  const check = (options, where) => {
    let vistaOpcional = false;
    for (const option of options || []) {
      if (option.type === 1 || option.type === 2) {
        check(option.options, `${where}.${option.name}`);
        continue;
      }
      if (option.required) {
        assert.ok(!vistaOpcional, `${where}: "${option.name}" obligatoria tras una opcional`);
      } else {
        vistaOpcional = true;
      }
    }
  };

  for (const [name, command] of client.commands) {
    if (command.data) check(command.data.toJSON().options, name);
  }
});

test('todos los módulos se cargan y exponen un nombre', () => {
  const client = buildClient();
  assert.ok(client.modules.size > 0, 'no se cargó ningún módulo');

  for (const [name, mod] of client.modules) {
    assert.equal(typeof name, 'string');
    assert.ok(mod, `el módulo ${name} está vacío`);
  }
});

test('los módulos con componentes declaran su prefijo y su manejador', () => {
  const client = buildClient();

  for (const [name, mod] of client.modules) {
    if (!mod.componentPrefixes) continue;
    assert.ok(Array.isArray(mod.componentPrefixes), `${name}: componentPrefixes debe ser un array`);
    assert.equal(
      typeof mod.handleComponent,
      'function',
      `${name}: declara prefijos pero no tiene handleComponent`
    );
  }
});

test('no hay dos módulos que se disputen el mismo prefijo de componente', () => {
  const client = buildClient();
  const vistos = new Map();

  for (const [name, mod] of client.modules) {
    for (const prefix of mod.componentPrefixes || []) {
      assert.ok(
        !vistos.has(prefix),
        `el prefijo "${prefix}" lo usan ${vistos.get(prefix)} y ${name}`
      );
      vistos.set(prefix, name);
    }
  }
});

test('todos los archivos de eventos exportan eventos válidos', () => {
  const dir = path.join(__dirname, '..', 'src', 'events');

  const walk = (d) =>
    fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(d, e.name);
      return e.isDirectory() ? walk(full) : e.name.endsWith('.js') ? [full] : [];
    });

  for (const file of walk(dir)) {
    const exported = require(file);
    const list = Array.isArray(exported) ? exported : [exported];

    for (const event of list) {
      assert.ok(event.name, `${path.basename(file)}: evento sin nombre`);
      assert.equal(
        typeof event.execute,
        'function',
        `${path.basename(file)}: el evento ${event.name} no tiene execute`
      );
    }
  }
});

test('cada módulo del panel tiene su rama en el esquema del servidor', () => {
  const { Guild } = require('@tkbot/shared');
  const paths = Object.keys(Guild.schema.paths).concat(Object.keys(Guild.schema.singleNestedPaths || {}));
  const raiz = new Set(paths.map((p) => p.split('.')[0]));

  for (const mod of MODULES) {
    // `welcome` cubre también `goodbye`; el resto coincide uno a uno.
    assert.ok(
      raiz.has(mod.id),
      `el módulo "${mod.id}" no tiene configuración en el esquema Guild`
    );
  }
});

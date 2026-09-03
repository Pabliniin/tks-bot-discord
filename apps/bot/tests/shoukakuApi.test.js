'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { Shoukaku, Connectors, LoadType } = require('shoukaku');

/**
 * Comprobación de la API de Shoukaku.
 *
 * Estas pruebas existen por un fallo real: el módulo de música llamaba a
 * `shoukaku.connector.handleRaw()`, un método que no existe. Como solo se
 * ejecuta cuando llega un paquete de voz, no lo veía nadie hasta que el bot
 * ya estaba en producción, y allí soltaba un error por cada paquete.
 *
 * Nada de esto necesita un Lavalink en marcha: solo se mira que las piezas
 * que usamos existan y se llamen como creemos.
 *
 * Se ejecutan con: npm run test --workspace @tkbot/bot
 */

test('el conector de discord.js existe y es construible', () => {
  assert.equal(typeof Connectors.DiscordJS, 'function');
});

test('el conector se engancha solo a los eventos del cliente', () => {
  /*
   * Esta es la prueba que habría evitado el fallo. El conector llama a
   * `listen()` por su cuenta desde el constructor de Shoukaku, así que el
   * módulo NO debe reenviarle los paquetes a mano.
   */
  const escuchados = [];

  const clienteFalso = {
    on: (evento) => escuchados.push(evento),
    once: (evento) => escuchados.push(evento),
    user: { id: '123456789012345678' },
    ws: { shards: new Map() },
  };

  // Sin nodos no se conecta a ningún sitio, pero `listen()` sí se ejecuta.
  const instancia = new Shoukaku(new Connectors.DiscordJS(clienteFalso), []);

  assert.ok(escuchados.includes('raw'), 'el conector debería escuchar «raw» él solo');
  assert.ok(
    escuchados.includes('clientReady'),
    'el conector debería esperar a «clientReady» él solo'
  );

  // Y el método que se intentaba llamar a mano no existe: es `raw`, no `handleRaw`.
  assert.equal(
    typeof instancia.connector.handleRaw,
    'undefined',
    'si algún día existe, revisar el comentario de music.js'
  );
  assert.equal(typeof instancia.connector.raw, 'function');
});

test('los métodos de Shoukaku que usa el módulo existen', () => {
  const metodos = ['getIdealNode', 'joinVoiceChannel', 'leaveVoiceChannel', 'addNode'];

  for (const metodo of metodos) {
    assert.equal(
      typeof Shoukaku.prototype[metodo],
      'function',
      `Shoukaku ya no tiene «${metodo}»: revisa modules/music.js`
    );
  }
});

test('los métodos del reproductor que usa el módulo existen', () => {
  // Se toma la clase del propio paquete para no depender de una instancia.
  const { Player } = require('shoukaku');

  const metodos = [
    'playTrack',
    'stopTrack',
    'setPaused',
    'seekTo',
    'setGlobalVolume',
    'setFilters',
    'destroy',
  ];

  for (const metodo of metodos) {
    assert.equal(
      typeof Player.prototype[metodo],
      'function',
      `Player ya no tiene «${metodo}»: revisa modules/music.js`
    );
  }
});

test('los tipos de resultado de búsqueda son los que espera el módulo', () => {
  // `buscar()` compara contra estos valores en un `switch`.
  assert.equal(LoadType.TRACK, 'track');
  assert.equal(LoadType.PLAYLIST, 'playlist');
  assert.equal(LoadType.SEARCH, 'search');
  assert.equal(LoadType.EMPTY, 'empty');
  assert.equal(LoadType.ERROR, 'error');
});

test('el módulo de música no reenvía paquetes a mano', () => {
  // Comprobación sobre el propio código fuente: si alguien vuelve a añadir
  // un `client.on('raw', …)` en el módulo, esta prueba lo caza.
  const fs = require('node:fs');
  const ruta = require.resolve('../src/modules/music');

  // Se quitan los comentarios antes de mirar: el propio archivo explica por
  // qué NO hay que hacerlo, y esa explicación no debe hacer saltar la prueba.
  const codigo = fs
    .readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  assert.ok(
    !/client\.on\(\s*['"]raw['"]/.test(codigo),
    'el conector de Shoukaku ya escucha «raw»: reenviarlo a mano duplica el trabajo y rompe'
  );
});

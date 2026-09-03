'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const music = require('../src/modules/music');

/**
 * Pruebas del freno de fallos consecutivos.
 *
 * Cuando la fuente entera está caída (YouTube bloqueado, Lavalink caído...),
 * cada canción de la cola fallaba una detrás de otra y el bot bombardeaba el
 * canal con un aviso por cada una hasta vaciar la cola entera. Ahora, tras
 * `MAX_FALLOS_SEGUIDOS` fallos SIN que suene nada de por medio, se rinde de
 * una vez con un solo aviso en vez de seguir intentándolo canción a canción.
 *
 * Se ejecutan con: npm run test --workspace @tkbot/bot
 */

/** Cola mínima de mentira: solo lo que tocan `avisar` y `programarInactividad`. */
function colaFalsa() {
  return {
    guildId: 'g1',
    textChannelId: 'canal-que-no-existe',
    tracks: [{ info: { title: 'a' } }, { info: { title: 'b' } }],
    current: { info: { title: 'actual' } },
    fallosConsecutivos: 0,
    temporizador: null,
  };
}

/** Cliente de mentira: sin el canal, `avisar` no revienta y no manda nada de verdad. */
function clienteFalso() {
  return { channels: { cache: new Map() } };
}

test('no se rinde antes de tiempo: los primeros fallos no vacían la cola', () => {
  const cola = colaFalsa();
  const client = clienteFalso();

  for (let i = 0; i < music.MAX_FALLOS_SEGUIDOS - 1; i++) {
    const rendido = music.manejarFalloDeReproduccion(client, cola);
    assert.equal(rendido, false, `no debería rendirse en el fallo ${i + 1}`);
  }

  assert.equal(cola.tracks.length, 2, 'la cola sigue intacta mientras no se llegue al límite');
});

test('al llegar al límite de fallos seguidos, se vacía la cola y se avisa una sola vez', () => {
  const cola = colaFalsa();
  const client = clienteFalso();

  let rendido = false;
  for (let i = 0; i < music.MAX_FALLOS_SEGUIDOS; i++) {
    rendido = music.manejarFalloDeReproduccion(client, cola);
  }

  assert.equal(rendido, true, 'debe rendirse justo al llegar al límite');
  assert.deepEqual(cola.tracks, [], 'la cola queda vacía');
  assert.equal(cola.current, null, 'se olvida lo que sonaba');
  assert.equal(cola.fallosConsecutivos, 0, 'el contador se reinicia tras rendirse');

  music.cancelarInactividad(cola);
});

test('el límite es un número pequeño de verdad, no cero ni negativo', () => {
  // Si esto fuera 0 o negativo, se rendiría en el primerísimo fallo y jamás
  // le daría a una fuente que solo tropieza una vez una segunda oportunidad.
  assert.ok(Number.isInteger(music.MAX_FALLOS_SEGUIDOS));
  assert.ok(music.MAX_FALLOS_SEGUIDOS >= 2);
  assert.ok(music.MAX_FALLOS_SEGUIDOS <= 10, 'demasiado alto y volvemos a bombardear el canal como antes');
});

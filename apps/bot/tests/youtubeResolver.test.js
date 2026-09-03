'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const music = require('../src/modules/music');

/**
 * Pruebas del enrutado hacia el resolutor de YouTube (yt-dlp).
 *
 * El plugin de YouTube de Lavalink falla siempre desde este servidor (ver
 * MUSICA.md), así que `buscar()` intenta primero un resolutor propio para
 * cualquier cosa que vaya a acabar pidiéndole algo a YouTube. Estas pruebas
 * cubren solo la parte que no necesita red: qué cuenta como "de YouTube" y
 * cómo se lee la configuración. La llamada real al resolutor y a Lavalink
 * se prueba a mano contra el servicio en marcha (no hay Lavalink en CI).
 *
 * Se ejecutan con: npm run test --workspace @tkbot/bot
 */

test('una URL de youtube.com o youtu.be cuenta como YouTube', () => {
  assert.ok(music.esConsultaDeYoutube('https://youtube.com/watch?v=abc', 'ytsearch', true));
  assert.ok(music.esConsultaDeYoutube('https://www.youtube.com/watch?v=abc', 'ytsearch', true));
  assert.ok(music.esConsultaDeYoutube('https://youtu.be/abc', 'ytsearch', true));
});

test('una URL de otra fuente no cuenta como YouTube', () => {
  assert.equal(
    music.esConsultaDeYoutube('https://c418.bandcamp.com/album/minecraft-volume-alpha', 'ytsearch', true),
    false
  );
  assert.equal(music.esConsultaDeYoutube('https://soundcloud.com/algo', 'scsearch', true), false);
});

test('un texto libre se decide por la fuente elegida, no por la URL', () => {
  assert.ok(music.esConsultaDeYoutube('never gonna give you up', 'ytsearch', false));
  assert.ok(music.esConsultaDeYoutube('never gonna give you up', 'ytmsearch', false));
  assert.equal(music.esConsultaDeYoutube('never gonna give you up', 'scsearch', false), false);
  assert.equal(music.esConsultaDeYoutube('never gonna give you up', 'dzsearch', false), false);
});

test('sin YT_RESOLVER_URL o YT_RESOLVER_TOKEN, la configuración es nula', () => {
  const previos = { url: process.env.YT_RESOLVER_URL, token: process.env.YT_RESOLVER_TOKEN };
  try {
    delete process.env.YT_RESOLVER_URL;
    delete process.env.YT_RESOLVER_TOKEN;
    assert.equal(music.leerConfiguracionYoutube(), null);

    process.env.YT_RESOLVER_URL = 'http://tks_bot_ytresolver:8000';
    assert.equal(music.leerConfiguracionYoutube(), null, 'falta el token');
  } finally {
    if (previos.url === undefined) delete process.env.YT_RESOLVER_URL;
    else process.env.YT_RESOLVER_URL = previos.url;
    if (previos.token === undefined) delete process.env.YT_RESOLVER_TOKEN;
    else process.env.YT_RESOLVER_TOKEN = previos.token;
  }
});

test('con ambas variables, se limpia la barra final de la URL', () => {
  const previos = { url: process.env.YT_RESOLVER_URL, token: process.env.YT_RESOLVER_TOKEN };
  try {
    process.env.YT_RESOLVER_URL = 'http://tks_bot_ytresolver:8000/';
    process.env.YT_RESOLVER_TOKEN = 'secreto';

    const configuracion = music.leerConfiguracionYoutube();
    assert.deepEqual(configuracion, { url: 'http://tks_bot_ytresolver:8000', token: 'secreto' });
  } finally {
    if (previos.url === undefined) delete process.env.YT_RESOLVER_URL;
    else process.env.YT_RESOLVER_URL = previos.url;
    if (previos.token === undefined) delete process.env.YT_RESOLVER_TOKEN;
    else process.env.YT_RESOLVER_TOKEN = previos.token;
  }
});

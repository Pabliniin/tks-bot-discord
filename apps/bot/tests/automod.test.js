'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const f = require('../src/utils/automodFilters');

test('detecta invitaciones de Discord en todas sus formas', () => {
  const positivos = [
    'entra a discord.gg/abc123',
    'https://discord.gg/abc123',
    'https://discord.com/invite/abc123',
    'http://discordapp.com/invite/abc123',
    'www.discord.gg/abc123',
    'mira esto DISCORD.GG/ABC123 ahora',
  ];
  for (const texto of positivos) {
    assert.equal(f.hasInvite(texto), true, `debería detectar: ${texto}`);
  }

  const negativos = ['hola qué tal', 'discord es una app', 'gg wp', 'discord.com/channels/123'];
  for (const texto of negativos) {
    assert.equal(f.hasInvite(texto), false, `no debería detectar: ${texto}`);
  }
});

test('permite las invitaciones del propio servidor si está configurado', () => {
  const opciones = { allowOwnInvites: true, guildInviteCodes: ['propio'] };

  assert.equal(f.hasInvite('discord.gg/propio', opciones), false);
  assert.equal(f.hasInvite('discord.gg/ajeno', opciones), true);
  // Una mezcla sigue infringiendo por la ajena.
  assert.equal(f.hasInvite('discord.gg/propio y discord.gg/ajeno', opciones), true);
});

test('detecta enlaces y respeta la lista blanca', () => {
  assert.equal(f.hasLink('mira https://google.com'), true);
  assert.equal(f.hasLink('www.ejemplo.org'), true);
  assert.equal(f.hasLink('ejemplo.com/ruta'), true);
  assert.equal(f.hasLink('sin enlaces aquí'), false);

  const permitidos = ['youtube.com', 'twitch.tv'];
  assert.equal(f.hasLink('https://youtube.com/watch?v=1', permitidos), false);
  assert.equal(f.hasLink('https://www.youtube.com/watch?v=1', permitidos), false);
  assert.equal(f.hasLink('https://otrositio.com', permitidos), true);
});

test('encuentra palabras prohibidas ignorando mayúsculas y tildes', () => {
  const lista = ['tonto', 'idiota'];

  assert.equal(f.findBannedWord('eres un TONTO', lista), 'tonto');
  assert.equal(f.findBannedWord('qué idióta eres', lista), 'idiota');
  assert.equal(f.findBannedWord('tonto.', lista), 'tonto');
  assert.equal(f.findBannedWord('¡tonto!', lista), 'tonto');
  assert.equal(f.findBannedWord('hola amigo', lista), null);
});

test('no marca palabras prohibidas incrustadas en otras', () => {
  const lista = ['ano'];
  assert.equal(f.findBannedWord('el piano suena bien', lista), null);
  assert.equal(f.findBannedWord('un plano del edificio', lista), null);
  assert.equal(f.findBannedWord('ano', lista), 'ano');
});

test('el comodín *palabra* sí busca dentro de otras palabras', () => {
  assert.equal(f.findBannedWord('supertontito', ['*tont*']), '*tont*');
  assert.equal(f.findBannedWord('nada raro', ['*tont*']), null);
});

test('una lista vacía nunca marca nada', () => {
  assert.equal(f.findBannedWord('cualquier cosa', []), null);
  assert.equal(f.findBannedWord('cualquier cosa', undefined), null);
});

test('el filtro de mayúsculas respeta el umbral y la longitud mínima', () => {
  assert.equal(f.hasExcessiveCaps('HOLA COMO ESTAS TODOS', 70, 10), true);
  assert.equal(f.hasExcessiveCaps('hola como estas todos', 70, 10), false);
  // Demasiado corto para aplicar el filtro.
  assert.equal(f.hasExcessiveCaps('OK', 70, 10), false);
  // Mezcla justo por debajo del umbral.
  assert.equal(f.hasExcessiveCaps('Hola Que Tal Amigos', 90, 10), false);
});

test('cuenta menciones de usuarios, roles y everyone', () => {
  const menciones = [
    '<@111111111111111111>',
    '<@222222222222222222>',
    '<@&333333333333333333>',
  ].join(' ');

  assert.equal(f.hasExcessiveMentions(menciones, 2), true);
  assert.equal(f.hasExcessiveMentions(menciones, 3), false);
  assert.equal(f.hasExcessiveMentions('@everyone', 0), true);
  assert.equal(f.hasExcessiveMentions('sin menciones', 0), false);
});

test('cuenta emojis unicode y personalizados juntos', () => {
  assert.equal(f.hasExcessiveEmojis('😀😀😀', 2), true);
  assert.equal(f.hasExcessiveEmojis('<:tk:123456789012345678> <:tk:123456789012345678>', 1), true);
  assert.equal(f.hasExcessiveEmojis('😀 <:tk:123456789012345678>', 2), false);
  assert.equal(f.hasExcessiveEmojis('texto normal', 0), false);
});

test('detecta zalgo sin marcar texto acentuado normal', () => {
  assert.equal(f.isZalgo('h̀́̂̃ò́̂̃l̀́̂̃à́̂̃'), true);
  assert.equal(f.isZalgo('hola qué tal, cómo estás'), false);
  // Demasiado corto para decidir.
  assert.equal(f.isZalgo('áé'), false);
});

test('cuenta los saltos de línea', () => {
  assert.equal(f.hasExcessiveNewlines('a\nb\nc', 1), true);
  assert.equal(f.hasExcessiveNewlines('a\nb', 2), false);
});

test('los filtros no fallan con entradas raras', () => {
  for (const valor of [null, undefined, '', 12345, {}]) {
    assert.doesNotThrow(() => {
      f.hasInvite(valor);
      f.hasLink(valor);
      f.findBannedWord(valor, ['x']);
      f.hasExcessiveCaps(valor);
      f.hasExcessiveMentions(valor);
      f.hasExcessiveEmojis(valor);
      f.isZalgo(valor);
      f.hasExcessiveNewlines(valor);
    }, `falló con ${String(valor)}`);
  }
});

test('las expresiones regulares globales no arrastran estado entre llamadas', () => {
  // Un fallo clásico: `lastIndex` de un regex con /g hace que la segunda
  // llamada con el mismo texto devuelva un resultado distinto.
  const texto = 'discord.gg/abc123';
  assert.equal(f.hasInvite(texto), true);
  assert.equal(f.hasInvite(texto), true);
  assert.equal(f.hasInvite(texto), true);

  const enlace = 'https://ejemplo.com';
  assert.equal(f.hasLink(enlace), true);
  assert.equal(f.hasLink(enlace), true);
});

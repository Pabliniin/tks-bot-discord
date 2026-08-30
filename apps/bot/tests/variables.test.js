'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseVariables, parseEmbedVariables } = require('@tkbot/shared');

test('sustituye las variables básicas', () => {
  const datos = { user: '<@123>', server: 'TK$ Community', memberCount: 1337 };

  assert.equal(parseVariables('Hola [user]', datos), 'Hola <@123>');
  assert.equal(
    parseVariables('Bienvenido a [server], somos [memberCount]', datos),
    'Bienvenido a TK$ Community, somos 1337'
  );
});

test('la sustitución no distingue mayúsculas', () => {
  const datos = { userName: 'Rogue' };
  assert.equal(parseVariables('[userName]', datos), 'Rogue');
  assert.equal(parseVariables('[username]', datos), 'Rogue');
  assert.equal(parseVariables('[USERNAME]', datos), 'Rogue');
});

test('las variables desconocidas se dejan intactas', () => {
  assert.equal(parseVariables('Hola [noexiste]', { user: 'x' }), 'Hola [noexiste]');
});

test('acepta variables con punto, como [user.tag]', () => {
  const datos = { 'user.tag': 'Rogue#0001', 'user.username': 'Rogue' };
  assert.equal(parseVariables('[user.tag] / [user.username]', datos), 'Rogue#0001 / Rogue');
});

test('trata entradas vacías o no textuales sin fallar', () => {
  assert.equal(parseVariables('', {}), '');
  assert.equal(parseVariables(null, {}), '');
  assert.equal(parseVariables(undefined, {}), '');
  assert.equal(parseVariables(123, {}), '');
});

test('los valores null o undefined no borran la variable', () => {
  // Mejor dejar el marcador visible que escribir "undefined" en el mensaje.
  assert.equal(parseVariables('[a] [b]', { a: null, b: undefined }), '[a] [b]');
});

test('convierte números y ceros correctamente', () => {
  assert.equal(parseVariables('Nivel [level]', { level: 0 }), 'Nivel 0');
  assert.equal(parseVariables('Nivel [level]', { level: 42 }), 'Nivel 42');
});

test('sustituye dentro de todos los campos de un embed', () => {
  const diseño = {
    title: 'Hola [userName]',
    description: 'Bienvenido a [server]',
    author: { name: '[userName]', icon: '', url: '' },
    footer: { text: 'Miembro #[memberCount]', icon: '' },
    fields: [{ name: 'Usuario', value: '[user]', inline: true }],
    thumbnail: '',
    image: '',
  };

  const resultado = parseEmbedVariables(diseño, {
    userName: 'Rogue',
    server: 'TK$',
    memberCount: 500,
    user: '<@1>',
  });

  assert.equal(resultado.title, 'Hola Rogue');
  assert.equal(resultado.description, 'Bienvenido a TK$');
  assert.equal(resultado.author.name, 'Rogue');
  assert.equal(resultado.footer.text, 'Miembro #500');
  assert.equal(resultado.fields[0].value, '<@1>');
});

test('parseEmbedVariables no modifica el objeto original', () => {
  const diseño = { title: 'Hola [userName]', fields: [] };
  const copia = JSON.parse(JSON.stringify(diseño));

  parseEmbedVariables(diseño, { userName: 'Rogue' });
  assert.deepEqual(diseño, copia);
});

test('parseEmbedVariables tolera diseños incompletos', () => {
  assert.equal(parseEmbedVariables(null, {}), null);
  assert.doesNotThrow(() => parseEmbedVariables({}, {}));
  assert.deepEqual(parseEmbedVariables({}, {}).fields, []);
});

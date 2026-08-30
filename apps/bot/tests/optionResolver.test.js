'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { SlashCommandBuilder } = require('discord.js');

const { OptionResolver, ArgumentError } = require('../src/structures/OptionResolver');
const { tokenize } = require('../src/utils/args');
const { makeGuild } = require('./helpers/mocks');

/**
 * Estas pruebas cubren la pieza que hace que un mismo comando funcione con
 * barra y con prefijo: la conversión de argumentos de texto a opciones.
 */

const fixture = makeGuild();

/** Ejecuta el resolutor sobre una cadena de argumentos. */
async function resolve(builder, input) {
  const ctx = { guild: fixture.guild, client: fixture.client, message: null };
  const json = builder.toJSON();
  const resolver = new OptionResolver(ctx, json.options || [], tokenize(input));
  await resolver.resolve();
  return resolver;
}

test('resuelve un usuario por mención y el resto como razón', async () => {
  const builder = new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Banea')
    .addUserOption((o) => o.setName('usuario').setDescription('Quién').setRequired(true))
    .addStringOption((o) => o.setName('razon').setDescription('Motivo').setRequired(false));

  const options = await resolve(builder, '<@200000000000000001> spam en varios canales');

  assert.equal(options.getUser('usuario').id, '200000000000000001');
  assert.equal(options.getString('razon'), 'spam en varios canales');
});

test('resuelve un usuario por ID suelto', async () => {
  const builder = new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulsa')
    .addUserOption((o) => o.setName('usuario').setDescription('Quién').setRequired(true));

  const options = await resolve(builder, '200000000000000002');
  assert.equal(options.getUser('usuario').username, 'Amigo');
});

test('resuelve un usuario por apodo del servidor', async () => {
  const builder = new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulsa')
    .addUserOption((o) => o.setName('usuario').setDescription('Quién').setRequired(true));

  const options = await resolve(builder, 'Colega');
  assert.equal(options.getUser('usuario').id, '200000000000000002');
});

test('getMember devuelve el miembro y getUser el usuario', async () => {
  const builder = new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulsa')
    .addUserOption((o) => o.setName('usuario').setDescription('Quién').setRequired(true));

  const options = await resolve(builder, '<@200000000000000001>');
  assert.equal(options.getMember('usuario').id, '200000000000000001');
  assert.equal(options.getUser('usuario').username, 'Rogue');
});

test('respeta las comillas para agrupar un argumento', async () => {
  const builder = new SlashCommandBuilder()
    .setName('test')
    .setDescription('Test')
    .addStringOption((o) => o.setName('a').setDescription('a').setRequired(true))
    .addStringOption((o) => o.setName('b').setDescription('b').setRequired(true));

  const options = await resolve(builder, '"primero con espacios" segundo');
  assert.equal(options.getString('a'), 'primero con espacios');
  assert.equal(options.getString('b'), 'segundo');
});

test('convierte enteros y aplica los límites del builder', async () => {
  const builder = new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Limpia')
    .addIntegerOption((o) =>
      o.setName('cantidad').setDescription('Cuántos').setRequired(true).setMinValue(1).setMaxValue(100)
    );

  const options = await resolve(builder, '50');
  assert.equal(options.getInteger('cantidad'), 50);

  await assert.rejects(() => resolve(builder, '500'), ArgumentError);
  await assert.rejects(() => resolve(builder, '0'), ArgumentError);
});

test('interpreta booleanos en español', async () => {
  const builder = new SlashCommandBuilder()
    .setName('test')
    .setDescription('Test')
    .addBooleanOption((o) => o.setName('activo').setDescription('a').setRequired(true));

  assert.equal((await resolve(builder, 'si')).getBoolean('activo'), true);
  assert.equal((await resolve(builder, 'no')).getBoolean('activo'), false);
  assert.equal((await resolve(builder, 'true')).getBoolean('activo'), true);
  assert.equal((await resolve(builder, 'activar')).getBoolean('activo'), true);
});

test('resuelve canales por mención y por nombre', async () => {
  const builder = new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Bloquea')
    .addChannelOption((o) => o.setName('canal').setDescription('Canal').setRequired(true));

  assert.equal((await resolve(builder, '<#400000000000000001>')).getChannel('canal').name, 'general');
  assert.equal((await resolve(builder, 'general')).getChannel('canal').id, '400000000000000001');
  assert.equal((await resolve(builder, '#general')).getChannel('canal').id, '400000000000000001');
});

test('resuelve roles por mención y por nombre', async () => {
  const builder = new SlashCommandBuilder()
    .setName('role')
    .setDescription('Rol')
    .addRoleOption((o) => o.setName('rol').setDescription('Rol').setRequired(true));

  assert.equal((await resolve(builder, '<@&300000000000000001>')).getRole('rol').name, 'Moderador');
  assert.equal((await resolve(builder, 'Moderador')).getRole('rol').id, '300000000000000001');
});

test('detecta el subcomando y consume sus opciones', async () => {
  const builder = new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Silencia')
    .addSubcommand((s) =>
      s
        .setName('text')
        .setDescription('Texto')
        .addUserOption((o) => o.setName('usuario').setDescription('Quién').setRequired(true))
        .addStringOption((o) => o.setName('razon').setDescription('Motivo').setRequired(false))
    )
    .addSubcommand((s) =>
      s
        .setName('voice')
        .setDescription('Voz')
        .addUserOption((o) => o.setName('usuario').setDescription('Quién').setRequired(true))
    );

  const options = await resolve(builder, 'text <@200000000000000001> hablar de más');
  assert.equal(options.getSubcommand(), 'text');
  assert.equal(options.getUser('usuario').id, '200000000000000001');
  assert.equal(options.getString('razon'), 'hablar de más');

  const voice = await resolve(builder, 'voice <@200000000000000001>');
  assert.equal(voice.getSubcommand(), 'voice');
});

test('rechaza un subcomando inexistente con un mensaje útil', async () => {
  const builder = new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Silencia')
    .addSubcommand((s) =>
      s
        .setName('text')
        .setDescription('Texto')
        .addUserOption((o) => o.setName('usuario').setDescription('Quién').setRequired(true))
    )
    .addSubcommand((s) => s.setName('voice').setDescription('Voz'));

  await assert.rejects(
    () => resolve(builder, 'inexistente <@200000000000000001>'),
    (err) => err instanceof ArgumentError && err.message.includes('text')
  );
});

test('un subcomando único puede omitirse', async () => {
  const builder = new SlashCommandBuilder()
    .setName('test')
    .setDescription('Test')
    .addSubcommand((s) =>
      s
        .setName('solo')
        .setDescription('Único')
        .addStringOption((o) => o.setName('texto').setDescription('Texto').setRequired(true))
    );

  const options = await resolve(builder, 'hola mundo');
  assert.equal(options.getSubcommand(), 'solo');
  assert.equal(options.getString('texto'), 'hola mundo');
});

test('exige las opciones obligatorias que falten', async () => {
  const builder = new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Banea')
    .addUserOption((o) => o.setName('usuario').setDescription('Quién').setRequired(true));

  await assert.rejects(
    () => resolve(builder, ''),
    (err) => err instanceof ArgumentError && err.message.includes('usuario')
  );
});

test('valida las opciones predefinidas (choices)', async () => {
  const builder = new SlashCommandBuilder()
    .setName('top')
    .setDescription('Ranking')
    .addStringOption((o) =>
      o
        .setName('tipo')
        .setDescription('Tipo')
        .setRequired(true)
        .addChoices({ name: 'Texto', value: 'text' }, { name: 'Voz', value: 'voice' })
    );

  assert.equal((await resolve(builder, 'voice')).getString('tipo'), 'voice');
  await assert.rejects(() => resolve(builder, 'otracosa'), ArgumentError);
});

test('las opciones ausentes devuelven null sin lanzar', async () => {
  const builder = new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Rango')
    .addUserOption((o) => o.setName('usuario').setDescription('Quién').setRequired(false));

  const options = await resolve(builder, '');
  assert.equal(options.getUser('usuario'), null);
  assert.equal(options.getMember('usuario'), null);
});

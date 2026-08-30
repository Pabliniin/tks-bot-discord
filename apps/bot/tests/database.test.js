'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const shared = require('@tkbot/shared');
const { connect, disconnect, getGuildSettings, Guild, Member, Case, premiumTier } = shared;

/**
 * Pruebas contra una base de datos real.
 *
 * Si no hay MongoDB disponible, se saltan en vez de fallar: así el resto de la
 * batería sigue siendo útil en una máquina sin base de datos.
 */

const TEST_GUILD_ID = '999999999999999999';
const TEST_USER_ID = '888888888888888888';

let available = false;

test.before(async () => {
  try {
    await connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tkbot_test');
    available = true;
  } catch (error) {
    console.log(`\n  (Sin MongoDB: se saltan las pruebas de base de datos — ${error.message})\n`);
  }
});

test.after(async () => {
  if (!available) return;
  // Limpieza: estas pruebas no deben dejar rastro.
  await Guild.deleteOne({ guildId: TEST_GUILD_ID }).catch(() => {});
  await Member.deleteMany({ guildId: TEST_GUILD_ID }).catch(() => {});
  await Case.deleteMany({ guildId: TEST_GUILD_ID }).catch(() => {});
  await disconnect();
});

test('crea la configuración de un servidor con los valores por defecto', async (t) => {
  if (!available) return t.skip('sin MongoDB');

  await Guild.deleteOne({ guildId: TEST_GUILD_ID });
  const settings = await getGuildSettings(TEST_GUILD_ID);

  assert.equal(settings.guildId, TEST_GUILD_ID);
  assert.equal(settings.prefix, '-', 'el prefijo por defecto debe ser "-"');
  assert.equal(settings.locale, 'es');
  assert.equal(settings.welcome.enabled, false);
  assert.equal(settings.levels.xpPerMessage, 20);
  assert.equal(settings.levels.xpCooldown, 60);
  assert.equal(settings.automod.options.capsPercentage, 70);
  assert.equal(settings.starboard.emoji, '⭐');
  assert.equal(premiumTier(settings), 0);
});

test('llamarla dos veces devuelve el mismo documento', async (t) => {
  if (!available) return t.skip('sin MongoDB');

  const a = await getGuildSettings(TEST_GUILD_ID);
  const b = await getGuildSettings(TEST_GUILD_ID);
  assert.equal(String(a._id), String(b._id));

  const count = await Guild.countDocuments({ guildId: TEST_GUILD_ID });
  assert.equal(count, 1, 'no debe crear documentos duplicados');
});

test('guarda una configuración anidada como la que envía el panel', async (t) => {
  if (!available) return t.skip('sin MongoDB');

  const settings = await getGuildSettings(TEST_GUILD_ID);

  settings.set('welcome', {
    enabled: true,
    channelId: '123456789012345678',
    message: '¡Bienvenido [user] a [server]!',
    card: { enabled: true, titleText: 'HOLA', accentColor: '#FF0000', avatarShape: 'rounded' },
  });
  settings.set('levels.roles', [
    { level: 5, roleId: '111111111111111111' },
    { level: 10, roleId: '222222222222222222' },
  ]);
  settings.set('automod.filters.invites', { enabled: true, action: 'timeout', duration: 30 });

  await settings.save();

  const reloaded = await Guild.findOne({ guildId: TEST_GUILD_ID });
  assert.equal(reloaded.welcome.enabled, true);
  assert.equal(reloaded.welcome.card.titleText, 'HOLA');
  assert.equal(reloaded.welcome.card.avatarShape, 'rounded');
  assert.equal(reloaded.levels.roles.length, 2);
  assert.equal(reloaded.levels.roles[1].level, 10);
  assert.equal(reloaded.automod.filters.invites.action, 'timeout');
  // Los campos no tocados conservan su valor por defecto.
  assert.equal(reloaded.automod.filters.invites.deleteMessage, true);
});

test('el esquema rechaza los valores fuera de rango', async (t) => {
  if (!available) return t.skip('sin MongoDB');

  const settings = await getGuildSettings(TEST_GUILD_ID);

  settings.set('levels.xpPerMessage', 99999);
  let error = settings.validateSync();
  assert.ok(error, 'debería rechazar una XP por mensaje de 99999');

  settings.set('levels.xpPerMessage', 20);
  settings.set('locale', 'klingon');
  error = settings.validateSync();
  assert.ok(error, 'debería rechazar un idioma no soportado');

  // Se deja el documento en un estado válido para las pruebas siguientes.
  settings.set('locale', 'es');
  assert.equal(settings.validateSync(), undefined);
});

test('el Map de eventos de logs se guarda y se lee bien', async (t) => {
  if (!available) return t.skip('sin MongoDB');

  const settings = await getGuildSettings(TEST_GUILD_ID);
  settings.set('logs.enabled', true);
  settings.set('logs.events', {
    messageDelete: { enabled: true, channelId: '123456789012345678' },
    memberJoin: { enabled: true, channelId: null },
  });
  await settings.save();

  const reloaded = await Guild.findOne({ guildId: TEST_GUILD_ID });
  assert.equal(reloaded.logs.events.get('messageDelete').enabled, true);
  assert.equal(reloaded.logs.events.get('messageDelete').channelId, '123456789012345678');

  // El panel recibe el documento en JSON: el Map debe convertirse en objeto.
  const plain = JSON.parse(JSON.stringify(reloaded.toObject()));
  assert.equal(plain.logs.events.messageDelete.enabled, true);
});

test('los miembros se crean con upsert sin duplicarse', async (t) => {
  if (!available) return t.skip('sin MongoDB');

  await Member.deleteMany({ guildId: TEST_GUILD_ID });

  for (let i = 0; i < 3; i += 1) {
    await Member.updateOne(
      { guildId: TEST_GUILD_ID, userId: TEST_USER_ID },
      { $inc: { xp: 20, messages: 1 }, $setOnInsert: { guildId: TEST_GUILD_ID, userId: TEST_USER_ID } },
      { upsert: true }
    );
  }

  const docs = await Member.find({ guildId: TEST_GUILD_ID, userId: TEST_USER_ID });
  assert.equal(docs.length, 1, 'el índice único debe evitar duplicados');
  assert.equal(docs[0].xp, 60);
  assert.equal(docs[0].messages, 3);
});

test('los casos de moderación se numeran de forma correlativa', async (t) => {
  if (!available) return t.skip('sin MongoDB');

  await Case.deleteMany({ guildId: TEST_GUILD_ID });

  const base = {
    guildId: TEST_GUILD_ID,
    type: 'warn',
    userId: TEST_USER_ID,
    moderatorId: '777777777777777777',
    reason: 'Prueba',
  };

  await Case.create({ ...base, caseId: 1 });
  await Case.create({ ...base, caseId: 2 });

  const last = await Case.findOne({ guildId: TEST_GUILD_ID }).sort({ caseId: -1 });
  assert.equal(last.caseId, 2);

  // El índice compuesto impide repetir el mismo número en un servidor.
  await assert.rejects(() => Case.create({ ...base, caseId: 2 }));
});

test('premiumTier trata correctamente una suscripción caducada', async (t) => {
  if (!available) return t.skip('sin MongoDB');

  const settings = await getGuildSettings(TEST_GUILD_ID);

  settings.set('premium', { tier: 2, until: new Date(Date.now() + 86_400_000) });
  assert.equal(premiumTier(settings), 2, 'una suscripción vigente cuenta');

  settings.set('premium', { tier: 2, until: new Date(Date.now() - 86_400_000) });
  assert.equal(premiumTier(settings), 0, 'una suscripción caducada cuenta como gratis');

  settings.set('premium', { tier: 1, until: null });
  assert.equal(premiumTier(settings), 1, 'sin fecha de fin, no caduca');
});

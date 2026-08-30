'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const { connect, disconnect, User } = require('@tkbot/shared');
const botStaff = require('../src/utils/botStaff');

/**
 * Pruebas de los permisos a nivel de bot.
 *
 * Importa que estén bien: de aquí depende quién puede repartir premium.
 */

const DUENO = '100000000000000001';
const OTRO_DUENO = '100000000000000002';
const PERSONAL = '200000000000000001';
const CUALQUIERA = '300000000000000001';

let disponible = false;
const OWNERS_ORIGINAL = process.env.BOT_OWNERS;

test.before(async () => {
  process.env.BOT_OWNERS = `${DUENO}, ${OTRO_DUENO}`;
  try {
    await connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tkbot_test');
    disponible = true;
  } catch {
    // Sin base de datos solo se ejecutan las pruebas que no la necesitan.
  }
});

test.after(async () => {
  process.env.BOT_OWNERS = OWNERS_ORIGINAL;
  if (!disponible) return;
  await User.deleteMany({ userId: { $in: [DUENO, OTRO_DUENO, PERSONAL, CUALQUIERA] } }).catch(() => {});
  await disconnect();
});

// ── Dueños (no necesitan base de datos) ───────────────────────

test('lee varios dueños separados por comas, con o sin espacios', () => {
  process.env.BOT_OWNERS = `${DUENO}, ${OTRO_DUENO}`;
  assert.deepEqual(botStaff.ownerIds(), [DUENO, OTRO_DUENO]);
});

test('descarta los valores que no son IDs de Discord', () => {
  process.env.BOT_OWNERS = `${DUENO},no-es-un-id,123,,${OTRO_DUENO}`;
  assert.deepEqual(botStaff.ownerIds(), [DUENO, OTRO_DUENO]);
});

test('sin dueños configurados devuelve una lista vacía', () => {
  process.env.BOT_OWNERS = '';
  assert.deepEqual(botStaff.ownerIds(), []);

  process.env.BOT_OWNERS = undefined;
  assert.deepEqual(botStaff.ownerIds(), []);

  process.env.BOT_OWNERS = `${DUENO},${OTRO_DUENO}`;
});

test('isOwner reconoce a los dueños y rechaza al resto', () => {
  process.env.BOT_OWNERS = `${DUENO},${OTRO_DUENO}`;
  assert.equal(botStaff.isOwner(DUENO), true);
  assert.equal(botStaff.isOwner(OTRO_DUENO), true);
  assert.equal(botStaff.isOwner(CUALQUIERA), false);
  assert.equal(botStaff.isOwner(''), false);
  assert.equal(botStaff.isOwner(null), false);
});

// ── Personal (necesita base de datos) ─────────────────────────

test('un usuario cualquiera no es personal', async (t) => {
  if (!disponible) return t.skip('sin MongoDB');
  await User.deleteOne({ userId: CUALQUIERA });
  assert.equal(await botStaff.isStaff(CUALQUIERA), false);
});

test('los dueños siempre cuentan como personal', async (t) => {
  if (!disponible) return t.skip('sin MongoDB');
  // Aunque no tengan documento en la base de datos.
  await User.deleteOne({ userId: DUENO });
  assert.equal(await botStaff.isStaff(DUENO), true);
});

test('se puede nombrar y destituir personal', async (t) => {
  if (!disponible) return t.skip('sin MongoDB');
  await User.deleteOne({ userId: PERSONAL });

  const alta = await botStaff.addStaff(PERSONAL, DUENO);
  assert.equal(alta.ok, true);
  assert.equal(await botStaff.isStaff(PERSONAL), true);

  const baja = await botStaff.removeStaff(PERSONAL);
  assert.equal(baja.ok, true);
  assert.equal(await botStaff.isStaff(PERSONAL), false);
});

test('guarda quién dio el permiso y cuándo', async (t) => {
  if (!disponible) return t.skip('sin MongoDB');
  await User.deleteOne({ userId: PERSONAL });
  await botStaff.addStaff(PERSONAL, DUENO);

  const doc = await User.findOne({ userId: PERSONAL }).lean();
  assert.equal(doc.botStaff.enabled, true);
  assert.equal(doc.botStaff.addedBy, DUENO);
  assert.ok(doc.botStaff.addedAt instanceof Date);
});

test('no se puede nombrar dos veces a la misma persona', async (t) => {
  if (!disponible) return t.skip('sin MongoDB');
  await User.deleteOne({ userId: PERSONAL });

  assert.equal((await botStaff.addStaff(PERSONAL, DUENO)).ok, true);
  const repetido = await botStaff.addStaff(PERSONAL, DUENO);
  assert.equal(repetido.ok, false);
  assert.match(repetido.message, /ya forma parte/i);
});

test('no se puede destituir a quien no es personal', async (t) => {
  if (!disponible) return t.skip('sin MongoDB');
  await User.deleteOne({ userId: CUALQUIERA });

  const baja = await botStaff.removeStaff(CUALQUIERA);
  assert.equal(baja.ok, false);
  assert.match(baja.message, /no forma parte/i);
});

test('NO se puede destituir a un dueño desde Discord', async (t) => {
  if (!disponible) return t.skip('sin MongoDB');
  // Esta es la protección clave: aunque una cuenta del personal se vea
  // comprometida, no puede expulsar al dueño del bot.
  const baja = await botStaff.removeStaff(DUENO);
  assert.equal(baja.ok, false);
  assert.match(baja.message, /BOT_OWNERS/);
  assert.equal(await botStaff.isStaff(DUENO), true, 'el dueño sigue teniendo acceso');
});

test('nombrar personal a un dueño no hace nada: ya lo puede todo', async (t) => {
  if (!disponible) return t.skip('sin MongoDB');
  const alta = await botStaff.addStaff(DUENO, OTRO_DUENO);
  assert.equal(alta.ok, false);
  assert.match(alta.message, /ya es due/i);
});

test('el listado devuelve solo al personal activo, sin los dueños', async (t) => {
  if (!disponible) return t.skip('sin MongoDB');
  await User.deleteMany({ userId: { $in: [PERSONAL, CUALQUIERA] } });
  await botStaff.addStaff(PERSONAL, DUENO);

  const lista = await botStaff.listStaff();
  const ids = lista.map((d) => d.userId);

  assert.ok(ids.includes(PERSONAL), 'debe incluir al personal');
  assert.ok(!ids.includes(DUENO), 'no debe incluir a los dueños');
  assert.ok(!ids.includes(CUALQUIERA), 'no debe incluir a quien no es personal');

  // Tras destituirlo desaparece del listado.
  await botStaff.removeStaff(PERSONAL);
  const despues = await botStaff.listStaff();
  assert.ok(!despues.map((d) => d.userId).includes(PERSONAL));
});

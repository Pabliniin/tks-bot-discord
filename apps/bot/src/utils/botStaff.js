'use strict';

const { User } = require('@tkbot/shared');

/**
 * Permisos a nivel de bot (no de servidor).
 *
 * Hay dos niveles:
 *
 *   · DUEÑO   — los IDs de la variable de entorno BOT_OWNERS.
 *               Pueden todo, incluido nombrar y destituir personal.
 *               No se pueden quitar desde Discord: solo editando el .env.
 *
 *   · STAFF   — guardado en la base de datos.
 *               Puede repartir premium, pero no tocar la lista de personal.
 *
 * La separación es a propósito: aunque alguien del personal se equivoque o su
 * cuenta se vea comprometida, no puede darse más permisos ni expulsar al dueño.
 */

/** IDs de los dueños, leídos de la variable de entorno. */
function ownerIds() {
  return (process.env.BOT_OWNERS || '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => /^\d{16,20}$/.test(id));
}

/** `true` si el usuario es dueño del bot. */
function isOwner(userId) {
  return ownerIds().includes(String(userId));
}

/**
 * `true` si el usuario puede repartir premium (dueño o personal).
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
async function isStaff(userId) {
  if (isOwner(userId)) return true;

  const doc = await User.findOne({ userId: String(userId) })
    .select('botStaff.enabled')
    .lean()
    .catch(() => null);

  return Boolean(doc?.botStaff?.enabled);
}

/**
 * Nombra a alguien personal del bot.
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
async function addStaff(userId, addedBy) {
  if (isOwner(userId)) {
    return { ok: false, message: 'Esa persona ya es dueña del bot: tiene todos los permisos.' };
  }

  const existing = await User.findOne({ userId }).select('botStaff.enabled').lean();
  if (existing?.botStaff?.enabled) {
    return { ok: false, message: 'Esa persona ya forma parte del personal.' };
  }

  await User.updateOne(
    { userId },
    {
      $set: { 'botStaff.enabled': true, 'botStaff.addedBy': addedBy, 'botStaff.addedAt': new Date() },
      $setOnInsert: { userId },
    },
    { upsert: true }
  );

  return { ok: true, message: 'Añadido al personal.' };
}

/**
 * Retira el permiso a alguien del personal.
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
async function removeStaff(userId) {
  if (isOwner(userId)) {
    return {
      ok: false,
      message:
        'No puedes quitar a un dueño del bot desde aquí. Edita la variable `BOT_OWNERS` en la configuración del servidor.',
    };
  }

  const result = await User.updateOne(
    { userId, 'botStaff.enabled': true },
    { $set: { 'botStaff.enabled': false, 'botStaff.addedBy': null, 'botStaff.addedAt': null } }
  );

  if (result.matchedCount === 0) {
    return { ok: false, message: 'Esa persona no forma parte del personal.' };
  }
  return { ok: true, message: 'Retirado del personal.' };
}

/**
 * Lista del personal guardado en la base de datos.
 * No incluye a los dueños: esos salen de la variable de entorno.
 */
async function listStaff() {
  return User.find({ 'botStaff.enabled': true })
    .select('userId botStaff')
    .sort({ 'botStaff.addedAt': 1 })
    .lean()
    .catch((err) => {
      // Antes se devolvia una lista vacia en silencio: parecia que no habia
      // personal cuando en realidad habia fallado la consulta.
      require('./logger').error('No se pudo leer la lista de personal:', err.message);
      throw err;
    });
}

module.exports = { ownerIds, isOwner, isStaff, addStaff, removeStaff, listStaff };

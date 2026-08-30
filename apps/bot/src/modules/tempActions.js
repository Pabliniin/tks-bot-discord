'use strict';

const { Case, Member } = require('@tkbot/shared');

const logger = require('../utils/logger');

/**
 * Levanta automáticamente las sanciones temporales.
 *
 * Cada minuto se buscan los baneos y silencios cuya fecha de expiración ya pasó
 * y se deshacen. Al guardarse en la base de datos, siguen funcionando aunque el
 * bot se reinicie.
 */

/** Retira un baneo temporal caducado. */
async function liftBan(client, doc) {
  const guild = client.guilds.cache.get(doc.guildId);
  if (!guild) return false;

  try {
    await guild.members.unban(doc.userId, 'Baneo temporal expirado');
    logger.module('temp', `Baneo levantado: ${doc.userId} en ${guild.name}`);
    return true;
  } catch (err) {
    // Si ya no está baneado, el caso igualmente se cierra.
    logger.debug(`No se pudo levantar el baneo de ${doc.userId}: ${err.message}`);
    return false;
  }
}

/** Retira un silencio temporal caducado. */
async function liftMute(client, doc) {
  const guild = client.guilds.cache.get(doc.guildId);
  if (!guild) return false;

  const member = await guild.members.fetch(doc.userId).catch(() => null);
  if (!member) return false;

  const role = guild.roles.cache.find(
    (r) => r.name === 'Silenciado' || r.name.toLowerCase() === 'muted'
  );
  if (!role || !member.roles.cache.has(role.id)) return false;

  try {
    await member.roles.remove(role, 'Silencio temporal expirado');
    logger.module('temp', `Silencio levantado: ${doc.userId} en ${guild.name}`);
    return true;
  } catch (err) {
    logger.debug(`No se pudo levantar el silencio de ${doc.userId}: ${err.message}`);
    return false;
  }
}

/** Revisa una vez todas las sanciones caducadas. */
async function sweep(client) {
  if (!client.isReady()) return;

  const now = new Date();

  const expired = await Case.find({
    active: true,
    type: { $in: ['ban', 'mute'] },
    expiresAt: { $ne: null, $lte: now },
  })
    .limit(100)
    .catch(() => []);

  for (const doc of expired) {
    if (doc.type === 'ban') await liftBan(client, doc);
    else await liftMute(client, doc);

    // El caso se cierra pase lo que pase, para no reintentarlo eternamente.
    await Case.updateOne({ _id: doc._id }, { $set: { active: false } }).catch(() => {});

    if (doc.type === 'mute') {
      await Member.updateOne(
        { guildId: doc.guildId, userId: doc.userId },
        { $set: { mutedUntil: null } }
      ).catch(() => {});
    }
  }
}

module.exports = {
  name: 'tempActions',

  init(client) {
    const timer = setInterval(() => {
      sweep(client).catch((err) => logger.error('Error revisando sanciones temporales:', err.message));
    }, 60_000);
    timer.unref?.();
  },

  /** Al arrancar se hace una pasada por lo caducado durante la parada. */
  async onReady(client) {
    await sweep(client).catch(() => {});
  },

  sweep,
};

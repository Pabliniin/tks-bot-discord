'use strict';

const db = require('./db');
const constants = require('./constants');
const variables = require('./variables');
const leveling = require('./leveling');

const Guild = require('./models/Guild');
const Member = require('./models/Member');
const User = require('./models/User');
const Case = require('./models/Case');
const Ticket = require('./models/Ticket');
const StarboardMessage = require('./models/StarboardMessage');
const TempChannel = require('./models/TempChannel');

/**
 * Obtiene la configuración de un servidor, creándola con los valores por
 * defecto si aún no existe.
 *
 * @param {string} guildId
 * @returns {Promise<import('mongoose').Document>}
 */
async function getGuildSettings(guildId) {
  await db.connect();
  const existing = await Guild.findOne({ guildId });
  if (existing) return existing;

  // `upsert` evita la condición de carrera si dos eventos llegan a la vez.
  return Guild.findOneAndUpdate(
    { guildId },
    { $setOnInsert: { guildId } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

/**
 * Devuelve el nivel premium efectivo de un servidor.
 * Un premium caducado cuenta como nivel 0 sin necesidad de limpiarlo.
 *
 * @param {{ premium?: { tier?: number, until?: Date|null } }} settings
 * @returns {number} 0, 1 o 2.
 */
function premiumTier(settings) {
  const tier = Number(settings?.premium?.tier) || 0;
  if (tier === 0) return 0;
  const until = settings?.premium?.until;
  if (until && new Date(until).getTime() < Date.now()) return 0;
  return tier;
}

/** Límites del plan de un servidor. */
function premiumLimits(settings) {
  return constants.PREMIUM_TIERS[premiumTier(settings)] || constants.PREMIUM_TIERS[0];
}

module.exports = {
  ...db,
  ...constants,
  ...variables,
  ...leveling,
  models: { Guild, Member, User, Case, Ticket, StarboardMessage, TempChannel },
  Guild,
  Member,
  User,
  Case,
  Ticket,
  StarboardMessage,
  TempChannel,
  getGuildSettings,
  premiumTier,
  premiumLimits,
};

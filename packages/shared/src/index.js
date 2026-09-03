'use strict';

const db = require('./db');
const constants = require('./constants');
const variables = require('./variables');
const leveling = require('./leveling');
const premium = require('./premium');
const backup = require('./backup');
const templates = require('./templates');
const automodSimulator = require('./automodSimulator');
const plans = require('./plans');
const giveaways = require('./giveaways');
const repairIndexes = require('./repairIndexes');

const Guild = require('./models/Guild');
const Member = require('./models/Member');
const User = require('./models/User');
const Case = require('./models/Case');
const Ticket = require('./models/Ticket');
const StarboardMessage = require('./models/StarboardMessage');
const TempChannel = require('./models/TempChannel');
const BotInstance = require('./models/BotInstance');
const ConfigHistory = require('./models/ConfigHistory');
const Appeal = require('./models/Appeal');
const GuildStats = require('./models/GuildStats');
const StripeEvent = require('./models/StripeEvent');
const Giveaway = require('./models/Giveaway');

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


module.exports = {
  ...db,
  ...constants,
  ...variables,
  ...leveling,
  ...premium,
  ...backup,
  ...templates,
  ...automodSimulator,
  ...plans,
  ...giveaways,
  ...repairIndexes,
  models: {
    Guild,
    Member,
    User,
    Case,
    Ticket,
    StarboardMessage,
    TempChannel,
    BotInstance,
    ConfigHistory,
    Appeal,
    GuildStats,
    StripeEvent,
    Giveaway,
  },
  Guild,
  Member,
  User,
  Case,
  Ticket,
  StarboardMessage,
  TempChannel,
  BotInstance,
  ConfigHistory,
  Appeal,
  GuildStats,
  StripeEvent,
  Giveaway,
  getGuildSettings,
};

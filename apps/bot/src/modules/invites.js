'use strict';

const { PermissionsBitField } = require('discord.js');
const { Member } = require('@tkbot/shared');
const logger = require('../utils/logger');

/**
 * Seguimiento de invitaciones.
 *
 * Discord no dice quién invitó a un miembro, así que se guarda el número de
 * usos de cada invitación y al entrar alguien se busca cuál subió.
 */

/** `guildId` → Map<code, usos>. */
const cache = new Map();

/** Descarga y cachea las invitaciones de un servidor. */
async function refresh(guild) {
  if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageGuild)) return null;

  try {
    const invites = await guild.invites.fetch();
    const counts = new Map();
    for (const [code, invite] of invites) counts.set(code, invite.uses ?? 0);

    // La invitación de vanity URL también cuenta.
    if (guild.vanityURLCode) {
      try {
        const vanity = await guild.fetchVanityData();
        counts.set(guild.vanityURLCode, vanity.uses ?? 0);
      } catch {
        // El servidor puede haber perdido el nivel de boost necesario.
      }
    }

    cache.set(guild.id, counts);
    return counts;
  } catch (err) {
    logger.debug(`No se pudieron leer las invitaciones de ${guild.id}: ${err.message}`);
    return null;
  }
}

/**
 * Averigua quién invitó al miembro recién llegado y actualiza los contadores.
 * @returns {Promise<import('discord.js').User|null>}
 */
async function resolveInviter(guild, member) {
  const before = cache.get(guild.id);
  const after = await refresh(guild);
  if (!before || !after) return null;

  // La invitación usada es aquella cuyo contador ha subido.
  for (const [code, uses] of after) {
    const previous = before.get(code) ?? 0;
    if (uses > previous) {
      try {
        const invites = await guild.invites.fetch();
        const invite = invites.get(code);
        const inviter = invite?.inviter ?? null;

        if (inviter && inviter.id !== member.id) {
          await Member.updateOne(
            { guildId: guild.id, userId: inviter.id },
            {
              $inc: { 'invites.total': 1 },
              $setOnInsert: { guildId: guild.id, userId: inviter.id },
            },
            { upsert: true }
          );
          await Member.updateOne(
            { guildId: guild.id, userId: member.id },
            { $set: { invitedBy: inviter.id }, $setOnInsert: { guildId: guild.id, userId: member.id } },
            { upsert: true }
          );
        }
        return inviter;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Descuenta la invitación cuando el miembro invitado abandona el servidor. */
async function handleLeave(guild, userId) {
  try {
    const doc = await Member.findOne({ guildId: guild.id, userId }).select('invitedBy').lean();
    if (!doc?.invitedBy) return;
    await Member.updateOne(
      { guildId: guild.id, userId: doc.invitedBy },
      { $inc: { 'invites.left': 1 } }
    );
  } catch (err) {
    logger.debug(`No se pudo actualizar el contador de invitaciones: ${err.message}`);
  }
}

module.exports = {
  name: 'invites',
  cache,
  refresh,
  resolveInviter,
  handleLeave,

  /** Precarga las invitaciones de todos los servidores al arrancar. */
  async onReady(client) {
    let loaded = 0;
    for (const [, guild] of client.guilds.cache) {
      const result = await refresh(guild);
      if (result) loaded += 1;
    }
    logger.module('inv', `Invitaciones cacheadas en ${loaded} servidores`);
  },
};

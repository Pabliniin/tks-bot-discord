'use strict';

const { PermissionsBitField, ChannelType } = require('discord.js');
const logger = require('./logger');

const ROLE_NAME = 'Silenciado';

/**
 * Busca el rol de silencio del servidor y, si no existe, lo crea y lo aplica
 * a todos los canales.
 *
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<import('discord.js').Role|null>}
 */
async function getOrCreateMuteRole(guild) {
  const existing = guild.roles.cache.find(
    (role) => role.name === ROLE_NAME || role.name.toLowerCase() === 'muted'
  );
  if (existing) return existing;

  if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) return null;

  let role;
  try {
    role = await guild.roles.create({
      name: ROLE_NAME,
      color: 0x818386,
      permissions: [],
      reason: 'Rol de silencio de TK$ Bot',
    });
  } catch (err) {
    logger.error('No se pudo crear el rol de silencio:', err.message);
    return null;
  }

  await applyToChannels(guild, role);
  return role;
}

/**
 * Deniega escribir y hablar al rol en todos los canales.
 * Los fallos por canal se ignoran: basta con que se aplique donde se pueda.
 */
async function applyToChannels(guild, role) {
  for (const [, channel] of guild.channels.cache) {
    try {
      if (channel.type === ChannelType.GuildCategory) {
        await channel.permissionOverwrites.edit(role, {
          SendMessages: false,
          AddReactions: false,
          Speak: false,
          SendMessagesInThreads: false,
          CreatePublicThreads: false,
          CreatePrivateThreads: false,
        });
      } else if (channel.isTextBased()) {
        await channel.permissionOverwrites.edit(role, {
          SendMessages: false,
          AddReactions: false,
          SendMessagesInThreads: false,
          CreatePublicThreads: false,
          CreatePrivateThreads: false,
        });
      } else if (channel.isVoiceBased()) {
        await channel.permissionOverwrites.edit(role, { Speak: false, Connect: false });
      }
    } catch {
      // Puede faltar permiso en canales concretos; se continúa con el resto.
    }
  }
}

module.exports = { ROLE_NAME, getOrCreateMuteRole, applyToChannels };

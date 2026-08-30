'use strict';

const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { EMBED_COLORS, premiumTier } = require('@tkbot/shared');

const logger = require('../utils/logger');

/**
 * Protección VIP (anti-nuke).
 *
 * Limita cuántas acciones destructivas puede hacer un mismo usuario por minuto.
 * Al superar el límite se le retiran los roles, se expulsa o se banea.
 */

/** `guildId:userId:accion` → { count, expires }. */
const counters = new Map();
const WINDOW = 60_000;

/** Permisos que permiten destruir un servidor. */
const DANGEROUS_PERMISSIONS = [
  PermissionsBitField.Flags.Administrator,
  PermissionsBitField.Flags.ManageGuild,
  PermissionsBitField.Flags.ManageRoles,
  PermissionsBitField.Flags.ManageChannels,
  PermissionsBitField.Flags.ManageWebhooks,
  PermissionsBitField.Flags.BanMembers,
  PermissionsBitField.Flags.KickMembers,
];

/** ¿El usuario está exento de la protección? */
function isExempt(guild, member, settings) {
  const config = settings.vipProtection;
  if (!member) return true;
  // El dueño y el propio bot nunca se sancionan.
  if (member.id === guild.ownerId) return true;
  if (member.id === guild.members.me?.id) return true;
  if ((config.whitelistUsers || []).includes(member.id)) return true;
  return (config.whitelistRoles || []).some((r) => member.roles?.cache?.has(r));
}

/** Avisa al canal de alertas. */
async function alert(guild, settings, description) {
  const channelId = settings.vipProtection.alertChannelId || settings.logs?.defaultChannelId;
  if (!channelId) return;

  const channel = guild.channels.cache.get(channelId);
  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.error)
    .setTitle('🛡️ Protección VIP')
    .setDescription(description)
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});
}

/** Aplica el castigo configurado a quien superó el límite. */
async function applyPunishment(guild, member, settings, reason) {
  const punishment = settings.vipProtection.punishment || 'removeRoles';

  try {
    switch (punishment) {
      case 'removeRoles': {
        const removable = member.roles.cache.filter(
          (role) =>
            role.id !== guild.id &&
            !role.managed &&
            guild.members.me.roles.highest.comparePositionTo(role) > 0
        );
        if (removable.size > 0) await member.roles.remove(removable, reason);
        return `Se le han retirado ${removable.size} rol(es).`;
      }
      case 'kick':
        await member.kick(reason);
        return 'Ha sido expulsado del servidor.';
      case 'ban':
        await member.ban({ reason });
        return 'Ha sido baneado del servidor.';
      default:
        return 'No se ha aplicado ninguna acción (configurado como "ninguno").';
    }
  } catch (err) {
    logger.error('Protección VIP no pudo aplicar el castigo:', err.message);
    return `No he podido aplicar la acción: ${err.message}`;
  }
}

module.exports = {
  name: 'vipProtection',

  /**
   * Cuenta una acción sensible y sanciona si se supera el límite.
   *
   * @param {string} userId Quién realizó la acción.
   * @param {string} limitKey Clave dentro de `vipProtection.limits`.
   */
  async track(client, guild, settings, userId, limitKey) {
    const config = settings.vipProtection;
    if (!config?.enabled) return;
    if (premiumTier(settings) === 0) return;

    const limit = config.limits?.[limitKey];
    // Un límite de 0 desactiva esa comprobación.
    if (!limit || limit <= 0) return;

    const member = await guild.members.fetch(userId).catch(() => null);
    if (isExempt(guild, member, settings)) return;

    const key = `${guild.id}:${userId}:${limitKey}`;
    const now = Date.now();
    const entry = counters.get(key);

    if (!entry || now > entry.expires) {
      counters.set(key, { count: 1, expires: now + WINDOW });
      return;
    }

    entry.count += 1;
    if (entry.count <= limit) return;

    counters.delete(key);

    const reason = `[Protección VIP] Límite superado: ${limitKey} (${entry.count} en 1 minuto)`;
    const outcome = await applyPunishment(guild, member, settings, reason);

    await alert(
      guild,
      settings,
      `**${member.user.tag}** ha superado el límite de \`${limitKey}\` (${entry.count} en un minuto).\n${outcome}`
    );
  },

  /** Impide repartir roles con permisos peligrosos. */
  async checkRoleGrant(client, member, settings, addedRoles) {
    const config = settings.vipProtection;
    if (!config?.enabled || !config.blockDangerousRoles) return;
    if (premiumTier(settings) === 0) return;
    if (isExempt(member.guild, member, settings)) return;

    const dangerous = addedRoles.filter((role) =>
      DANGEROUS_PERMISSIONS.some((flag) => role.permissions.has(flag))
    );
    if (dangerous.size === 0) return;

    const removable = dangerous.filter(
      (role) => member.guild.members.me.roles.highest.comparePositionTo(role) > 0
    );
    if (removable.size === 0) return;

    await member.roles
      .remove(removable, '[Protección VIP] Rol con permisos peligrosos')
      .catch(() => {});

    await alert(
      member.guild,
      settings,
      `Se ha retirado a **${member.user.tag}** el/los rol(es) ${removable
        .map((r) => `\`${r.name}\``)
        .join(', ')} por contener permisos peligrosos.`
    );
  },

  /** Expulsa bots añadidos por alguien no autorizado. */
  async checkBotJoin(client, member, settings) {
    const config = settings.vipProtection;
    if (!config?.enabled || !config.blockBots) return false;
    if (premiumTier(settings) === 0) return false;
    if (!member.user.bot) return false;
    if ((config.whitelistUsers || []).includes(member.id)) return false;

    await member.kick('[Protección VIP] Bots no autorizados bloqueados').catch(() => {});
    await alert(member.guild, settings, `Se ha bloqueado la entrada del bot **${member.user.tag}**.`);
    return true;
  },

  isExempt,
  counters,
};

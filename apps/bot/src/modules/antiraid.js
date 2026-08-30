'use strict';

const { EmbedBuilder, GuildVerificationLevel } = require('discord.js');
const { EMBED_COLORS, premiumTier } = require('@tkbot/shared');

const { formatDuration } = require('../utils/time');
const logger = require('../utils/logger');

/**
 * Anti-Raid.
 *
 * Cuenta las entradas recientes; si superan el umbral en la ventana indicada,
 * se considera un raid y se sanciona a los implicados.
 */

/** `guildId` → { joins: number[], raiding: boolean, until: number }. */
const state = new Map();

function getState(guildId) {
  if (!state.has(guildId)) {
    state.set(guildId, { joins: [], raiding: false, until: 0 });
  }
  return state.get(guildId);
}

/** Sube el nivel de verificación del servidor durante el raid. */
async function lockdown(guild, seconds) {
  const previous = guild.verificationLevel;
  try {
    await guild.setVerificationLevel(GuildVerificationLevel.High, 'Anti-Raid activado');
  } catch (err) {
    logger.debug(`No se pudo activar el bloqueo: ${err.message}`);
    return;
  }

  setTimeout(async () => {
    try {
      await guild.setVerificationLevel(previous, 'Anti-Raid finalizado');
    } catch {
      // El nivel se restaurará manualmente si falla.
    }
  }, seconds * 1000).unref?.();
}

/** Avisa al canal de alertas configurado. */
async function alert(guild, settings, description) {
  const channelId = settings.antiraid.alertChannelId || settings.logs?.defaultChannelId;
  if (!channelId) return;

  const channel = guild.channels.cache.get(channelId);
  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.error)
    .setTitle('🚨 Anti-Raid')
    .setDescription(description)
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});
}

/** Aplica la sanción configurada al miembro. */
async function punish(member, action, reason) {
  try {
    switch (action) {
      case 'kick':
        await member.kick(reason);
        return true;
      case 'ban':
        await member.ban({ reason });
        return true;
      case 'timeout':
        await member.timeout(3_600_000, reason);
        return true;
      default:
        return false;
    }
  } catch (err) {
    logger.debug(`Anti-Raid no pudo sancionar a ${member.id}: ${err.message}`);
    return false;
  }
}

module.exports = {
  name: 'antiraid',

  /**
   * Evalúa una entrada al servidor.
   * @returns {Promise<boolean>} `true` si el miembro fue sancionado.
   */
  async handleJoin(client, member, settings) {
    const config = settings.antiraid;
    if (!config?.enabled) return false;
    // Es una función premium.
    if (premiumTier(settings) === 0) return false;

    // Roles exentos (por ejemplo, cuentas verificadas de un servidor asociado).
    if ((config.whitelistRoles || []).some((r) => member.roles.cache.has(r))) return false;

    const guild = member.guild;
    const now = Date.now();
    const data = getState(guild.id);

    // ── Antigüedad mínima de la cuenta ───────────────────────────
    if (config.minAccountAge > 0) {
      const ageDays = (now - member.user.createdTimestamp) / 86_400_000;
      if (ageDays < config.minAccountAge) {
        const reason = `[Anti-Raid] Cuenta con menos de ${config.minAccountAge} días`;
        const done = await punish(member, config.action === 'none' ? 'kick' : config.action, reason);
        if (done) {
          await alert(
            guild,
            settings,
            `Se ha bloqueado a **${member.user.tag}**: cuenta creada hace ${ageDays.toFixed(1)} días.`
          );
        }
        return done;
      }
    }

    // ── Ventana de entradas ──────────────────────────────────────
    const window = (config.joinWindow || 10) * 1000;
    data.joins = data.joins.filter((t) => now - t < window);
    data.joins.push(now);

    const threshold = config.joinThreshold || 10;

    // Ya se detectó un raid: se sigue sancionando durante el periodo activo.
    if (data.raiding && now < data.until) {
      const reason = '[Anti-Raid] Entrada durante un raid detectado';
      return punish(member, config.action, reason);
    }

    if (data.joins.length < threshold) return false;

    // ── Raid detectado ───────────────────────────────────────────
    data.raiding = true;
    data.until = now + (config.lockdownDuration || 600) * 1000;

    logger.warn(`Anti-Raid activado en ${guild.name} (${data.joins.length} entradas)`);

    await alert(
      guild,
      settings,
      [
        `**Raid detectado.** ${data.joins.length} entradas en ${config.joinWindow}s.`,
        `Acción aplicada: \`${config.action}\``,
        config.lockdown
          ? `El servidor quedará en verificación alta durante ${formatDuration((config.lockdownDuration || 600) * 1000)}.`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    );

    if (config.lockdown) {
      await lockdown(guild, config.lockdownDuration || 600);
    }

    // Restablece el estado al terminar el periodo.
    setTimeout(() => {
      const current = getState(guild.id);
      current.raiding = false;
      current.joins = [];
    }, (config.lockdownDuration || 600) * 1000).unref?.();

    return punish(member, config.action, '[Anti-Raid] Raid detectado');
  },

  state,
};

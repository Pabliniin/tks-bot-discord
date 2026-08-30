'use strict';

const { PREMIUM_TIERS } = require('./constants.json');

/**
 * Lógica de las suscripciones premium.
 *
 * Hay dos tipos, y conviene no mezclarlos:
 *
 *   · Premium de SERVIDOR — vive en `Guild.premium`. Es el que desbloquea las
 *     funciones (Anti-Raid, más embeds…) para todos los miembros de ese servidor.
 *
 *   · Premium de USUARIO — vive en `User.premium`. Es lo que alguien compra o
 *     recibe. Por sí solo no desbloquea nada: hay que aplicarlo a un servidor,
 *     y entonces se copia al premium de ese servidor.
 *
 * Ambos usan la misma forma `{ tier, until }`, así que comparten las funciones
 * de abajo.
 */

/** Cuántos servidores puede activar cada nivel con su premium personal. */
const SERVIDORES_POR_NIVEL = { 0: 0, 1: 1, 2: 3 };

/**
 * Nivel efectivo de una suscripción, teniendo en cuenta si ha caducado.
 *
 * @param {{ tier?: number, until?: Date|string|null }} premium
 * @returns {0|1|2}
 */
function effectiveTier(premium) {
  const tier = Number(premium?.tier) || 0;
  if (tier === 0) return 0;

  const until = premium?.until;
  if (until && new Date(until).getTime() <= Date.now()) return 0;

  return tier === 2 ? 2 : 1;
}

/** Nivel premium efectivo de un servidor. */
function premiumTier(guildSettings) {
  return effectiveTier(guildSettings?.premium);
}

/** Nivel premium efectivo de un usuario. */
function userPremiumTier(userDoc) {
  return effectiveTier(userDoc?.premium);
}

/** Límites del plan de un servidor. */
function premiumLimits(guildSettings) {
  return PREMIUM_TIERS[premiumTier(guildSettings)] || PREMIUM_TIERS[0];
}

/**
 * Resumen de una suscripción, listo para mostrar en la web o en un embed.
 *
 * @param {{ tier?: number, until?: Date|string|null, grantedBy?: string|null }} premium
 * @returns {{
 *   tier: number, name: string, active: boolean, permanent: boolean,
 *   until: string|null, expiresInMs: number|null, daysLeft: number|null,
 *   expired: boolean, storedTier: number, limits: object, grantedBy: string|null
 * }}
 */
function premiumStatus(premium) {
  const storedTier = Number(premium?.tier) || 0;
  const tier = effectiveTier(premium);
  const until = premium?.until ? new Date(premium.until) : null;

  const expiresInMs = until ? until.getTime() - Date.now() : null;

  return {
    tier,
    name: (PREMIUM_TIERS[tier] || PREMIUM_TIERS[0]).name,
    active: tier > 0,
    // Con nivel pero sin fecha de fin, no caduca nunca.
    permanent: tier > 0 && !until,
    until: until ? until.toISOString() : null,
    expiresInMs,
    daysLeft: expiresInMs !== null ? Math.max(0, Math.ceil(expiresInMs / 86_400_000)) : null,
    // Tenía premium guardado, pero la fecha ya pasó.
    expired: storedTier > 0 && tier === 0,
    storedTier,
    limits: PREMIUM_TIERS[tier] || PREMIUM_TIERS[0],
    grantedBy: premium?.grantedBy || null,
  };
}

/** Cuántos servidores puede activar un usuario con su premium personal. */
function maxGuildsFor(tier) {
  return SERVIDORES_POR_NIVEL[effectiveTier({ tier })] ?? 0;
}

/**
 * ¿Puede este usuario aplicar su premium personal a un servidor más?
 *
 * @param {object} userDoc Documento del usuario.
 * @param {string} guildId Servidor al que quiere aplicarlo.
 * @returns {{ ok: boolean, reason?: string, used: number, max: number }}
 */
function canApplyToGuild(userDoc, guildId) {
  const tier = userPremiumTier(userDoc);
  const aplicados = userDoc?.premium?.guilds || [];
  const max = maxGuildsFor(tier);

  if (tier === 0) {
    return { ok: false, reason: 'No tienes ninguna suscripción premium activa.', used: 0, max: 0 };
  }
  if (aplicados.includes(guildId)) {
    return { ok: false, reason: 'Ya has activado tu premium en este servidor.', used: aplicados.length, max };
  }
  if (aplicados.length >= max) {
    return {
      ok: false,
      reason: `Tu plan permite ${max} servidor(es) y ya los tienes todos ocupados. Quita el premium de otro servidor primero.`,
      used: aplicados.length,
      max,
    };
  }

  return { ok: true, used: aplicados.length, max };
}

module.exports = {
  PREMIUM_TIERS,
  SERVIDORES_POR_NIVEL,
  effectiveTier,
  premiumTier,
  userPremiumTier,
  premiumLimits,
  premiumStatus,
  maxGuildsFor,
  canApplyToGuild,
};

'use strict';

const {
  Member,
  levelFromXp,
  calculateMessageXp,
  rolesForLevel,
  parseVariables,
  levelVariables,
} = require('@tkbot/shared');

const embeds = require('../utils/embeds');
const permissions = require('../utils/permissions');
const logger = require('../utils/logger');

/**
 * Sistema de niveles.
 *
 * Para no escribir en la base de datos en cada mensaje, los mensajes se cuentan
 * en memoria y solo se vuelcan cuando toca otorgar XP (una vez por `xpCooldown`).
 */

/** @type {Map<string, { messages: number, lastGrant: number }>} */
const buffer = new Map();

/** Miembros actualmente en voz: `guildId:userId` → marca de entrada. */
const voiceSessions = new Map();

/** `true` si el canal o los roles del miembro están excluidos del sistema. */
function isIgnored(settings, message) {
  const config = settings.levels;
  if ((config.ignoredChannels || []).includes(message.channel.id)) return true;
  // También se ignora la categoría padre del canal.
  if (message.channel.parentId && (config.ignoredChannels || []).includes(message.channel.parentId)) {
    return true;
  }
  return (config.ignoredRoles || []).some((roleId) => message.member?.roles.cache.has(roleId));
}

/**
 * Aplica los roles que correspondan al nivel alcanzado.
 * @returns {Promise<string[]>} Nombres de los roles otorgados.
 */
async function applyLevelRoles(member, settings, level) {
  const config = settings.levels;
  const { add, remove } = rolesForLevel(config.roles, level, config.stackRoles);
  if (add.length === 0 && remove.length === 0) return [];

  const granted = [];

  for (const roleId of add) {
    const role = member.guild.roles.cache.get(roleId);
    if (!role || member.roles.cache.has(roleId)) continue;
    if (!permissions.canManageRole(member.guild, role)) {
      logger.debug(`No puedo asignar el rol de nivel ${role.name} (jerarquía o permisos).`);
      continue;
    }
    try {
      await member.roles.add(role, `Nivel ${level} alcanzado`);
      granted.push(role.name);
    } catch (err) {
      logger.debug(`Error asignando rol de nivel: ${err.message}`);
    }
  }

  for (const roleId of remove) {
    if (!member.roles.cache.has(roleId)) continue;
    const role = member.guild.roles.cache.get(roleId);
    if (!role || !permissions.canManageRole(member.guild, role)) continue;
    await member.roles.remove(role, 'Rol de nivel sustituido').catch(() => {});
  }

  return granted;
}

/** Envía el anuncio de subida de nivel donde corresponda. */
async function announce(client, member, settings, level, oldLevel, sourceChannel) {
  const config = settings.levels;
  const mode = config.announceMode || 'current';
  if (mode === 'none') return;

  const variables = levelVariables(member, level, oldLevel);
  const content = parseVariables(config.message || '', variables);
  const embed = embeds.buildFromDesign(config.embed, variables);

  const payload = {};
  if (embed) payload.embeds = [embed];
  if (content) payload.content = content;
  if (!payload.content && !payload.embeds) return;

  let target = null;
  if (mode === 'dm') {
    await member.send(payload).catch(() => {});
    return;
  }
  if (mode === 'current') {
    target = sourceChannel;
  } else {
    // El modo guarda directamente un ID de canal.
    target = member.guild.channels.cache.get(config.announceChannelId || mode) || null;
  }

  if (!target?.isTextBased()) return;
  const missing = permissions.missingChannelPermissions(target, ['SendMessages', 'ViewChannel']);
  if (missing.length > 0) return;

  const sent = await target.send(payload).catch(() => null);

  if (sent && config.deleteAfter > 0) {
    setTimeout(() => sent.delete().catch(() => {}), config.deleteAfter * 1000).unref?.();
  }
}

/**
 * Suma XP a un miembro y gestiona la subida de nivel.
 * @returns {Promise<{ leveled: boolean, level: number }>}
 */
async function grantXp(client, member, settings, amount, messages, sourceChannel) {
  const doc = await Member.findOneAndUpdate(
    { guildId: member.guild.id, userId: member.id },
    { $inc: { xp: amount, messages }, $set: { lastXpAt: new Date() } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const newLevel = levelFromXp(doc.xp);
  const oldLevel = doc.level ?? 0;

  if (newLevel === oldLevel) return { leveled: false, level: newLevel };

  await Member.updateOne({ _id: doc._id }, { $set: { level: newLevel } });

  // Solo se anuncia y se premia al subir, nunca al bajar (p. ej. tras `setxp`).
  if (newLevel > oldLevel) {
    await applyLevelRoles(member, settings, newLevel).catch(() => {});
    await announce(client, member, settings, newLevel, oldLevel, sourceChannel).catch(() => {});
  }

  return { leveled: newLevel > oldLevel, level: newLevel };
}

module.exports = {
  name: 'levels',

  /** Otorga XP por mensaje respetando el cooldown configurado. */
  async handleMessage(client, message, settings) {
    if (!settings.levels?.enabled) return;
    if (!message.member) return;
    if (isIgnored(settings, message)) return;

    const key = `${message.guild.id}:${message.author.id}`;
    const entry = buffer.get(key) || { messages: 0, lastGrant: 0 };
    entry.messages += 1;

    const cooldown = (settings.levels.xpCooldown ?? 60) * 1000;
    const now = Date.now();

    if (now - entry.lastGrant < cooldown) {
      buffer.set(key, entry);
      return;
    }

    const amount = calculateMessageXp(settings.levels, [...message.member.roles.cache.keys()]);
    const messages = entry.messages;

    entry.messages = 0;
    entry.lastGrant = now;
    buffer.set(key, entry);

    if (amount <= 0) return;

    try {
      await grantXp(client, message.member, settings, amount, messages, message.channel);
    } catch (err) {
      logger.error('Error otorgando XP:', err.message);
    }
  },

  /** Marca la entrada y salida de canales de voz para el XP por voz. */
  handleVoiceState(client, oldState, newState) {
    const key = `${newState.guild.id}:${newState.id}`;

    const wasIn = Boolean(oldState.channelId);
    const isIn = Boolean(newState.channelId);

    if (!wasIn && isIn) {
      voiceSessions.set(key, Date.now());
    } else if (wasIn && !isIn) {
      voiceSessions.delete(key);
    }
  },

  /**
   * Cada minuto reparte XP de voz y acumula minutos.
   * Se ignora a quien esté solo, silenciado por sí mismo o en el canal AFK.
   */
  init(client) {
    const timer = setInterval(async () => {
      for (const [, guild] of client.guilds.cache) {
        let settings;
        try {
          settings = await client.settings.get(guild.id);
        } catch {
          continue;
        }
        if (!settings.levels?.enabled) continue;

        const perMinute = settings.levels.voiceXpPerMinute || 0;

        for (const [, channel] of guild.channels.cache) {
          if (!channel.isVoiceBased?.() || channel.id === guild.afkChannelId) continue;
          const humans = channel.members.filter((m) => !m.user.bot);
          // Hablar solo no cuenta.
          if (humans.size < 2) continue;

          for (const [, member] of humans) {
            if (member.voice.selfMute || member.voice.selfDeaf || member.voice.serverMute) continue;
            if ((settings.levels.ignoredChannels || []).includes(channel.id)) continue;
            if ((settings.levels.ignoredRoles || []).some((r) => member.roles.cache.has(r))) continue;

            try {
              await Member.updateOne(
                { guildId: guild.id, userId: member.id },
                { $inc: { voiceMinutes: 1 }, $setOnInsert: { guildId: guild.id, userId: member.id } },
                { upsert: true }
              );
              if (perMinute > 0) {
                await grantXp(client, member, settings, perMinute, 0, null);
              }
            } catch (err) {
              logger.debug(`XP de voz falló para ${member.id}: ${err.message}`);
            }
          }
        }
      }
    }, 60_000);

    timer.unref?.();
  },

  // Exportado para que lo usen los comandos `setxp`, `setlevel` y `reset`.
  grantXp,
  applyLevelRoles,
};

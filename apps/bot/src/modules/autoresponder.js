'use strict';

const { parseVariables, Member } = require('@tkbot/shared');

const embeds = require('../utils/embeds');
const permissions = require('../utils/permissions');
const logger = require('../utils/logger');

/**
 * Respuestas automáticas.
 *
 * Cada regla define un desencadenante, la forma de compararlo y la respuesta.
 */

/** Cooldowns por regla y usuario: `reglaId:userId` → marca de tiempo. */
const cooldowns = new Map();

/**
 * ¿El contenido activa la regla?
 * @param {string} content Mensaje recibido.
 * @param {object} rule Regla configurada.
 */
function matches(content, rule) {
  const haystack = rule.caseSensitive ? content : content.toLowerCase();
  const needle = rule.caseSensitive ? rule.trigger : String(rule.trigger || '').toLowerCase();
  if (!needle) return false;

  switch (rule.matchType) {
    case 'exact':
      return haystack.trim() === needle.trim();
    case 'startsWith':
      return haystack.startsWith(needle);
    case 'endsWith':
      return haystack.endsWith(needle);
    case 'regex':
      try {
        return new RegExp(rule.trigger, rule.caseSensitive ? '' : 'i').test(content);
      } catch {
        // Una expresión regular mal escrita en el panel no debe romper el bot.
        return false;
      }
    case 'contains':
    default:
      return haystack.includes(needle);
  }
}

/** ¿La regla se aplica en este canal y a este miembro? */
function isAllowed(rule, message) {
  if (rule.enabled === false) return false;

  const channelId = message.channel.id;
  const roles = message.member?.roles.cache;

  if ((rule.ignoredChannels || []).includes(channelId)) return false;
  if ((rule.ignoredRoles || []).some((r) => roles?.has(r))) return false;

  if ((rule.channels || []).length > 0 && !rule.channels.includes(channelId)) return false;
  if ((rule.roles || []).length > 0 && !rule.roles.some((r) => roles?.has(r))) return false;

  return true;
}

module.exports = {
  name: 'autoresponder',

  async handleMessage(client, message, settings) {
    const config = settings.autoresponder;
    if (!config?.enabled) return;

    const rules = config.responses || [];
    if (rules.length === 0) return;

    const content = message.content || '';
    if (content.length === 0) return;

    for (const rule of rules) {
      if (!isAllowed(rule, message)) continue;
      if (!matches(content, rule)) continue;

      // Cooldown por usuario.
      if (rule.cooldown > 0) {
        const key = `${rule.id}:${message.author.id}`;
        const until = cooldowns.get(key) || 0;
        if (Date.now() < until) return;
        cooldowns.set(key, Date.now() + rule.cooldown * 1000);
      }

      // `[invites]` requiere consultar la base de datos, así que solo se
      // calcula cuando la respuesta la usa de verdad.
      const variables = {
        user: `<@${message.author.id}>`,
        userName: message.author.username,
        'user.tag': message.author.tag,
        server: message.guild.name,
        memberCount: message.guild.memberCount,
      };

      const usesInvites = /\[invites\]/i.test(
        `${rule.response || ''}${JSON.stringify(rule.embed || {})}`
      );
      if (usesInvites) {
        const doc = await Member.findOne({
          guildId: message.guild.id,
          userId: message.author.id,
        })
          .select('invites')
          .lean();
        const invites = doc?.invites || {};
        variables.invites =
          (invites.total || 0) - (invites.left || 0) - (invites.fake || 0) + (invites.bonus || 0);
      }

      const payload = {};
      const text = parseVariables(rule.response || '', variables);
      if (text) payload.content = text;

      if (rule.embed?.enabled) {
        const embed = embeds.buildFromDesign(rule.embed, variables);
        if (embed) payload.embeds = [embed];
      }

      if (!payload.content && !payload.embeds) return;

      const missing = permissions.missingChannelPermissions(message.channel, [
        'SendMessages',
        'ViewChannel',
      ]);
      if (missing.length > 0) return;

      if (rule.deleteTrigger && message.deletable) {
        await message.delete().catch(() => {});
      }

      await message.channel.send(payload).catch((err) => {
        logger.debug(`No se pudo enviar la respuesta automática: ${err.message}`);
      });

      // Solo se dispara la primera regla que coincide.
      return;
    }
  },

  // Exportado para las pruebas.
  matches,
};

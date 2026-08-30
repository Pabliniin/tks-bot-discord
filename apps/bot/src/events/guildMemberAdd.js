'use strict';

const { Events } = require('discord.js');
const { Member } = require('@tkbot/shared');

const logs = require('../modules/logs');
const permissions = require('../utils/permissions');
const { discordTimestamp } = require('../utils/time');
const logger = require('../utils/logger');

/** Asigna los auto-roles configurados, respetando el retardo. */
async function applyAutoroles(member, settings) {
  const config = settings.autoroles;
  if (!config?.enabled) return;

  const roleIds = member.user.bot ? config.bots || [] : config.humans || [];
  if (roleIds.length === 0) return;

  const assign = async () => {
    // El miembro puede haberse ido durante el retardo.
    if (!member.guild.members.cache.has(member.id)) return;

    const roles = roleIds
      .map((id) => member.guild.roles.cache.get(id))
      .filter((role) => role && permissions.canManageRole(member.guild, role));

    if (roles.length === 0) return;
    await member.roles.add(roles, 'Auto-rol al entrar').catch((err) => {
      logger.debug(`No se pudieron asignar los auto-roles: ${err.message}`);
    });
  };

  if (config.delay > 0) {
    setTimeout(() => assign().catch(() => {}), config.delay * 1000).unref?.();
  } else {
    await assign();
  }
}

/** Devuelve los roles que el miembro tenía antes de irse, si procede. */
async function restoreRoles(member, settings) {
  if (!settings.autoroles?.restoreOnRejoin) return;

  const doc = await Member.findOne({ guildId: member.guild.id, userId: member.id })
    .select('savedRoles')
    .lean();
  if (!doc?.savedRoles?.length) return;

  const roles = doc.savedRoles
    .map((id) => member.guild.roles.cache.get(id))
    .filter((role) => role && permissions.canManageRole(member.guild, role));

  if (roles.length === 0) return;
  await member.roles.add(roles, 'Restauración de roles al volver').catch(() => {});
}

module.exports = {
  name: Events.GuildMemberAdd,

  async execute(client, member) {
    if (!member.guild) return;

    let settings;
    try {
      settings = await client.settings.get(member.guild.id);
    } catch {
      return;
    }

    // ── Anti-Raid: se evalúa antes que nada ──────────────────────
    const antiraid = client.modules.get('antiraid');
    if (antiraid) {
      const blocked = await antiraid.handleJoin(client, member, settings).catch((err) => {
        logger.error('Error en Anti-Raid:', err.message);
        return false;
      });
      // Si el miembro fue expulsado o baneado, no se sigue.
      if (blocked) return;
    }

    // ── Seguimiento de invitaciones ──────────────────────────────
    let inviter = null;
    const invites = client.modules.get('invites');
    if (invites) {
      inviter = await invites.resolveInviter(member.guild, member).catch(() => null);
    }

    // ── Roles ────────────────────────────────────────────────────
    await restoreRoles(member, settings).catch(() => {});
    await applyAutoroles(member, settings).catch(() => {});

    // ── Mensaje de bienvenida ────────────────────────────────────
    const welcome = client.modules.get('welcome');
    if (welcome) {
      await welcome.handleJoin(client, member, settings, inviter).catch((err) => {
        logger.error('Error en el mensaje de bienvenida:', err.message);
      });
    }

    // ── Registro ─────────────────────────────────────────────────
    const embed = logs
      .baseEmbed({ title: '📥 Miembro se unió', color: 'success', user: member.user })
      .addFields(
        { name: 'Usuario', value: `${member}`, inline: true },
        { name: 'Miembros', value: String(member.guild.memberCount), inline: true },
        {
          name: 'Cuenta creada',
          value: discordTimestamp(member.user.createdAt, 'R'),
          inline: true,
        }
      );

    if (inviter) {
      embed.addFields({ name: 'Invitado por', value: `${inviter} (\`${inviter.tag}\`)` });
    }

    await logs.send(member.guild, settings, 'memberJoin', embed);
  },
};

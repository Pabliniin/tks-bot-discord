'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const logs = require('../../modules/logs');
const { discordTimestamp, formatDuration } = require('../../utils/time');

/**
 * Registros de baneos, apodos, roles y aislamientos.
 *
 * Todos indican **quién** hizo la acción y **a quién** afectó, consultando el
 * registro de auditoría de Discord.
 */

async function loadSettings(client, guild) {
  if (!guild) return null;
  try {
    return await client.settings.get(guild.id);
  } catch {
    return null;
  }
}

/** Añade la razón que el moderador escribió, si la hubo. */
function conRazon(fields, reason) {
  if (reason) fields.push({ name: '📝 Razón', value: reason.slice(0, 1024) });
  return fields;
}

module.exports = [
  // ── Baneo ──────────────────────────────────────────────────────
  {
    name: Events.GuildBanAdd,
    async execute(client, ban) {
      const settings = await loadSettings(client, ban.guild);
      if (!settings) return;

      const { executor, reason, unavailable } = await logs.findAuditEntry(
        ban.guild,
        AuditLogEvent.MemberBanAdd,
        ban.user.id
      );

      // La Protección VIP cuenta los baneos por moderador.
      const vip = client.modules.get('vipProtection');
      if (vip && executor) {
        await vip.track(client, ban.guild, settings, executor.id, 'banLimit').catch(() => {});
      }

      const embed = logs.actionEmbed({
        title: '🔨 Ha baneado a un miembro',
        color: 'error',
        executor,
        target: ban.user,
        auditUnavailable: unavailable,
        fields: conRazon([], reason || ban.reason),
      });

      await logs.send(ban.guild, settings, 'memberBan', embed);
    },
  },

  // ── Desbaneo ───────────────────────────────────────────────────
  {
    name: Events.GuildBanRemove,
    async execute(client, ban) {
      const settings = await loadSettings(client, ban.guild);
      if (!settings) return;

      const { executor, reason, unavailable } = await logs.findAuditEntry(
        ban.guild,
        AuditLogEvent.MemberBanRemove,
        ban.user.id
      );

      const embed = logs.actionEmbed({
        title: '♻️ Ha desbaneado a un miembro',
        color: 'success',
        executor,
        target: ban.user,
        auditUnavailable: unavailable,
        fields: conRazon([], reason),
      });

      await logs.send(ban.guild, settings, 'memberUnban', embed);
    },
  },

  // ── Apodo, aislamiento y roles ─────────────────────────────────
  {
    name: Events.GuildMemberUpdate,
    async execute(client, oldMember, newMember) {
      const settings = await loadSettings(client, newMember.guild);
      if (!settings) return;
      if (logs.isIgnoredMember(settings, newMember)) return;

      const guild = newMember.guild;

      // ── Apodo ──────────────────────────────────────────────────
      if (oldMember.nickname !== newMember.nickname) {
        const { executor, reason, unavailable } = await logs.findAuditEntry(
          guild,
          AuditLogEvent.MemberUpdate,
          newMember.id,
          // Puede haber varias entradas seguidas: nos quedamos con la del apodo.
          { match: (entry) => entry.changes?.some((c) => c.key === 'nick') }
        );

        // Cambiarse el apodo a uno mismo es distinto de que te lo cambien.
        const propio = executor?.id === newMember.id;

        const embed = logs.actionEmbed({
          title: propio ? '📝 Se ha cambiado el apodo' : '📝 Ha cambiado el apodo de un miembro',
          color: 'warning',
          executor,
          target: newMember.user,
          auditUnavailable: unavailable,
          fields: conRazon(
            [
              { name: 'Antes', value: oldMember.nickname || '*sin apodo*', inline: true },
              { name: 'Después', value: newMember.nickname || '*sin apodo*', inline: true },
            ],
            reason
          ),
        });

        await logs.send(guild, settings, 'nicknameUpdate', embed);
      }

      // ── Aislamiento ────────────────────────────────────────────
      const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
      const newTimeout = newMember.communicationDisabledUntilTimestamp;

      if (oldTimeout !== newTimeout) {
        const activo = newTimeout && newTimeout > Date.now();

        const { executor, reason, unavailable } = await logs.findAuditEntry(
          guild,
          AuditLogEvent.MemberUpdate,
          newMember.id,
          {
            match: (entry) =>
              entry.changes?.some((c) => c.key === 'communication_disabled_until'),
          }
        );

        const fields = [];
        if (activo) {
          fields.push(
            {
              name: '⏳ Hasta',
              value: `${discordTimestamp(new Date(newTimeout), 'F')}\n${discordTimestamp(new Date(newTimeout), 'R')}`,
              inline: true,
            },
            {
              name: 'Duración',
              value: formatDuration(newTimeout - Date.now()),
              inline: true,
            }
          );
        }

        const embed = logs.actionEmbed({
          title: activo ? '⏳ Ha aislado a un miembro' : '✅ Ha retirado el aislamiento',
          color: activo ? 'warning' : 'success',
          executor,
          target: newMember.user,
          auditUnavailable: unavailable,
          fields: conRazon(fields, reason),
        });

        await logs.send(guild, settings, 'memberTimeout', embed);
      }

      // ── Roles ──────────────────────────────────────────────────
      const added = newMember.roles.cache.filter((r) => !oldMember.roles.cache.has(r.id));
      const removed = oldMember.roles.cache.filter((r) => !newMember.roles.cache.has(r.id));

      if (added.size > 0 || removed.size > 0) {
        // La Protección VIP vigila que no se repartan roles peligrosos.
        const vip = client.modules.get('vipProtection');
        if (vip && added.size > 0) {
          await vip.checkRoleGrant(client, newMember, settings, added).catch(() => {});
        }

        const { executor, reason, unavailable } = await logs.findAuditEntry(
          guild,
          AuditLogEvent.MemberRoleUpdate,
          newMember.id
        );

        const fields = [];
        if (added.size > 0) {
          fields.push({
            name: `➕ Roles añadidos (${added.size})`,
            value: added.map((r) => `<@&${r.id}>`).join(' ').slice(0, 1024),
          });
        }
        if (removed.size > 0) {
          fields.push({
            name: `➖ Roles quitados (${removed.size})`,
            value: removed.map((r) => `<@&${r.id}>`).join(' ').slice(0, 1024),
          });
        }

        // Título según lo que haya pasado, para leerlo de un vistazo.
        let titulo = '🎭 Ha cambiado los roles de un miembro';
        if (added.size > 0 && removed.size === 0) titulo = '🎭 Ha dado un rol a un miembro';
        if (removed.size > 0 && added.size === 0) titulo = '🎭 Ha quitado un rol a un miembro';

        const embed = logs.actionEmbed({
          title: titulo,
          color: 'warning',
          executor,
          target: newMember.user,
          auditUnavailable: unavailable,
          fields: conRazon(fields, reason),
        });

        await logs.send(guild, settings, 'memberUpdate', embed);
      }
    },
  },
];

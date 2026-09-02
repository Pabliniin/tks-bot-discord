'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const { Member } = require('@tkbot/shared');

const logs = require('../modules/logs');
const { discordTimestamp } = require('../utils/time');
const logger = require('../utils/logger');

module.exports = {
  name: Events.GuildMemberRemove,

  async execute(client, member) {
    if (!member.guild) return;

    let settings;
    try {
      settings = await client.settings.get(member.guild.id);
    } catch {
      return;
    }

    // Contadores diarios para las gráficas de crecimiento del panel.
    const dailyStats = client.modules.get('dailyStats');
    dailyStats?.registrar(member.guild.id, 'leaves');
    dailyStats?.registrarMiembros(member.guild.id, member.guild.memberCount);

    // Guarda los roles para poder restaurarlos si vuelve.
    if (settings.autoroles?.restoreOnRejoin && member.roles) {
      const roleIds = member.roles.cache
        .filter((role) => role.id !== member.guild.id && !role.managed)
        .map((role) => role.id);

      await Member.updateOne(
        { guildId: member.guild.id, userId: member.id },
        { $set: { savedRoles: roleIds }, $setOnInsert: { guildId: member.guild.id, userId: member.id } },
        { upsert: true }
      ).catch(() => {});
    }

    // Descuenta la invitación de quien lo trajo.
    const invites = client.modules.get('invites');
    if (invites) await invites.handleLeave(member.guild, member.id).catch(() => {});

    // Mensaje de despedida.
    const welcome = client.modules.get('welcome');
    if (welcome) {
      await welcome.handleLeave(client, member, settings).catch((err) => {
        logger.error('Error en el mensaje de despedida:', err.message);
      });
    }

    // Distingue entre salida voluntaria y expulsión: Discord emite el mismo
    // evento en ambos casos, y solo la auditoría dice cuál ha sido.
    const {
      executor: kicker,
      reason,
      unavailable,
    } = await logs.findAuditEntry(member.guild, AuditLogEvent.MemberKick, member.id);

    const rolesQueTenia = member.roles
      ? member.roles.cache
          .filter((r) => r.id !== member.guild.id)
          .map((r) => `<@&${r.id}>`)
          .slice(0, 20)
      : [];

    if (kicker) {
      const fields = [
        { name: 'Miembros restantes', value: String(member.guild.memberCount), inline: true },
        {
          name: 'Llevaba en el servidor',
          value: member.joinedAt ? discordTimestamp(member.joinedAt, 'R') : 'Desconocido',
          inline: true,
        },
      ];
      if (reason) fields.push({ name: '📝 Razón', value: reason.slice(0, 1024) });

      const embed = logs.actionEmbed({
        title: '👢 Ha expulsado a un miembro',
        color: 'warning',
        executor: kicker,
        target: member.user,
        auditUnavailable: unavailable,
        fields,
      });

      await logs.send(member.guild, settings, 'memberKick', embed);
      return;
    }

    // Se marchó por su cuenta.
    const fields = [
      { name: 'Miembros restantes', value: String(member.guild.memberCount), inline: true },
      {
        name: 'Se unió',
        value: member.joinedAt ? discordTimestamp(member.joinedAt, 'R') : 'Desconocido',
        inline: true,
      },
    ];

    if (rolesQueTenia.length > 0) {
      fields.push({
        name: 'Roles que tenía',
        value: rolesQueTenia.join(' ').slice(0, 1024),
      });
    }

    const embed = logs.actionEmbed({
      title: '📤 Se ha ido del servidor',
      color: 'error',
      executor: member.user,
      detail: 'Se ha marchado por su cuenta.',
      fields,
    });

    await logs.send(member.guild, settings, 'memberLeave', embed);
  },
};

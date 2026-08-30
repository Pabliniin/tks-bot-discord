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

    // Distingue entre salida voluntaria y expulsión.
    const kicker = await logs.findExecutor(member.guild, AuditLogEvent.MemberKick, member.id);

    if (kicker) {
      const embed = logs
        .baseEmbed({ title: '👢 Miembro expulsado', color: 'warning', user: member.user })
        .addFields(
          { name: 'Usuario', value: `${member.user.tag}`, inline: true },
          { name: 'Moderador', value: `${kicker}`, inline: true }
        );
      await logs.send(member.guild, settings, 'memberKick', embed);
      return;
    }

    const embed = logs
      .baseEmbed({ title: '📤 Miembro se fue', color: 'error', user: member.user })
      .addFields(
        { name: 'Usuario', value: `${member.user.tag}`, inline: true },
        { name: 'Miembros', value: String(member.guild.memberCount), inline: true },
        {
          name: 'Se unió',
          value: member.joinedAt ? discordTimestamp(member.joinedAt, 'R') : 'Desconocido',
          inline: true,
        }
      );

    if (member.roles) {
      const roles = member.roles.cache
        .filter((r) => r.id !== member.guild.id)
        .map((r) => `<@&${r.id}>`)
        .slice(0, 20);
      if (roles.length > 0) {
        embed.addFields({ name: 'Roles que tenía', value: roles.join(' ').slice(0, 1024) });
      }
    }

    await logs.send(member.guild, settings, 'memberLeave', embed);
  },
};

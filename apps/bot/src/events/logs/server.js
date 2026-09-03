'use strict';

const { Events, AuditLogEvent, ChannelType } = require('discord.js');
const logs = require('../../modules/logs');

/** Registros de roles, canales, invitaciones, emojis y ajustes del servidor. */

/** Nombres legibles de los tipos de canal. */
const CHANNEL_TYPES = {
  [ChannelType.GuildText]: 'Texto',
  [ChannelType.GuildVoice]: 'Voz',
  [ChannelType.GuildCategory]: 'Categoría',
  [ChannelType.GuildAnnouncement]: 'Anuncios',
  [ChannelType.GuildStageVoice]: 'Escenario',
  [ChannelType.GuildForum]: 'Foro',
  [ChannelType.GuildMedia]: 'Multimedia',
  [ChannelType.PublicThread]: 'Hilo público',
  [ChannelType.PrivateThread]: 'Hilo privado',
  [ChannelType.AnnouncementThread]: 'Hilo de anuncios',
};

/** Carga la configuración del servidor de forma tolerante a fallos. */
async function loadSettings(client, guild) {
  if (!guild) return null;
  try {
    return await client.settings.get(guild.id);
  } catch {
    return null;
  }
}

/**
 * Añade quién realizó la acción, con el mismo formato que el resto de
 * registros: mención, nombre e identificador. Si no se ha podido averiguar,
 * lo dice en lugar de callarse.
 */
function withExecutor(embed, executor, unavailable = false) {
  if (executor) {
    embed.setAuthor({
      name: `${executor.tag ?? executor.username} (${executor.id})`,
      iconURL: executor.displayAvatarURL?.() ?? undefined,
    });
    embed.addFields({ name: '👮 Lo ha hecho', value: logs.describeUser(executor), inline: true });
  } else {
    embed.addFields({
      name: '👮 Lo ha hecho',
      value: unavailable
        ? 'No se ha podido saber.\n*Falta el permiso «Ver registro de auditoría».*'
        : 'No se ha podido determinar.',
      inline: true,
    });
  }
  return embed;
}

module.exports = [
  // ── Roles ──────────────────────────────────────────────────────
  {
    name: Events.GuildRoleCreate,
    async execute(client, role) {
      const settings = await loadSettings(client, role.guild);
      if (!settings) return;

      const { executor, unavailable } = await logs.findAuditEntry(role.guild, AuditLogEvent.RoleCreate, role.id);
      const embed = logs
        .baseEmbed({ title: '🎭 Ha creado un rol', color: 'success' })
        .addFields(
          { name: 'Rol', value: `${role} (\`${role.name}\`)`, inline: true },
          { name: 'ID', value: `\`${role.id}\``, inline: true },
          { name: 'Color', value: role.hexColor, inline: true }
        );

      await logs.send(role.guild, settings, 'roleCreate', withExecutor(embed, executor, unavailable));
    },
  },

  {
    name: Events.GuildRoleDelete,
    async execute(client, role) {
      const settings = await loadSettings(client, role.guild);
      if (!settings) return;

      const { executor, unavailable } = await logs.findAuditEntry(role.guild, AuditLogEvent.RoleDelete, role.id);
      const embed = logs
        .baseEmbed({ title: '🎭 Ha eliminado un rol', color: 'error' })
        .addFields(
          { name: 'Rol', value: `\`${role.name}\``, inline: true },
          { name: 'ID', value: `\`${role.id}\``, inline: true },
          { name: 'Miembros', value: String(role.members?.size ?? 0), inline: true }
        );

      await logs.send(role.guild, settings, 'roleDelete', withExecutor(embed, executor, unavailable));
    },
  },

  {
    name: Events.GuildRoleUpdate,
    async execute(client, oldRole, newRole) {
      const settings = await loadSettings(client, newRole.guild);
      if (!settings) return;

      const changes = [];
      if (oldRole.name !== newRole.name) {
        changes.push(`**Nombre:** \`${oldRole.name}\` → \`${newRole.name}\``);
      }
      if (oldRole.hexColor !== newRole.hexColor) {
        changes.push(`**Color:** ${oldRole.hexColor} → ${newRole.hexColor}`);
      }
      if (oldRole.hoist !== newRole.hoist) {
        changes.push(`**Mostrar por separado:** ${oldRole.hoist ? 'sí' : 'no'} → ${newRole.hoist ? 'sí' : 'no'}`);
      }
      if (oldRole.mentionable !== newRole.mentionable) {
        changes.push(
          `**Mencionable:** ${oldRole.mentionable ? 'sí' : 'no'} → ${newRole.mentionable ? 'sí' : 'no'}`
        );
      }
      if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
        const added = newRole.permissions.toArray().filter((p) => !oldRole.permissions.has(p));
        const removed = oldRole.permissions.toArray().filter((p) => !newRole.permissions.has(p));
        if (added.length) changes.push(`**Permisos añadidos:** ${added.join(', ')}`);
        if (removed.length) changes.push(`**Permisos quitados:** ${removed.join(', ')}`);
      }

      if (changes.length === 0) return;

      const { executor, unavailable } = await logs.findAuditEntry(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);
      const embed = logs
        .baseEmbed({
          title: '🎭 Ha modificado un rol',
          color: 'warning',
          description: `${newRole}\n\n${changes.join('\n')}`.slice(0, 4096),
        });

      await logs.send(newRole.guild, settings, 'roleUpdate', withExecutor(embed, executor, unavailable));
    },
  },

  // ── Canales ────────────────────────────────────────────────────
  {
    name: Events.ChannelCreate,
    async execute(client, channel) {
      if (!channel.guild) return;
      const settings = await loadSettings(client, channel.guild);
      if (!settings || logs.isIgnoredChannel(settings, channel)) return;

      const { executor, unavailable } = await logs.findAuditEntry(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
      const embed = logs
        .baseEmbed({ title: '📁 Ha creado un canal', color: 'success' })
        .addFields(
          { name: 'Canal', value: `${channel} (\`${channel.name}\`)`, inline: true },
          { name: 'Tipo', value: CHANNEL_TYPES[channel.type] || String(channel.type), inline: true }
        );

      await logs.send(channel.guild, settings, 'channelCreate', withExecutor(embed, executor, unavailable));
    },
  },

  {
    name: Events.ChannelDelete,
    async execute(client, channel) {
      if (!channel.guild) return;
      const settings = await loadSettings(client, channel.guild);
      if (!settings || logs.isIgnoredChannel(settings, channel)) return;

      const { executor, unavailable } = await logs.findAuditEntry(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
      const embed = logs
        .baseEmbed({ title: '📁 Ha eliminado un canal', color: 'error' })
        .addFields(
          { name: 'Canal', value: `\`${channel.name}\``, inline: true },
          { name: 'Tipo', value: CHANNEL_TYPES[channel.type] || String(channel.type), inline: true },
          { name: 'ID', value: `\`${channel.id}\``, inline: true }
        );

      await logs.send(channel.guild, settings, 'channelDelete', withExecutor(embed, executor, unavailable));
    },
  },

  {
    name: Events.ChannelUpdate,
    async execute(client, oldChannel, newChannel) {
      if (!newChannel.guild) return;
      const settings = await loadSettings(client, newChannel.guild);
      if (!settings || logs.isIgnoredChannel(settings, newChannel)) return;

      const changes = [];
      if (oldChannel.name !== newChannel.name) {
        changes.push(`**Nombre:** \`${oldChannel.name}\` → \`${newChannel.name}\``);
      }
      if (oldChannel.topic !== newChannel.topic) {
        changes.push(`**Descripción:** ${oldChannel.topic || '*vacía*'} → ${newChannel.topic || '*vacía*'}`);
      }
      if (oldChannel.nsfw !== newChannel.nsfw) {
        changes.push(`**NSFW:** ${oldChannel.nsfw ? 'sí' : 'no'} → ${newChannel.nsfw ? 'sí' : 'no'}`);
      }
      if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
        changes.push(
          `**Modo lento:** ${oldChannel.rateLimitPerUser || 0}s → ${newChannel.rateLimitPerUser || 0}s`
        );
      }
      if (oldChannel.parentId !== newChannel.parentId) {
        changes.push(
          `**Categoría:** ${oldChannel.parent?.name || 'ninguna'} → ${newChannel.parent?.name || 'ninguna'}`
        );
      }

      if (changes.length === 0) return;

      const { executor, unavailable } = await logs.findAuditEntry(
        newChannel.guild,
        AuditLogEvent.ChannelUpdate,
        newChannel.id
      );
      const embed = logs.baseEmbed({
        title: '📁 Ha modificado un canal',
        color: 'warning',
        description: `${newChannel}\n\n${changes.join('\n')}`.slice(0, 4096),
      });

      await logs.send(newChannel.guild, settings, 'channelUpdate', withExecutor(embed, executor, unavailable));
    },
  },

  // ── Invitaciones ───────────────────────────────────────────────
  {
    name: Events.InviteCreate,
    async execute(client, invite) {
      const settings = await loadSettings(client, invite.guild);
      if (!settings) return;

      // Mantiene sincronizado el seguimiento de invitaciones.
      const tracker = client.modules.get('invites');
      if (tracker) await tracker.refresh(invite.guild).catch(() => {});

      const embed = logs
        .baseEmbed({ title: '🔗 Ha creado una invitación', color: 'success', user: invite.inviter ?? undefined })
        .addFields(
          { name: 'Código', value: `\`${invite.code}\``, inline: true },
          { name: 'Canal', value: `${invite.channel}`, inline: true },
          { name: 'Usos máximos', value: invite.maxUses ? String(invite.maxUses) : 'Ilimitados', inline: true }
        );

      await logs.send(invite.guild, settings, 'inviteCreate', embed);
    },
  },

  {
    name: Events.InviteDelete,
    async execute(client, invite) {
      const settings = await loadSettings(client, invite.guild);
      if (!settings) return;

      const tracker = client.modules.get('invites');
      if (tracker) await tracker.refresh(invite.guild).catch(() => {});

      const embed = logs
        .baseEmbed({ title: '🔗 Ha eliminado una invitación', color: 'error' })
        .addFields(
          { name: 'Código', value: `\`${invite.code}\``, inline: true },
          { name: 'Canal', value: `${invite.channel}`, inline: true }
        );

      await logs.send(invite.guild, settings, 'inviteDelete', embed);
    },
  },

  // ── Emojis ─────────────────────────────────────────────────────
  {
    name: Events.GuildEmojiCreate,
    async execute(client, emoji) {
      const settings = await loadSettings(client, emoji.guild);
      if (!settings) return;

      const { executor, unavailable } = await logs.findAuditEntry(
        emoji.guild,
        AuditLogEvent.EmojiCreate,
        emoji.id
      );

      const embed = logs.actionEmbed({
        title: '😀 Ha creado un emoji',
        color: 'success',
        executor,
        auditUnavailable: unavailable,
        fields: [{ name: 'Emoji', value: `${emoji} \`:${emoji.name}:\`` }],
      });
      embed.setThumbnail(emoji.imageURL());

      await logs.send(emoji.guild, settings, 'emojiUpdate', embed);
    },
  },

  {
    name: Events.GuildEmojiDelete,
    async execute(client, emoji) {
      const settings = await loadSettings(client, emoji.guild);
      if (!settings) return;

      const { executor, unavailable } = await logs.findAuditEntry(
        emoji.guild,
        AuditLogEvent.EmojiDelete,
        emoji.id
      );

      const embed = logs.actionEmbed({
        title: '😀 Ha eliminado un emoji',
        color: 'error',
        executor,
        auditUnavailable: unavailable,
        fields: [{ name: 'Emoji', value: `\`:${emoji.name}:\`` }],
      });

      await logs.send(emoji.guild, settings, 'emojiUpdate', embed);
    },
  },

  // ── Servidor ───────────────────────────────────────────────────
  {
    name: Events.GuildUpdate,
    async execute(client, oldGuild, newGuild) {
      const settings = await loadSettings(client, newGuild);
      if (!settings) return;

      const changes = [];
      if (oldGuild.name !== newGuild.name) {
        changes.push(`**Nombre:** \`${oldGuild.name}\` → \`${newGuild.name}\``);
      }
      if (oldGuild.ownerId !== newGuild.ownerId) {
        changes.push(`**Dueño:** <@${oldGuild.ownerId}> → <@${newGuild.ownerId}>`);
      }
      if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
        changes.push(
          `**Nivel de verificación:** ${oldGuild.verificationLevel} → ${newGuild.verificationLevel}`
        );
      }
      if (oldGuild.iconURL() !== newGuild.iconURL()) changes.push('**Icono actualizado**');

      if (changes.length === 0) return;

      const { executor, unavailable } = await logs.findAuditEntry(
        newGuild,
        AuditLogEvent.GuildUpdate,
        null
      );

      const embed = logs.actionEmbed({
        title: '⚙️ Ha cambiado los ajustes del servidor',
        color: 'warning',
        executor,
        auditUnavailable: unavailable,
        detail: changes.join('\n').slice(0, 4096),
      });

      await logs.send(newGuild, settings, 'serverUpdate', embed);
    },
  },
];

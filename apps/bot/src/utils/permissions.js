'use strict';

const { PermissionsBitField } = require('discord.js');

/** Nombres legibles en español para los permisos usados por el bot. */
const PERMISSION_NAMES = {
  Administrator: 'Administrador',
  ManageGuild: 'Gestionar servidor',
  ManageRoles: 'Gestionar roles',
  ManageChannels: 'Gestionar canales',
  ManageMessages: 'Gestionar mensajes',
  ManageNicknames: 'Gestionar apodos',
  ManageWebhooks: 'Gestionar webhooks',
  ManageEmojisAndStickers: 'Gestionar emojis',
  KickMembers: 'Expulsar miembros',
  BanMembers: 'Banear miembros',
  ModerateMembers: 'Aislar miembros',
  MuteMembers: 'Silenciar miembros en voz',
  DeafenMembers: 'Ensordecer miembros',
  MoveMembers: 'Mover miembros',
  ViewAuditLog: 'Ver registro de auditoría',
  ViewChannel: 'Ver canal',
  SendMessages: 'Enviar mensajes',
  EmbedLinks: 'Insertar enlaces',
  AttachFiles: 'Adjuntar archivos',
  ReadMessageHistory: 'Leer historial de mensajes',
  AddReactions: 'Añadir reacciones',
  CreateInstantInvite: 'Crear invitación',
  Connect: 'Conectar a voz',
};

/** Traduce una lista de permisos a español para mostrarla al usuario. */
function translate(permissions) {
  return permissions.map((p) => PERMISSION_NAMES[p] || p);
}

/**
 * `true` si el miembro puede usar comandos de moderación.
 * Cuenta tanto los permisos nativos de Discord como los roles marcados como
 * moderadores en el panel.
 *
 * @param {import('discord.js').GuildMember} member
 * @param {object} settings Configuración del servidor.
 */
function isModerator(member, settings) {
  if (!member) return false;
  if (member.id === member.guild.ownerId) return true;
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;

  const modRoles = settings?.modRoles || [];
  const adminRoles = settings?.adminRoles || [];
  if ([...modRoles, ...adminRoles].some((roleId) => member.roles.cache.has(roleId))) {
    return true;
  }

  // Cualquier permiso de moderación nativo basta.
  return member.permissions.any([
    PermissionsBitField.Flags.KickMembers,
    PermissionsBitField.Flags.BanMembers,
    PermissionsBitField.Flags.ModerateMembers,
    PermissionsBitField.Flags.ManageMessages,
  ]);
}

/** `true` si el miembro es administrador del servidor o tiene un rol de admin. */
function isAdmin(member, settings) {
  if (!member) return false;
  if (member.id === member.guild.ownerId) return true;
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
  return (settings?.adminRoles || []).some((roleId) => member.roles.cache.has(roleId));
}

/**
 * Comprueba si `moderator` puede sancionar a `target`.
 *
 * Reproduce las reglas de Discord: nadie puede actuar sobre el dueño, sobre sí
 * mismo, ni sobre alguien con un rol igual o superior.
 *
 * @returns {{ ok: boolean, reason?: string }}
 */
function canModerate(moderator, target) {
  if (!target) return { ok: false, reason: 'No se ha encontrado a ese miembro.' };
  if (moderator.id === target.id) {
    return { ok: false, reason: 'No puedes usar este comando contigo mismo.' };
  }
  if (target.id === target.guild.ownerId) {
    return { ok: false, reason: 'No puedes sancionar al dueño del servidor.' };
  }
  // El dueño siempre puede actuar sobre cualquiera.
  if (moderator.id === moderator.guild.ownerId) return { ok: true };

  if (moderator.roles.highest.comparePositionTo(target.roles.highest) <= 0) {
    return {
      ok: false,
      reason: 'No puedes sancionar a alguien con un rol igual o superior al tuyo.',
    };
  }
  return { ok: true };
}

/**
 * Comprueba si el bot puede actuar sobre un miembro.
 * @returns {{ ok: boolean, reason?: string }}
 */
function botCanModerate(guild, target) {
  const me = guild.members.me;
  if (!me) return { ok: false, reason: 'No puedo comprobar mis propios permisos.' };
  if (target.id === guild.ownerId) {
    return { ok: false, reason: 'No puedo sancionar al dueño del servidor.' };
  }
  if (me.roles.highest.comparePositionTo(target.roles.highest) <= 0) {
    return {
      ok: false,
      reason:
        'Mi rol está por debajo del de ese miembro. Sube el rol de TK$ Bot por encima en los ajustes del servidor.',
    };
  }
  return { ok: true };
}

/**
 * Permisos que le faltan al bot en un canal concreto.
 * @param {import('discord.js').GuildChannel} channel
 * @param {string[]} required Nombres de permisos (`PermissionFlagsBits`).
 * @returns {string[]} Los que faltan, en español.
 */
function missingChannelPermissions(channel, required) {
  const me = channel.guild?.members?.me;
  if (!me) return [];
  const perms = channel.permissionsFor(me);
  if (!perms) return [];
  return translate(required.filter((p) => !perms.has(PermissionsBitField.Flags[p])));
}

/** `true` si el bot puede asignar/retirar el rol indicado. */
function canManageRole(guild, role) {
  const me = guild.members.me;
  if (!me || !role) return false;
  if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) return false;
  if (role.managed) return false; // Roles de integraciones y boosters.
  if (role.id === guild.id) return false; // @everyone.
  return me.roles.highest.comparePositionTo(role) > 0;
}

module.exports = {
  PERMISSION_NAMES,
  translate,
  isModerator,
  isAdmin,
  canModerate,
  botCanModerate,
  missingChannelPermissions,
  canManageRole,
};

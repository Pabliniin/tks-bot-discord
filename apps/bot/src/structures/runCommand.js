'use strict';

const { PermissionsBitField, Collection } = require('discord.js');
const { premiumTier } = require('@tkbot/shared');

const logger = require('../utils/logger');
const embeds = require('../utils/embeds');
const perms = require('../utils/permissions');
const { ArgumentError } = require('./OptionResolver');

/**
 * Comprueba cooldown, permisos y disponibilidad, y ejecuta el comando.
 *
 * Devuelve `false` si el comando no llegó a ejecutarse (ya se avisó al usuario).
 *
 * @param {import('./CommandContext')} ctx
 * @returns {Promise<boolean>}
 */
async function runCommand(ctx) {
  const { command, client, settings, member, user, guild } = ctx;

  // ── Comandos solo de servidor ──────────────────────────────────
  if (command.guildOnly !== false && !guild) {
    await ctx.errorReply('Este comando solo funciona dentro de un servidor.');
    return false;
  }

  // ── Comandos reservados a los dueños del bot ───────────────────
  if (command.ownerOnly && !client.owners.includes(user.id)) {
    await ctx.errorReply('Este comando está reservado para los desarrolladores del bot.');
    return false;
  }

  // ── Desactivado desde el panel ─────────────────────────────────
  if (guild && (settings?.disabledCommands || []).includes(command.name)) {
    await ctx.errorReply('Este comando está desactivado en este servidor.');
    return false;
  }

  // ── Funciones premium ──────────────────────────────────────────
  if (command.premium && premiumTier(settings) === 0) {
    await ctx.errorReply(
      'Este comando forma parte de **TK$ Premium**. Actívalo desde el panel para usarlo.'
    );
    return false;
  }

  // ── Permisos del usuario ───────────────────────────────────────
  if (guild && command.userPermissions?.length) {
    const isMod = perms.isModerator(member, settings);
    const missing = command.userPermissions.filter(
      (p) => !member.permissions.has(PermissionsBitField.Flags[p])
    );
    // Un rol de moderador del panel sustituye a los permisos nativos.
    if (missing.length > 0 && !isMod) {
      await ctx.errorReply(
        `Necesitas estos permisos: ${perms.translate(missing).map((p) => `\`${p}\``).join(', ')}`
      );
      return false;
    }
  }

  // ── Permisos del bot ───────────────────────────────────────────
  if (guild && command.botPermissions?.length) {
    const me = guild.members.me;
    const missing = command.botPermissions.filter(
      (p) => !me.permissions.has(PermissionsBitField.Flags[p])
    );
    if (missing.length > 0) {
      await ctx.errorReply(
        `Me faltan estos permisos: ${perms.translate(missing).map((p) => `\`${p}\``).join(', ')}`
      );
      return false;
    }
  }

  // ── Cooldown por usuario ───────────────────────────────────────
  const cooldownSeconds = command.cooldown ?? 3;
  if (cooldownSeconds > 0) {
    if (!client.cooldowns.has(command.name)) {
      client.cooldowns.set(command.name, new Collection());
    }
    const timestamps = client.cooldowns.get(command.name);
    const expiresAt = timestamps.get(user.id);

    if (expiresAt && Date.now() < expiresAt) {
      const remaining = ((expiresAt - Date.now()) / 1000).toFixed(1);
      await ctx.errorReply(`Espera **${remaining}s** antes de volver a usar \`${command.name}\`.`);
      return false;
    }

    timestamps.set(user.id, Date.now() + cooldownSeconds * 1000);
    // Limpieza para que la colección no crezca sin control.
    setTimeout(() => timestamps.delete(user.id), cooldownSeconds * 1000).unref?.();
  }

  // ── Ejecución ──────────────────────────────────────────────────
  try {
    await command.execute(ctx);
    if (settings && typeof settings.stats === 'object') {
      settings.stats.commandsUsed = (settings.stats.commandsUsed || 0) + 1;
    }
    return true;
  } catch (err) {
    if (err instanceof ArgumentError) {
      await ctx
        .errorReply(`${err.message}\n\nUso: \`${ctx.prefix}${command.name} ${command.usage || ''}\``)
        .catch(() => {});
      return false;
    }

    logger.error(`Error ejecutando ${command.name}:`, err);
    const message =
      'Ha ocurrido un error inesperado al ejecutar el comando. Si se repite, avisa al soporte.';
    await ctx.reply({ embeds: [embeds.error(message)] }, { ephemeral: true }).catch(() => {});
    return false;
  }
}

module.exports = runCommand;

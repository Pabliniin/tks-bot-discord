'use strict';

const { MessageFlags } = require('discord.js');
const { Member } = require('@tkbot/shared');

const embeds = require('../utils/embeds');
const permissions = require('../utils/permissions');
const logger = require('../utils/logger');

/**
 * Roles de color.
 *
 * Cada color de la lista puede tener un rol ya creado o crearse al vuelo la
 * primera vez que alguien lo pide.
 */

/** Busca o crea el rol correspondiente a un color. */
async function ensureRole(guild, settings, entry) {
  if (entry.roleId) {
    const existing = guild.roles.cache.get(entry.roleId);
    if (existing) return existing;
  }

  // Reutiliza un rol con el mismo nombre si ya existe.
  const byName = guild.roles.cache.find((r) => r.name === entry.name);
  if (byName) {
    entry.roleId = byName.id;
    await settings.save().catch(() => {});
    return byName;
  }

  if (!guild.members.me.permissions.has('ManageRoles')) return null;

  try {
    const role = await guild.roles.create({
      name: entry.name,
      color: entry.hex,
      reason: 'Rol de color de TK$ Bot',
    });
    entry.roleId = role.id;
    await settings.save().catch(() => {});
    return role;
  } catch (err) {
    logger.error('No se pudo crear el rol de color:', err.message);
    return null;
  }
}

/**
 * Asigna un color a un miembro.
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
async function assign(guild, member, settings, colorName) {
  const config = settings.colors;
  if (!config?.enabled) {
    return { ok: false, message: 'El módulo de colores está desactivado en este servidor.' };
  }

  if (
    (config.requiredRoles || []).length > 0 &&
    !config.requiredRoles.some((r) => member.roles.cache.has(r))
  ) {
    return { ok: false, message: 'No tienes el rol necesario para cambiar de color.' };
  }

  const entry = (config.list || []).find(
    (c) => c.name.toLowerCase() === String(colorName).toLowerCase()
  );
  if (!entry) {
    return { ok: false, message: `No existe el color \`${colorName}\`. Usa \`colors\` para verlos.` };
  }

  const role = await ensureRole(guild, settings, entry);
  if (!role) {
    return { ok: false, message: 'No he podido crear el rol de color. Revisa mis permisos.' };
  }

  if (!permissions.canManageRole(guild, role)) {
    return {
      ok: false,
      message: `No puedo asignar **${role.name}**. Sube el rol de TK$ Bot por encima de él.`,
    };
  }

  // Modo exclusivo: se quita el color anterior.
  if (config.exclusive !== false) {
    const previous = (config.list || [])
      .map((c) => c.roleId)
      .filter((id) => id && id !== role.id && member.roles.cache.has(id));

    for (const roleId of previous) {
      const old = guild.roles.cache.get(roleId);
      if (old && permissions.canManageRole(guild, old)) {
        await member.roles.remove(old, 'Cambio de color').catch(() => {});
      }
    }
  }

  await member.roles.add(role, 'Color elegido por el usuario');

  await Member.updateOne(
    { guildId: guild.id, userId: member.id },
    { $set: { colorRoleId: role.id }, $setOnInsert: { guildId: guild.id, userId: member.id } },
    { upsert: true }
  ).catch(() => {});

  return { ok: true, message: `Tu color ahora es **${entry.name}**.` };
}

/** Retira el color actual del miembro. */
async function remove(guild, member, settings) {
  const config = settings.colors;
  const owned = (config.list || [])
    .map((c) => c.roleId)
    .filter((id) => id && member.roles.cache.has(id));

  if (owned.length === 0) {
    return { ok: false, message: 'No tienes ningún color asignado.' };
  }

  for (const roleId of owned) {
    const role = guild.roles.cache.get(roleId);
    if (role && permissions.canManageRole(guild, role)) {
      await member.roles.remove(role, 'Color retirado').catch(() => {});
    }
  }

  await Member.updateOne({ guildId: guild.id, userId: member.id }, { $set: { colorRoleId: null } }).catch(
    () => {}
  );

  return { ok: true, message: 'Se ha retirado tu color.' };
}

module.exports = {
  name: 'colors',
  componentPrefixes: ['color'],

  assign,
  remove,
  ensureRole,

  /** Menú desplegable del comando `colors`. */
  async handleComponent(client, interaction, settings) {
    const value = interaction.isStringSelectMenu()
      ? interaction.values[0]
      : interaction.customId.split(':')[1];

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const result =
      value === 'remove'
        ? await remove(interaction.guild, interaction.member, settings)
        : await assign(interaction.guild, interaction.member, settings, value);

    await interaction.editReply({
      embeds: [result.ok ? embeds.success(result.message) : embeds.error(result.message)],
    });
  },
};

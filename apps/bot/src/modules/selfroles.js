'use strict';

const {
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags,
} = require('discord.js');

const embeds = require('../utils/embeds');
const permissions = require('../utils/permissions');
const logger = require('../utils/logger');

/**
 * Roles autoasignables mediante botones, menús desplegables o reacciones.
 *
 * Los `customId` siguen el formato `selfrole:<panelId>:<roleId>`.
 */

/** Construye las filas de componentes de un panel. */
function buildComponents(panel) {
  const options = (panel.options || []).filter((o) => o.roleId);
  if (options.length === 0) return [];

  if (panel.type === 'select') {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`selfrole:${panel.id}:menu`)
      .setPlaceholder(panel.placeholder || 'Elige un rol')
      .setMinValues(0)
      // `maxValues` 0 significa "sin límite" en el panel.
      .setMaxValues(
        panel.mode === 'unique' ? 1 : Math.min(options.length, panel.maxValues || options.length)
      )
      .addOptions(
        options.slice(0, 25).map((option) => {
          const builder = new StringSelectMenuOptionBuilder()
            .setLabel((option.label || 'Rol').slice(0, 100))
            .setValue(option.roleId);
          if (option.description) builder.setDescription(option.description.slice(0, 100));
          if (option.emoji) {
            try {
              builder.setEmoji(option.emoji);
            } catch {
              // Un emoji inválido no debe impedir construir el menú.
            }
          }
          return builder;
        })
      );

    return [new ActionRowBuilder().addComponents(menu)];
  }

  // Botones: hasta 5 por fila y 5 filas (25 en total).
  const rows = [];
  for (let i = 0; i < Math.min(options.length, 25); i += 5) {
    const row = new ActionRowBuilder();
    for (const option of options.slice(i, i + 5)) {
      const button = new ButtonBuilder()
        .setCustomId(`selfrole:${panel.id}:${option.roleId}`)
        .setLabel((option.label || 'Rol').slice(0, 80))
        .setStyle(option.style || 2);
      if (option.emoji) {
        try {
          button.setEmoji(option.emoji);
        } catch {
          // Emoji inválido: el botón se queda solo con texto.
        }
      }
      row.addComponents(button);
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Aplica o retira roles a un miembro respetando el modo del panel.
 * @returns {Promise<{ added: string[], removed: string[], error?: string }>}
 */
async function applyRoles(member, panel, selectedRoleIds) {
  const guild = member.guild;
  const panelRoleIds = (panel.options || []).map((o) => o.roleId);

  const added = [];
  const removed = [];

  // Modo exclusivo: se quitan los demás roles del panel.
  if (panel.mode === 'unique') {
    for (const roleId of panelRoleIds) {
      if (selectedRoleIds.includes(roleId)) continue;
      if (!member.roles.cache.has(roleId)) continue;
      const role = guild.roles.cache.get(roleId);
      if (!role || !permissions.canManageRole(guild, role)) continue;
      await member.roles.remove(role, 'Roles autoasignables').catch(() => {});
      removed.push(role.name);
    }
  }

  for (const roleId of selectedRoleIds) {
    const role = guild.roles.cache.get(roleId);
    if (!role) continue;
    if (!permissions.canManageRole(guild, role)) {
      return {
        added,
        removed,
        error: `No puedo gestionar el rol **${role.name}**. Sube mi rol por encima de él.`,
      };
    }

    if (member.roles.cache.has(roleId)) {
      // En modo verificación los roles no se pueden quitar.
      if (panel.mode === 'verify' || panel.mode === 'unique') continue;
      await member.roles.remove(role, 'Roles autoasignables').catch(() => {});
      removed.push(role.name);
    } else {
      await member.roles.add(role, 'Roles autoasignables').catch(() => {});
      added.push(role.name);
    }
  }

  return { added, removed };
}

module.exports = {
  name: 'selfroles',
  componentPrefixes: ['selfrole'],

  buildComponents,

  /** Atiende botones y menús de los paneles de roles. */
  async handleComponent(client, interaction, settings) {
    const [, panelId, value] = interaction.customId.split(':');
    const panel = (settings?.selfroles?.panels || []).find((p) => p.id === panelId);

    if (!panel) {
      await interaction.reply({
        embeds: [embeds.error('Este panel de roles ya no existe.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!settings.selfroles.enabled) {
      await interaction.reply({
        embeds: [embeds.error('El módulo de roles autoasignables está desactivado.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const member = interaction.member;

    // Roles requeridos para poder usar el panel.
    if (
      (panel.requiredRoles || []).length > 0 &&
      !panel.requiredRoles.some((r) => member.roles.cache.has(r))
    ) {
      await interaction.reply({
        embeds: [embeds.error('No tienes el rol necesario para usar este panel.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const selected = interaction.isStringSelectMenu() ? interaction.values : [value];
    // Solo se aceptan roles que pertenezcan al panel.
    const allowed = (panel.options || []).map((o) => o.roleId);
    const roleIds = selected.filter((id) => allowed.includes(id));

    if (roleIds.length === 0 && !interaction.isStringSelectMenu()) {
      await interaction.reply({
        embeds: [embeds.error('Ese rol ya no forma parte del panel.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const result = await applyRoles(member, panel, roleIds);

    if (result.error) {
      await interaction.editReply({ embeds: [embeds.error(result.error)] });
      return;
    }

    const lines = [];
    if (result.added.length > 0) lines.push(`**Añadidos:** ${result.added.join(', ')}`);
    if (result.removed.length > 0) lines.push(`**Quitados:** ${result.removed.join(', ')}`);

    await interaction.editReply({
      embeds: [
        lines.length > 0
          ? embeds.success(lines.join('\n'))
          : embeds.info('No ha habido cambios en tus roles.'),
      ],
    });
  },

  /** Atiende los paneles configurados como roles por reacción. */
  async handleReaction(client, reaction, user, settings, isAdding) {
    if (!settings?.selfroles?.enabled) return;

    const panels = (settings.selfroles.panels || []).filter(
      (p) => p.type === 'reaction' && p.messageId === reaction.message.id
    );
    if (panels.length === 0) return;

    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const emojiKey = reaction.emoji.id
      ? `<:${reaction.emoji.name}:${reaction.emoji.id}>`
      : reaction.emoji.name;

    for (const panel of panels) {
      const option = (panel.options || []).find(
        (o) => o.emoji === emojiKey || (reaction.emoji.id && o.emoji?.includes(reaction.emoji.id))
      );
      if (!option) continue;

      const role = guild.roles.cache.get(option.roleId);
      if (!role || !permissions.canManageRole(guild, role)) {
        logger.debug(`No puedo gestionar el rol por reacción ${option.roleId}`);
        continue;
      }

      if (isAdding) {
        await member.roles.add(role, 'Rol por reacción').catch(() => {});
      } else if (panel.mode !== 'verify') {
        await member.roles.remove(role, 'Rol por reacción').catch(() => {});
      }
    }
  },
};

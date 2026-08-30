'use strict';

const { Events, MessageFlags } = require('discord.js');

const CommandContext = require('../structures/CommandContext');
const runCommand = require('../structures/runCommand');
const embeds = require('../utils/embeds');
const logger = require('../utils/logger');

/**
 * Reparte una interacción de componente al módulo correspondiente.
 *
 * Los `customId` siguen el formato `modulo:accion:datos`, así que basta con
 * mirar el primer segmento para saber quién debe atenderla.
 */
async function routeComponent(client, interaction, settings) {
  const prefix = String(interaction.customId || '').split(':')[0];
  if (!prefix) return false;

  for (const [, mod] of client.modules) {
    const prefixes = mod.componentPrefixes || [];
    if (!prefixes.includes(prefix) || typeof mod.handleComponent !== 'function') continue;
    await mod.handleComponent(client, interaction, settings);
    return true;
  }
  return false;
}

module.exports = {
  name: Events.InteractionCreate,

  async execute(client, interaction) {
    // La configuración solo existe dentro de un servidor.
    let settings = null;
    if (interaction.guild) {
      try {
        settings = await client.settings.get(interaction.guild.id);
      } catch (err) {
        logger.error('No se pudo cargar la configuración:', err.message);
      }
    }

    // ── Comandos de barra ────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.resolveCommand(interaction.commandName);
      if (!command) {
        await interaction
          .reply({
            embeds: [embeds.error('Ese comando ya no está disponible.')],
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
        return;
      }

      const ctx = CommandContext.fromInteraction(client, interaction, command, settings);
      await runCommand(ctx);
      return;
    }

    // ── Autocompletado ───────────────────────────────────────────
    if (interaction.isAutocomplete()) {
      const command = client.resolveCommand(interaction.commandName);
      if (!command?.autocomplete) return;
      try {
        await command.autocomplete(interaction, client, settings);
      } catch (err) {
        logger.error(`Error en autocompletado de ${interaction.commandName}:`, err.message);
      }
      return;
    }

    // ── Botones, menús y modales ─────────────────────────────────
    if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
      try {
        const handled = await routeComponent(client, interaction, settings);
        if (!handled && !interaction.replied && !interaction.deferred) {
          await interaction
            .reply({
              embeds: [
                embeds.error(
                  'Este componente ya no está activo. Puede que el panel se haya reconfigurado.'
                ),
              ],
              flags: MessageFlags.Ephemeral,
            })
            .catch(() => {});
        }
      } catch (err) {
        logger.error(`Error en el componente ${interaction.customId}:`, err);
        const payload = {
          embeds: [embeds.error('Ha ocurrido un error al procesar tu acción.')],
          flags: MessageFlags.Ephemeral,
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(payload).catch(() => {});
        } else {
          await interaction.reply(payload).catch(() => {});
        }
      }
    }
  },
};

'use strict';

const { Events } = require('discord.js');

const CommandContext = require('../structures/CommandContext');
const runCommand = require('../structures/runCommand');
const { ArgumentError } = require('../structures/OptionResolver');
const { tokenize } = require('../utils/args');
const embeds = require('../utils/embeds');
const logger = require('../utils/logger');

/**
 * Determina el prefijo con el que empieza el mensaje.
 * Acepta tanto el prefijo del servidor como una mención al bot.
 *
 * @returns {string|null} El prefijo encontrado, o `null`.
 */
function matchPrefix(message, prefix, clientId) {
  const mention = new RegExp(`^<@!?${clientId}>\\s*`);
  const mentionMatch = message.content.match(mention);
  if (mentionMatch) return mentionMatch[0];

  if (prefix && message.content.toLowerCase().startsWith(prefix.toLowerCase())) {
    return message.content.slice(0, prefix.length);
  }
  return null;
}

module.exports = {
  name: Events.MessageCreate,

  async execute(client, message) {
    if (message.author.bot) return;
    if (!message.guild) return;
    // Los mensajes parciales no traen contenido utilizable.
    if (message.partial) return;

    let settings;
    try {
      settings = await client.settings.get(message.guild.id);
    } catch {
      return; // Sin base de datos no se puede hacer nada útil.
    }

    // Contador diario para las gráficas del panel. Se cuenta el mensaje aunque
    // luego lo borre el AutoMod: para medir actividad, se escribió igual.
    client.modules
      .get('dailyStats')
      ?.registrar(message.guild.id, 'messages', 1, message.channel.id);

    // ── Módulos que inspeccionan cada mensaje ────────────────────
    // El AutoMod va primero: si borra el mensaje, no se sigue procesando.
    const automod = client.modules.get('automod');
    if (automod) {
      try {
        const handled = await automod.handleMessage(client, message, settings);
        if (handled) {
          client.modules.get('dailyStats')?.registrar(message.guild.id, 'automodActions');
          return;
        }
      } catch (err) {
        logger.error('Error en AutoMod:', err.message);
      }
    }

    for (const name of ['levels', 'autoresponder']) {
      const mod = client.modules.get(name);
      if (!mod?.handleMessage) continue;
      try {
        await mod.handleMessage(client, message, settings);
      } catch (err) {
        logger.error(`Error en el módulo ${name}:`, err.message);
      }
    }

    // ── Comandos por prefijo ─────────────────────────────────────
    const prefix = settings.prefix || '-';
    const used = matchPrefix(message, prefix, client.user.id);
    if (!used) return;

    if ((settings.ignoredChannels || []).includes(message.channel.id)) return;

    const withoutPrefix = message.content.slice(used.length).trim();
    if (withoutPrefix.length === 0) return;

    const tokens = tokenize(withoutPrefix);
    const commandName = (tokens.shift() || '').toLowerCase();
    const command = client.resolveCommand(commandName);
    if (!command) return;
    // Un comando puede estar disponible solo como barra.
    if (command.prefixEnabled === false) return;

    let ctx;
    try {
      ctx = await CommandContext.fromMessage(client, message, command, tokens, settings);
    } catch (err) {
      if (err instanceof ArgumentError) {
        const usage = `\`${prefix}${command.name} ${command.usage || ''}\``.trim();
        await message
          .reply({
            embeds: [embeds.error(`${err.message}\n\nUso: ${usage}`)],
            allowedMentions: { repliedUser: false },
          })
          .catch(() => {});
        return;
      }
      logger.error(`Error preparando ${command.name}:`, err);
      return;
    }

    const executed = await runCommand(ctx);

    // Limpieza opcional del mensaje que invocó el comando.
    if (executed && settings.deleteCommandMessages && message.deletable) {
      message.delete().catch(() => {});
    }
  },
};

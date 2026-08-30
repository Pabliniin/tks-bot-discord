'use strict';

const { MessageFlags } = require('discord.js');
const { OptionResolver } = require('./OptionResolver');
const { tokenize } = require('../utils/args');

/**
 * Envoltorio que unifica interacciones de barra y comandos por prefijo.
 *
 * Los comandos reciben siempre un `CommandContext` y no necesitan saber cómo
 * fueron invocados: `ctx.options` y `ctx.reply()` se comportan igual en ambos casos.
 */
class CommandContext {
  constructor({ client, command, settings, interaction = null, message = null }) {
    this.client = client;
    this.command = command;
    this.settings = settings;
    this.interaction = interaction;
    this.message = message;

    this.guild = interaction?.guild ?? message?.guild ?? null;
    this.channel = interaction?.channel ?? message?.channel ?? null;
    this.user = interaction?.user ?? message?.author ?? null;
    this.member = interaction?.member ?? message?.member ?? null;

    this.locale = settings?.locale || 'es';
    this._deferred = false;
    this._replied = false;
  }

  /** `true` si el comando llegó como interacción de barra. */
  get isInteraction() {
    return this.interaction !== null;
  }

  /** Crea el contexto de una interacción de barra. */
  static fromInteraction(client, interaction, command, settings) {
    const ctx = new CommandContext({ client, command, settings, interaction });
    // Las interacciones ya traen su propio resolutor de opciones.
    ctx.options = interaction.options;
    return ctx;
  }

  /**
   * Crea el contexto de un mensaje con prefijo y resuelve sus argumentos.
   * Puede lanzar `ArgumentError` si faltan argumentos obligatorios.
   */
  static async fromMessage(client, message, command, rawArgs, settings) {
    const ctx = new CommandContext({ client, command, settings, message });

    const tokens = Array.isArray(rawArgs) ? rawArgs : tokenize(String(rawArgs || ''));
    const json = typeof command.data?.toJSON === 'function' ? command.data.toJSON() : {};

    const resolver = new OptionResolver(ctx, json.options || [], tokens);
    await resolver.resolve();

    ctx.options = resolver;
    ctx.rawArgs = tokens;
    return ctx;
  }

  /**
   * Responde al comando.
   * @param {string|object} payload Texto o payload de discord.js.
   * @param {{ ephemeral?: boolean }} [options] `ephemeral` solo aplica a slash.
   */
  async reply(payload, options = {}) {
    const data = typeof payload === 'string' ? { content: payload } : { ...payload };

    if (this.isInteraction) {
      if (options.ephemeral) {
        data.flags = (data.flags || 0) | MessageFlags.Ephemeral;
      }
      if (this._deferred) {
        this._replied = true;
        // `editReply` no acepta flags de efímero: ya se fijaron al diferir.
        delete data.flags;
        return this.interaction.editReply(data);
      }
      if (this._replied || this.interaction.replied) {
        return this.interaction.followUp(data);
      }
      this._replied = true;
      return this.interaction.reply(data);
    }

    // Por prefijo no existe el modo efímero: se responde en el canal.
    return this.message.reply({
      ...data,
      allowedMentions: data.allowedMentions ?? { repliedUser: false },
    });
  }

  /** Envía un mensaje suelto al canal, sin responder al original. */
  async send(payload) {
    const data = typeof payload === 'string' ? { content: payload } : payload;
    return this.channel.send(data);
  }

  /**
   * Indica que la respuesta tardará. En prefijo activa el indicador de escritura.
   * @param {{ ephemeral?: boolean }} [options]
   */
  async defer(options = {}) {
    if (this.isInteraction) {
      if (this.interaction.deferred || this.interaction.replied) return;
      this._deferred = true;
      return this.interaction.deferReply(
        options.ephemeral ? { flags: MessageFlags.Ephemeral } : {}
      );
    }
    if (typeof this.channel?.sendTyping === 'function') {
      return this.channel.sendTyping().catch(() => {});
    }
    return undefined;
  }

  /** Respuesta de error con formato consistente. */
  async errorReply(description) {
    const { error } = require('../utils/embeds');
    return this.reply({ embeds: [error(description)] }, { ephemeral: true });
  }

  /** Respuesta de éxito con formato consistente. */
  async successReply(description) {
    const { success } = require('../utils/embeds');
    return this.reply({ embeds: [success(description)] });
  }

  /** Prefijo configurado en el servidor. */
  get prefix() {
    return this.settings?.prefix || '-';
  }
}

module.exports = CommandContext;

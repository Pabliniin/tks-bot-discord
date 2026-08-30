'use strict';

const { ApplicationCommandOptionType } = require('discord.js');
const args = require('../utils/args');

/** Error de argumentos con mensaje pensado para mostrarse al usuario. */
class ArgumentError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ArgumentError';
  }
}

const T = ApplicationCommandOptionType;

/**
 * Reproduce la API de `interaction.options` para los comandos por prefijo.
 *
 * Toma la definición de opciones del `SlashCommandBuilder` y va consumiendo los
 * tokens del mensaje en orden, de modo que un mismo `execute()` sirve tanto
 * para `/ban @user razón` como para `-ban @user razón`.
 */
class OptionResolver {
  /**
   * @param {object} ctx Contexto del comando (aporta `guild` y `client`).
   * @param {Array<object>} definitions Opciones en formato JSON del builder.
   * @param {string[]} tokens Argumentos ya tokenizados.
   */
  constructor(ctx, definitions, tokens) {
    this.ctx = ctx;
    this.definitions = Array.isArray(definitions) ? definitions : [];
    this.tokens = Array.isArray(tokens) ? [...tokens] : [];
    this.values = new Map();
    this.subcommand = null;
    this.subcommandGroup = null;
    /** Texto sobrante tras consumir todas las opciones. */
    this.rest = '';
  }

  /**
   * Consume los tokens y rellena el mapa de valores.
   * Debe llamarse antes de usar los getters porque la búsqueda de miembros
   * y usuarios es asíncrona.
   */
  async resolve() {
    let definitions = this.definitions;

    // Grupo de subcomandos: `mute text @user`.
    const group = definitions.find((d) => d.type === T.SubcommandGroup);
    if (group && definitions.every((d) => d.type === T.SubcommandGroup)) {
      const name = (this.tokens[0] || '').toLowerCase();
      const found = definitions.find((d) => d.name === name);
      if (!found) {
        throw new ArgumentError(
          `Debes indicar uno de estos grupos: ${definitions.map((d) => `\`${d.name}\``).join(', ')}`
        );
      }
      this.tokens.shift();
      this.subcommandGroup = found.name;
      definitions = found.options || [];
    }

    // Subcomandos sueltos: `warn_remove user @alguien`.
    const hasSubcommands = definitions.some((d) => d.type === T.Subcommand);
    if (hasSubcommands) {
      const subs = definitions.filter((d) => d.type === T.Subcommand);
      const name = (this.tokens[0] || '').toLowerCase();
      let found = subs.find((d) => d.name === name);

      if (found) {
        this.tokens.shift();
      } else if (subs.length === 1) {
        // Un único subcomando: se puede omitir su nombre.
        [found] = subs;
      } else {
        throw new ArgumentError(
          `Debes indicar una de estas opciones: ${subs.map((d) => `\`${d.name}\``).join(', ')}`
        );
      }

      this.subcommand = found.name;
      definitions = found.options || [];
    }

    await this._consume(definitions);
    return this;
  }

  /** Consume los tokens según una lista plana de opciones. */
  async _consume(definitions) {
    const list = definitions.filter((d) => d.type !== T.Subcommand && d.type !== T.SubcommandGroup);

    for (let i = 0; i < list.length; i += 1) {
      const def = list[i];
      const isLast = i === list.length - 1;
      const token = this.tokens[0];

      if (token === undefined) {
        if (def.required) {
          throw new ArgumentError(`Falta el argumento obligatorio \`${def.name}\`.`);
        }
        continue;
      }

      // La última opción de texto absorbe el resto (razones, mensajes…).
      if (def.type === T.String && isLast) {
        const value = this.tokens.join(' ');
        this.tokens = [];
        this._validateChoices(def, value);
        this.values.set(def.name, value);
        continue;
      }

      const value = await this._parseOne(def, token);

      if (value === null || value === undefined) {
        if (def.required) {
          throw new ArgumentError(
            `No he podido interpretar \`${token}\` como \`${def.name}\`.`
          );
        }
        // Opcional no reconocido: se deja el token para la siguiente opción.
        continue;
      }

      this.tokens.shift();
      this.values.set(def.name, value);
    }

    this.rest = this.tokens.join(' ');
  }

  /** Interpreta un token según el tipo de la opción. */
  async _parseOne(def, token) {
    const { guild, client } = this.ctx;

    switch (def.type) {
      case T.String: {
        this._validateChoices(def, token);
        return token;
      }
      case T.Integer: {
        const num = Number.parseInt(token, 10);
        if (!Number.isInteger(num)) return null;
        return this._validateRange(def, num);
      }
      case T.Number: {
        const num = Number.parseFloat(token);
        if (!Number.isFinite(num)) return null;
        return this._validateRange(def, num);
      }
      case T.Boolean:
        return args.resolveBoolean(token);
      case T.User: {
        const member = guild ? await args.resolveMember(guild, token) : null;
        if (member) return member;
        const user = await args.resolveUser(client, guild, token);
        return user;
      }
      case T.Channel:
        return args.resolveChannel(guild, token, def.channel_types);
      case T.Role:
        return args.resolveRole(guild, token);
      case T.Mentionable: {
        const member = guild ? await args.resolveMember(guild, token) : null;
        if (member) return member;
        return args.resolveRole(guild, token);
      }
      case T.Attachment:
        // Los adjuntos se toman del mensaje, no de los argumentos.
        return this.ctx.message?.attachments?.first() ?? null;
      default:
        return token;
    }
  }

  /** Rechaza valores fuera de las opciones predefinidas. */
  _validateChoices(def, value) {
    if (!Array.isArray(def.choices) || def.choices.length === 0) return;
    const match = def.choices.find(
      (c) => String(c.value).toLowerCase() === String(value).toLowerCase()
    );
    if (!match) {
      throw new ArgumentError(
        `\`${def.name}\` debe ser uno de: ${def.choices.map((c) => `\`${c.value}\``).join(', ')}`
      );
    }
  }

  /** Aplica `min_value` / `max_value` del builder. */
  _validateRange(def, num) {
    if (typeof def.min_value === 'number' && num < def.min_value) {
      throw new ArgumentError(`\`${def.name}\` debe ser como mínimo ${def.min_value}.`);
    }
    if (typeof def.max_value === 'number' && num > def.max_value) {
      throw new ArgumentError(`\`${def.name}\` debe ser como máximo ${def.max_value}.`);
    }
    return num;
  }

  // ── API compatible con `interaction.options` ───────────────────

  _get(name, required, transform = (v) => v) {
    const value = this.values.get(name);
    if (value === undefined || value === null) {
      if (required) throw new ArgumentError(`Falta el argumento obligatorio \`${name}\`.`);
      return null;
    }
    return transform(value);
  }

  getString(name, required = false) {
    return this._get(name, required, (v) => String(v));
  }

  getInteger(name, required = false) {
    return this._get(name, required, (v) => Number.parseInt(v, 10));
  }

  getNumber(name, required = false) {
    return this._get(name, required, (v) => Number(v));
  }

  getBoolean(name, required = false) {
    return this._get(name, required, (v) => Boolean(v));
  }

  /** Devuelve el `User`, tanto si se resolvió un miembro como un usuario. */
  getUser(name, required = false) {
    return this._get(name, required, (v) => (v?.user ? v.user : v));
  }

  /** Devuelve el `GuildMember`, o `null` si el usuario no está en el servidor. */
  getMember(name) {
    const value = this.values.get(name);
    return value?.guild ? value : null;
  }

  getChannel(name, required = false) {
    return this._get(name, required);
  }

  getRole(name, required = false) {
    return this._get(name, required);
  }

  getMentionable(name, required = false) {
    return this._get(name, required);
  }

  getAttachment(name, required = false) {
    return this._get(name, required);
  }

  getSubcommand(required = true) {
    if (!this.subcommand && required) {
      throw new ArgumentError('Falta el subcomando.');
    }
    return this.subcommand;
  }

  getSubcommandGroup(required = false) {
    if (!this.subcommandGroup && required) {
      throw new ArgumentError('Falta el grupo de subcomandos.');
    }
    return this.subcommandGroup;
  }
}

module.exports = { OptionResolver, ArgumentError };

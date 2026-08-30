'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');

const logger = require('../utils/logger');
const settingsCache = require('../utils/settings');

/**
 * Cliente de TK$ Bot.
 *
 * Carga automáticamente comandos, eventos y módulos desde sus carpetas, de modo
 * que añadir una función nueva consiste solo en crear el archivo.
 */
class TKClient extends Client {
  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, // privilegiado
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildExpressions,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent, // privilegiado
        GatewayIntentBits.DirectMessages,
      ],
      partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.User,
        Partials.GuildMember,
      ],
      allowedMentions: { parse: ['users', 'roles'], repliedUser: false },
    });

    /** @type {Collection<string, object>} Comandos por nombre. */
    this.commands = new Collection();
    /** @type {Collection<string, string>} Alias → nombre del comando. */
    this.aliases = new Collection();
    /** @type {Collection<string, Collection<string, number>>} Cooldowns por comando. */
    this.cooldowns = new Collection();
    /** @type {Map<string, object>} Módulos cargados (automod, levels…). */
    this.modules = new Map();

    this.settings = settingsCache;
    this.logger = logger;
    this.startedAt = Date.now();

    /** IDs de los dueños del bot, para comandos restringidos. */
    this.owners = (process.env.BOT_OWNERS || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }

  /** Recorre un directorio y devuelve las rutas de todos los `.js`. */
  static walk(directory) {
    if (!fs.existsSync(directory)) return [];
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    return entries.flatMap((entry) => {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) return TKClient.walk(full);
      return entry.name.endsWith('.js') ? [full] : [];
    });
  }

  /**
   * Carga los comandos desde `src/commands`.
   * Valida lo mínimo imprescindible para evitar fallos en tiempo de ejecución.
   */
  loadCommands() {
    const directory = path.join(__dirname, '..', 'commands');
    const files = TKClient.walk(directory);
    let loaded = 0;

    for (const file of files) {
      try {
        // `require` cacheado: en desarrollo `node --watch` reinicia el proceso.
        const command = require(file);

        if (!command?.name || typeof command.execute !== 'function') {
          logger.warn(`Comando inválido (falta name o execute): ${path.basename(file)}`);
          continue;
        }
        if (this.commands.has(command.name)) {
          logger.warn(`Comando duplicado ignorado: ${command.name} (${path.basename(file)})`);
          continue;
        }

        // La categoría se deduce de la carpeta si no viene declarada.
        command.category = command.category || path.basename(path.dirname(file));
        command.filePath = file;

        this.commands.set(command.name, command);
        for (const alias of command.aliases || []) {
          if (this.aliases.has(alias)) {
            logger.warn(`Alias duplicado ignorado: ${alias} (${command.name})`);
            continue;
          }
          this.aliases.set(alias, command.name);
        }
        loaded += 1;
      } catch (err) {
        logger.error(`Error al cargar el comando ${path.basename(file)}:`, err.message);
        throw err;
      }
    }

    logger.module('cmds', `${loaded} comandos cargados (${this.aliases.size} alias)`);
    return loaded;
  }

  /** Registra un único escuchador de evento. */
  registerEvent(event, fileName) {
    if (!event?.name || typeof event.execute !== 'function') {
      logger.warn(`Evento inválido: ${fileName}`);
      return false;
    }

    const handler = (...eventArgs) => {
      Promise.resolve(event.execute(this, ...eventArgs)).catch((err) => {
        logger.error(`Error en el evento ${event.name}:`, err);
      });
    };

    if (event.once) this.once(event.name, handler);
    else this.on(event.name, handler);
    return true;
  }

  /**
   * Registra los escuchadores desde `src/events`.
   *
   * Un archivo puede exportar un solo evento o un array, lo que permite agrupar
   * eventos relacionados (por ejemplo todos los registros de mensajes).
   */
  loadEvents() {
    const directory = path.join(__dirname, '..', 'events');
    const files = TKClient.walk(directory);
    let loaded = 0;

    for (const file of files) {
      try {
        const exported = require(file);
        const list = Array.isArray(exported) ? exported : [exported];
        for (const event of list) {
          if (this.registerEvent(event, path.basename(file))) loaded += 1;
        }
      } catch (err) {
        logger.error(`Error al cargar el evento ${path.basename(file)}:`, err.message);
        throw err;
      }
    }

    logger.module('event', `${loaded} eventos registrados`);
    return loaded;
  }

  /**
   * Carga los módulos de `src/modules`.
   * Un módulo puede exportar `init(client)` para arrancar tareas periódicas.
   */
  loadModules() {
    const directory = path.join(__dirname, '..', 'modules');
    const files = TKClient.walk(directory);
    let loaded = 0;

    for (const file of files) {
      try {
        const mod = require(file);
        const name = mod.name || path.basename(file, '.js');
        this.modules.set(name, mod);
        if (typeof mod.init === 'function') mod.init(this);
        loaded += 1;
      } catch (err) {
        logger.error(`Error al cargar el módulo ${path.basename(file)}:`, err.message);
        throw err;
      }
    }

    logger.module('mods', `${loaded} módulos cargados`);
    return loaded;
  }

  /** Busca un comando por nombre o alias. */
  resolveCommand(name) {
    if (!name) return null;
    const key = name.toLowerCase();
    return this.commands.get(key) || this.commands.get(this.aliases.get(key)) || null;
  }

  /** Definiciones JSON de todos los comandos, para registrarlos en Discord. */
  slashCommandData() {
    return this.commands
      .filter((c) => c.data && typeof c.data.toJSON === 'function' && c.slash !== false)
      .map((c) => c.data.toJSON());
  }

  /** Carga todo y abre la conexión con Discord. */
  async start(token) {
    this.loadCommands();
    this.loadEvents();
    this.loadModules();
    await this.login(token);
  }
}

module.exports = TKClient;

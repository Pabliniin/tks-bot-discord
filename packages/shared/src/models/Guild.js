'use strict';

const { Schema, model, models } = require('mongoose');

/** Sub-esquema reutilizable para el diseño de un embed. */
const embedDesignSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    color: { type: String, default: '#5865F2' },
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    url: { type: String, default: '' },
    author: {
      name: { type: String, default: '' },
      icon: { type: String, default: '' },
      url: { type: String, default: '' },
    },
    thumbnail: { type: String, default: '' },
    image: { type: String, default: '' },
    footer: {
      text: { type: String, default: '' },
      icon: { type: String, default: '' },
    },
    timestamp: { type: Boolean, default: false },
    fields: [
      {
        _id: false,
        name: { type: String, default: '' },
        value: { type: String, default: '' },
        inline: { type: Boolean, default: false },
      },
    ],
  },
  { _id: false }
);

/** Configuración común de un filtro de AutoMod. */
const automodFilterSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    action: {
      type: String,
      enum: ['none', 'delete', 'warn', 'timeout', 'mute', 'kick', 'ban'],
      default: 'delete',
    },
    /** Se elimina el mensaje además de aplicar la acción. */
    deleteMessage: { type: Boolean, default: true },
    /** Duración del aislamiento/silencio en minutos. */
    duration: { type: Number, default: 10, min: 1, max: 40320 },
    /** Número de infracciones antes de aplicar la acción. */
    threshold: { type: Number, default: 1, min: 1, max: 20 },
    /** Roles y canales exentos del filtro. */
    ignoredRoles: { type: [String], default: [] },
    ignoredChannels: { type: [String], default: [] },
    /** Mensaje de aviso enviado al infractor (vacío = sin aviso). */
    warnMessage: { type: String, default: '' },
  },
  { _id: false }
);

const guildSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },

    // ── Ajustes generales ────────────────────────────────────────
    prefix: { type: String, default: '-', maxlength: 8 },
    locale: { type: String, enum: ['es', 'en'], default: 'es' },
    /** Comandos desactivados por nombre. */
    disabledCommands: { type: [String], default: [] },
    /** Canales donde el bot ignora todos los comandos. */
    ignoredChannels: { type: [String], default: [] },
    /** Roles con permiso de moderación aunque no tengan permisos de Discord. */
    modRoles: { type: [String], default: [] },
    adminRoles: { type: [String], default: [] },
    /** Elimina el mensaje del usuario tras ejecutar un comando por prefijo. */
    deleteCommandMessages: { type: Boolean, default: false },

    premium: {
      tier: { type: Number, enum: [0, 1, 2], default: 0 },
      until: { type: Date, default: null },
      grantedBy: { type: String, default: null },
    },

    // ── Bienvenida y Despedida ───────────────────────────────────
    welcome: {
      enabled: { type: Boolean, default: false },
      channelId: { type: String, default: null },
      message: { type: String, default: '¡Bienvenido [user] a **[server]**! Ahora somos [memberCount] miembros.' },
      embed: { type: embedDesignSchema, default: () => ({}) },
      /** Imagen de bienvenida generada con canvas. */
      card: {
        enabled: { type: Boolean, default: false },
        background: { type: String, default: '' },
        titleText: { type: String, default: 'BIENVENIDO' },
        subtitleText: { type: String, default: '[userName]' },
        footerText: { type: String, default: 'Miembro #[memberCount]' },
        textColor: { type: String, default: '#FFFFFF' },
        accentColor: { type: String, default: '#5865F2' },
        avatarShape: { type: String, enum: ['circle', 'square', 'rounded'], default: 'circle' },
        overlayOpacity: { type: Number, default: 0.45, min: 0, max: 1 },
      },
      /** Mensaje privado al nuevo miembro. */
      dm: {
        enabled: { type: Boolean, default: false },
        message: { type: String, default: '¡Bienvenido a **[server]**!' },
        embed: { type: embedDesignSchema, default: () => ({}) },
      },
      /** Borra el mensaje pasados N segundos (0 = nunca). */
      deleteAfter: { type: Number, default: 0, min: 0, max: 3600 },
    },

    goodbye: {
      enabled: { type: Boolean, default: false },
      channelId: { type: String, default: null },
      message: { type: String, default: '[userName] ha abandonado **[server]**. Quedamos [memberCount] miembros.' },
      embed: { type: embedDesignSchema, default: () => ({}) },
      card: {
        enabled: { type: Boolean, default: false },
        background: { type: String, default: '' },
        titleText: { type: String, default: 'ADIÓS' },
        subtitleText: { type: String, default: '[userName]' },
        footerText: { type: String, default: 'Quedamos [memberCount] miembros' },
        textColor: { type: String, default: '#FFFFFF' },
        accentColor: { type: String, default: '#ED4245' },
        avatarShape: { type: String, enum: ['circle', 'square', 'rounded'], default: 'circle' },
        overlayOpacity: { type: Number, default: 0.45, min: 0, max: 1 },
      },
      deleteAfter: { type: Number, default: 0, min: 0, max: 3600 },
    },

    // ── Respuesta Automática ─────────────────────────────────────
    autoresponder: {
      enabled: { type: Boolean, default: false },
      responses: [
        {
          _id: false,
          id: { type: String, required: true },
          trigger: { type: String, required: true },
          response: { type: String, default: '' },
          /** `exact`, `contains`, `startsWith`, `endsWith` o `regex`. */
          matchType: {
            type: String,
            enum: ['exact', 'contains', 'startsWith', 'endsWith', 'regex'],
            default: 'contains',
          },
          caseSensitive: { type: Boolean, default: false },
          deleteTrigger: { type: Boolean, default: false },
          embed: { type: embedDesignSchema, default: () => ({}) },
          /** Vacío = todos los canales/roles. */
          channels: { type: [String], default: [] },
          roles: { type: [String], default: [] },
          ignoredChannels: { type: [String], default: [] },
          ignoredRoles: { type: [String], default: [] },
          cooldown: { type: Number, default: 0, min: 0 },
          enabled: { type: Boolean, default: true },
        },
      ],
    },

    // ── Mensajes Embed guardados ─────────────────────────────────
    embeds: [
      {
        _id: false,
        id: { type: String, required: true },
        name: { type: String, default: 'Nuevo embed' },
        channelId: { type: String, default: null },
        messageId: { type: String, default: null },
        content: { type: String, default: '' },
        embed: { type: embedDesignSchema, default: () => ({}) },
        updatedAt: { type: Date, default: Date.now },
      },
    ],

    // ── Sistema de niveles ───────────────────────────────────────
    levels: {
      enabled: { type: Boolean, default: false },
      /** `current` (mismo canal), `dm`, `none` o un ID de canal. */
      announceMode: { type: String, default: 'current' },
      announceChannelId: { type: String, default: null },
      message: { type: String, default: '¡Felicidades [user], has subido al **nivel [level]**!' },
      embed: { type: embedDesignSchema, default: () => ({}) },
      /** XP por mensaje y ventana anti-spam en segundos. */
      xpPerMessage: { type: Number, default: 20, min: 1, max: 500 },
      xpCooldown: { type: Number, default: 60, min: 0, max: 3600 },
      /** XP por minuto en canales de voz (0 = desactivado). */
      voiceXpPerMinute: { type: Number, default: 0, min: 0, max: 200 },
      /** Multiplicador global de XP. */
      xpRate: { type: Number, default: 1, min: 0.1, max: 10 },
      /** Los roles de nivel se acumulan en vez de sustituirse. */
      stackRoles: { type: Boolean, default: false },
      /** Borra el anuncio de subida de nivel tras N segundos (0 = nunca). */
      deleteAfter: { type: Number, default: 0, min: 0, max: 3600 },
      roles: [
        {
          _id: false,
          level: { type: Number, required: true, min: 1 },
          roleId: { type: String, required: true },
        },
      ],
      /** Multiplicadores por rol. */
      multipliers: [
        {
          _id: false,
          roleId: { type: String, required: true },
          multiplier: { type: Number, default: 1, min: 0, max: 10 },
        },
      ],
      ignoredChannels: { type: [String], default: [] },
      ignoredRoles: { type: [String], default: [] },
      /** Diseño de la tarjeta de rango. */
      card: {
        background: { type: String, default: '' },
        accentColor: { type: String, default: '#5865F2' },
        textColor: { type: String, default: '#FFFFFF' },
      },

      /**
       * Clasificación pública en la web (`/clasificacion/<servidor>`).
       *
       * Va apagada a propósito: publicar quién habla más en un servidor
       * privado sin que su dueño lo haya pedido sería filtrar datos suyos.
       * Quien la enciende sabe lo que está publicando.
       */
      publicLeaderboard: {
        enabled: { type: Boolean, default: false },
        /** Deja ver la clasificación a cualquiera con el enlace, sin buscador. */
        unlisted: { type: Boolean, default: true },
        /** Texto propio bajo el título de la página. */
        description: { type: String, default: '', maxlength: 300 },
      },
    },

    // ── Auto-Roles ───────────────────────────────────────────────
    autoroles: {
      enabled: { type: Boolean, default: false },
      humans: { type: [String], default: [] },
      bots: { type: [String], default: [] },
      /** Retardo en segundos antes de asignar el rol. */
      delay: { type: Number, default: 0, min: 0, max: 86400 },
      /** Restaura los roles que tenía el miembro al salir. */
      restoreOnRejoin: { type: Boolean, default: false },
    },

    // ── Logs ─────────────────────────────────────────────────────
    logs: {
      enabled: { type: Boolean, default: false },
      /** Canal usado cuando un evento no tiene canal propio. */
      defaultChannelId: { type: String, default: null },
      /** { messageDelete: { enabled, channelId }, ... } */
      events: { type: Map, of: new Schema({ enabled: Boolean, channelId: String }, { _id: false }), default: () => new Map() },
      ignoredChannels: { type: [String], default: [] },
      ignoredRoles: { type: [String], default: [] },
      ignoreBots: { type: Boolean, default: true },
    },

    // ── Colores ──────────────────────────────────────────────────
    colors: {
      enabled: { type: Boolean, default: false },
      /** Solo un rol de color a la vez. */
      exclusive: { type: Boolean, default: true },
      /** Rol requerido para usar el comando (vacío = todos). */
      requiredRoles: { type: [String], default: [] },
      iconShape: { type: String, enum: ['circle', 'square', 'rounded'], default: 'circle' },
      background: { type: String, default: '#2B2D31' },
      title: { type: String, default: 'Colores disponibles' },
      list: [
        {
          _id: false,
          name: { type: String, required: true },
          hex: { type: String, required: true },
          roleId: { type: String, default: null },
        },
      ],
    },

    // ── Roles AutoAsignables ─────────────────────────────────────
    selfroles: {
      enabled: { type: Boolean, default: false },
      panels: [
        {
          _id: false,
          id: { type: String, required: true },
          name: { type: String, default: 'Panel de roles' },
          channelId: { type: String, default: null },
          messageId: { type: String, default: null },
          /** `reaction`, `button` o `select`. */
          type: { type: String, enum: ['reaction', 'button', 'select'], default: 'button' },
          /** `normal`, `unique` (uno solo), `verify` (no se puede quitar). */
          mode: { type: String, enum: ['normal', 'unique', 'verify'], default: 'normal' },
          content: { type: String, default: '' },
          embed: { type: embedDesignSchema, default: () => ({}) },
          placeholder: { type: String, default: 'Elige un rol' },
          maxValues: { type: Number, default: 0, min: 0, max: 25 },
          requiredRoles: { type: [String], default: [] },
          options: [
            {
              _id: false,
              roleId: { type: String, required: true },
              label: { type: String, default: '' },
              description: { type: String, default: '' },
              emoji: { type: String, default: '' },
              style: { type: Number, default: 2, min: 1, max: 4 },
            },
          ],
        },
      ],
    },

    // ── Canales Temporales ───────────────────────────────────────
    tempchannels: {
      enabled: { type: Boolean, default: false },
      /** Canal de voz que actúa como "creador". */
      hubChannelId: { type: String, default: null },
      categoryId: { type: String, default: null },
      nameTemplate: { type: String, default: 'Canal de [userName]' },
      userLimit: { type: Number, default: 0, min: 0, max: 99 },
      bitrate: { type: Number, default: 64, min: 8, max: 384 },
      /** El creador puede renombrar, expulsar y bloquear su canal. */
      allowOwnerControls: { type: Boolean, default: true },
      /** Borra el canal cuando queda vacío tras N segundos. */
      deleteDelay: { type: Number, default: 5, min: 0, max: 3600 },
    },

    // ── Enlaces Temporales ───────────────────────────────────────
    templinks: {
      enabled: { type: Boolean, default: false },
      channelId: { type: String, default: null },
      /** Usos máximos y caducidad en segundos. */
      maxUses: { type: Number, default: 1, min: 0, max: 100 },
      maxAge: { type: Number, default: 86400, min: 0, max: 604800 },
      requiredRoles: { type: [String], default: [] },
      cooldown: { type: Number, default: 3600, min: 0 },
    },

    // ── Anti-Raid ────────────────────────────────────────────────
    antiraid: {
      enabled: { type: Boolean, default: false },
      /** N entradas en X segundos disparan la protección. */
      joinThreshold: { type: Number, default: 10, min: 2, max: 100 },
      joinWindow: { type: Number, default: 10, min: 1, max: 300 },
      action: { type: String, enum: ['none', 'kick', 'ban', 'timeout'], default: 'kick' },
      /** Cierra el servidor (nivel de verificación alto) durante el raid. */
      lockdown: { type: Boolean, default: true },
      lockdownDuration: { type: Number, default: 600, min: 60, max: 86400 },
      /** Rechaza cuentas creadas hace menos de N días (0 = desactivado). */
      minAccountAge: { type: Number, default: 0, min: 0, max: 365 },
      alertChannelId: { type: String, default: null },
      whitelistRoles: { type: [String], default: [] },
    },

    // ── Protección VIP ───────────────────────────────────────────
    vipProtection: {
      enabled: { type: Boolean, default: false },
      /** Usuarios y roles exentos de todos los límites. */
      whitelistUsers: { type: [String], default: [] },
      whitelistRoles: { type: [String], default: [] },
      /** Acción al superar un límite. */
      punishment: { type: String, enum: ['none', 'removeRoles', 'kick', 'ban'], default: 'removeRoles' },
      alertChannelId: { type: String, default: null },
      /** Máximo de acciones por minuto y por usuario. */
      limits: {
        banLimit: { type: Number, default: 3, min: 0, max: 100 },
        kickLimit: { type: Number, default: 5, min: 0, max: 100 },
        roleDeleteLimit: { type: Number, default: 2, min: 0, max: 100 },
        channelDeleteLimit: { type: Number, default: 2, min: 0, max: 100 },
        roleCreateLimit: { type: Number, default: 5, min: 0, max: 100 },
        channelCreateLimit: { type: Number, default: 5, min: 0, max: 100 },
        webhookLimit: { type: Number, default: 2, min: 0, max: 100 },
      },
      /** Impide que se den roles con permisos peligrosos. */
      blockDangerousRoles: { type: Boolean, default: false },
      /** Impide que bots ajenos entren al servidor. */
      blockBots: { type: Boolean, default: false },
    },

    // ── Starboard ────────────────────────────────────────────────
    starboard: {
      enabled: { type: Boolean, default: false },
      channelId: { type: String, default: null },
      emoji: { type: String, default: '⭐' },
      threshold: { type: Number, default: 3, min: 1, max: 100 },
      /** Permite que el autor se destaque a sí mismo. */
      selfStar: { type: Boolean, default: false },
      /** Permite destacar mensajes de bots. */
      allowBots: { type: Boolean, default: false },
      allowNsfw: { type: Boolean, default: false },
      color: { type: String, default: '#FAA81A' },
      ignoredChannels: { type: [String], default: [] },
      ignoredRoles: { type: [String], default: [] },
    },

    // ── AutoMod ──────────────────────────────────────────────────
    automod: {
      enabled: { type: Boolean, default: false },
      /** Roles y canales exentos de todo el AutoMod. */
      ignoredRoles: { type: [String], default: [] },
      ignoredChannels: { type: [String], default: [] },
      /** Los usuarios con permisos de moderación quedan exentos. */
      exemptModerators: { type: Boolean, default: true },
      logChannelId: { type: String, default: null },
      filters: {
        invites: { type: automodFilterSchema, default: () => ({}) },
        links: { type: automodFilterSchema, default: () => ({}) },
        words: { type: automodFilterSchema, default: () => ({}) },
        caps: { type: automodFilterSchema, default: () => ({}) },
        spam: { type: automodFilterSchema, default: () => ({}) },
        mentions: { type: automodFilterSchema, default: () => ({}) },
        emojis: { type: automodFilterSchema, default: () => ({}) },
        zalgo: { type: automodFilterSchema, default: () => ({}) },
        attachments: { type: automodFilterSchema, default: () => ({}) },
        duplicates: { type: automodFilterSchema, default: () => ({}) },
        newlines: { type: automodFilterSchema, default: () => ({}) },
      },
      /** Ajustes numéricos propios de cada filtro. */
      options: {
        bannedWords: { type: [String], default: [] },
        allowedLinks: { type: [String], default: [] },
        capsPercentage: { type: Number, default: 70, min: 10, max: 100 },
        capsMinLength: { type: Number, default: 10, min: 1, max: 500 },
        spamMessages: { type: Number, default: 5, min: 2, max: 30 },
        spamInterval: { type: Number, default: 5, min: 1, max: 60 },
        maxMentions: { type: Number, default: 5, min: 1, max: 50 },
        maxEmojis: { type: Number, default: 10, min: 1, max: 100 },
        maxNewlines: { type: Number, default: 10, min: 1, max: 200 },
        /** Permite invitaciones al propio servidor. */
        allowOwnInvites: { type: Boolean, default: true },
      },
    },

    // ── Tickets ──────────────────────────────────────────────────
    tickets: {
      enabled: { type: Boolean, default: false },
      categoryId: { type: String, default: null },
      archiveCategoryId: { type: String, default: null },
      logChannelId: { type: String, default: null },
      supportRoles: { type: [String], default: [] },
      /** Máximo de tickets abiertos por usuario. */
      maxPerUser: { type: Number, default: 1, min: 1, max: 25 },
      nameTemplate: { type: String, default: 'ticket-[userName]' },
      /** Guarda una transcripción al cerrar. */
      transcripts: { type: Boolean, default: true },
      /** Permite reclamar el ticket a un miembro del staff. */
      claiming: { type: Boolean, default: true },
      openMessage: { type: String, default: 'Gracias por abrir un ticket. El equipo te atenderá en breve.' },
      closeMessage: { type: String, default: 'Este ticket ha sido cerrado.' },
      counter: { type: Number, default: 0 },
      panels: [
        {
          _id: false,
          id: { type: String, required: true },
          name: { type: String, default: 'Soporte' },
          channelId: { type: String, default: null },
          messageId: { type: String, default: null },
          buttonLabel: { type: String, default: 'Abrir ticket' },
          buttonEmoji: { type: String, default: '🎫' },
          buttonStyle: { type: Number, default: 1, min: 1, max: 4 },
          categoryId: { type: String, default: null },
          supportRoles: { type: [String], default: [] },
          embed: { type: embedDesignSchema, default: () => ({}) },
          /** Formulario mostrado al abrir el ticket. */
          form: [
            {
              _id: false,
              label: { type: String, required: true },
              placeholder: { type: String, default: '' },
              required: { type: Boolean, default: true },
              style: { type: Number, enum: [1, 2], default: 1 },
            },
          ],
        },
      ],
    },

    // ── Apelaciones ──────────────────────────────────────────────
    /**
     * Permite que un sancionado explique su versión desde una página web.
     *
     * Sin esto, alguien baneado no tiene forma de contactar: no puede escribir
     * en el servidor y los privados del equipo suelen estar cerrados.
     */
    appeals: {
      enabled: { type: Boolean, default: false },
      /** Canal donde avisar de cada apelación nueva. */
      channelId: { type: String, default: null },
      /** Qué sanciones se pueden apelar. */
      types: { type: [String], default: ['ban', 'kick', 'timeout', 'mute'] },
      /** Texto propio que se enseña en el formulario público. */
      instructions: { type: String, default: '', maxlength: 1000 },
      /** Días que hay para apelar desde la sanción (0 = sin límite). */
      deadlineDays: { type: Number, default: 30, min: 0, max: 365 },
    },

    // ── Música ───────────────────────────────────────────────────
    /**
     * El audio lo procesa Lavalink, un servicio aparte. Estos ajustes solo
     * dicen quién puede mandar y con qué límites.
     */
    music: {
      enabled: { type: Boolean, default: true },
      /** Quien tenga este rol manda sobre la cola de los demás. */
      djRoleId: { type: String, default: null },
      /** Solo el DJ puede usar los comandos que afectan a la reproducción. */
      djOnly: { type: Boolean, default: false },

      defaultVolume: { type: Number, default: 100, min: 1, max: 200 },
      /** Tope que nadie puede superar: a 200 el audio satura y molesta. */
      maxVolume: { type: Number, default: 150, min: 1, max: 200 },

      /** Canales de voz donde se permite. Vacío = todos. */
      allowedVoiceChannels: { type: [String], default: [] },
      /** Canales de texto desde los que se puede pedir música. Vacío = todos. */
      commandChannels: { type: [String], default: [] },

      /** Anunciar cada canción que empieza a sonar. */
      announce: { type: Boolean, default: true },

      /**
       * Dónde buscar cuando se escribe texto en vez de un enlace.
       * `ytmsearch` (YouTube Music) suele dar mejores resultados para canciones
       * porque no devuelve vídeos de reacciones ni directos de diez horas.
       */
      defaultSource: {
        type: String,
        enum: ['ytsearch', 'ytmsearch', 'scsearch', 'dzsearch'],
        default: 'ytmsearch',
      },

      /** Porcentaje de oyentes que hace falta para saltar por votación. */
      voteSkipPercent: { type: Number, default: 50, min: 1, max: 100 },
    },

    // ── Contadores de servidor ───────────────────────────────────
    /**
     * Canales de voz cuyo nombre se actualiza solo («👥 Miembros: 1.234»).
     *
     * Discord solo deja renombrar un canal dos veces cada diez minutos, así
     * que se refrescan cada cuarto de hora y nunca a demanda.
     */
    counters: {
      enabled: { type: Boolean, default: false },
      channels: [
        {
          _id: false,
          channelId: { type: String, required: true },
          type: {
            type: String,
            enum: ['miembros', 'humanos', 'bots', 'enLinea', 'canales', 'roles', 'boosts'],
            required: true,
          },
          /** Texto del nombre. `{valor}` se sustituye por la cifra. */
          template: { type: String, default: '', maxlength: 100 },
        },
      ],
    },

    // ── Estadísticas internas ────────────────────────────────────
    stats: {
      commandsUsed: { type: Number, default: 0 },
      memberCount: { type: Number, default: 0 },
      lastSeen: { type: Date, default: Date.now },
    },
  },
  {
    timestamps: true,
    minimize: false,
    // `logs.events` es un Map. Sin `flattenMaps`, `toObject()` lo deja como Map
    // y `JSON.stringify` lo convierte en `{}`, con lo que el panel recibiría
    // los registros vacíos. Se aplana siempre para que salga como objeto.
    toObject: { flattenMaps: true },
    toJSON: { flattenMaps: true },
  }
);

module.exports = models.Guild || model('Guild', guildSchema);

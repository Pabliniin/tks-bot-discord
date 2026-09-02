'use strict';

/**
 * Plantillas de configuración.
 *
 * Aplican de golpe un conjunto de ajustes sensatos para un tipo de servidor,
 * en vez de obligar a recorrer quince módulos a mano. Para quien administra
 * varios servidores es la diferencia entre media hora y un clic.
 *
 * Las plantillas **nunca** contienen identificadores de canales ni de roles:
 * esos son propios de cada servidor. Definen el comportamiento; los canales se
 * eligen después. Por eso cada plantilla declara en `pendientes` lo que hay
 * que rellenar a mano al terminar, y el panel lo muestra.
 */

/** Todos los eventos de registro activados, con el canal por defecto. */
function todosLosLogs(ids) {
  return Object.fromEntries(ids.map((id) => [id, { enabled: true, channelId: null }]));
}

/** Registros esenciales: lo que casi todo el mundo quiere ver. */
const LOGS_ESENCIALES = [
  'messageDelete',
  'messageUpdate',
  'messageBulkDelete',
  'memberJoin',
  'memberLeave',
  'memberBan',
  'memberUnban',
  'memberKick',
  'memberTimeout',
  'memberUpdate',
  'nicknameUpdate',
  'moderation',
  'automod',
];

/** Registros de auditoría completa, incluida la estructura del servidor. */
const LOGS_COMPLETOS = [
  ...LOGS_ESENCIALES,
  'roleCreate',
  'roleDelete',
  'roleUpdate',
  'channelCreate',
  'channelDelete',
  'channelUpdate',
  'voiceJoin',
  'voiceLeave',
  'voiceMove',
  'inviteCreate',
  'inviteDelete',
  'emojiUpdate',
  'serverUpdate',
];

const TEMPLATES = [
  {
    id: 'comunidad',
    nombre: 'Comunidad',
    icono: '💬',
    descripcion:
      'Para un servidor de amigos o una comunidad general. Niveles, bienvenidas y una moderación suave que no molesta a nadie.',
    destacados: [
      'Niveles con tarjeta de rango',
      'Bienvenida con imagen',
      'Registros esenciales',
      'AutoMod suave (solo invitaciones y spam)',
    ],
    pendientes: [
      'Elegir el canal de bienvenida',
      'Elegir el canal de registros',
      'Elegir el canal donde se anuncian las subidas de nivel',
    ],
    settings: {
      welcome: { enabled: true, card: { enabled: true } },
      levels: {
        enabled: true,
        xpPerMessage: 20,
        cooldown: 60,
        announce: true,
        announceChannelId: null,
      },
      logs: {
        enabled: true,
        ignoreBots: true,
        events: todosLosLogs(LOGS_ESENCIALES),
      },
      automod: {
        enabled: true,
        exemptModerators: true,
        filters: {
          invites: { enabled: true, action: 'delete', deleteMessage: true, threshold: 1 },
          spam: { enabled: true, action: 'timeout', duration: 5, deleteMessage: true, threshold: 1 },
          zalgo: { enabled: true, action: 'delete', deleteMessage: true, threshold: 1 },
        },
        options: { spamMessages: 6, spamInterval: 5 },
      },
      starboard: { enabled: true, threshold: 3, emoji: '⭐' },
      colors: { enabled: true },
    },
  },

  {
    id: 'gaming',
    nombre: 'Gaming',
    icono: '🎮',
    descripcion:
      'Para servidores de juego con mucha voz. Canales temporales, niveles que premian estar en voz y roles autoasignables.',
    destacados: [
      'Canales de voz temporales',
      'XP también por estar en voz',
      'Registros de voz (quién entra, sale y a quién mueven)',
      'AutoMod centrado en publicidad',
    ],
    pendientes: [
      'Elegir el canal «Crear canal» para los canales temporales',
      'Elegir el canal de registros',
      'Crear los paneles de roles autoasignables (juegos, plataformas…)',
    ],
    settings: {
      welcome: { enabled: true, card: { enabled: true } },
      levels: {
        enabled: true,
        xpPerMessage: 15,
        cooldown: 60,
        voiceEnabled: true,
        xpPerVoiceMinute: 5,
        announce: true,
      },
      tempchannels: { enabled: true },
      selfroles: { enabled: true },
      colors: { enabled: true },
      logs: {
        enabled: true,
        ignoreBots: true,
        events: todosLosLogs([
          ...LOGS_ESENCIALES,
          'voiceJoin',
          'voiceLeave',
          'voiceMove',
        ]),
      },
      automod: {
        enabled: true,
        exemptModerators: true,
        filters: {
          invites: { enabled: true, action: 'warn', deleteMessage: true, threshold: 1 },
          spam: { enabled: true, action: 'timeout', duration: 10, deleteMessage: true, threshold: 1 },
          caps: { enabled: true, action: 'delete', deleteMessage: true, threshold: 3 },
        },
        options: { capsPercentage: 75, capsMinLength: 12, spamMessages: 6, spamInterval: 5 },
      },
    },
  },

  {
    id: 'soporte',
    nombre: 'Soporte',
    icono: '🎫',
    descripcion:
      'Para atención al cliente o soporte de un proyecto. Tickets, auditoría completa y nada de ruido: sin niveles ni juegos.',
    destacados: [
      'Sistema de tickets activado',
      'Auditoría completa de todo el servidor',
      'Sin niveles (no interesan aquí)',
      'AutoMod estricto con enlaces',
    ],
    pendientes: [
      'Crear el panel de tickets y elegir su categoría',
      'Elegir el canal de registros',
      'Añadir el rol del equipo de soporte',
    ],
    settings: {
      tickets: { enabled: true },
      levels: { enabled: false },
      welcome: { enabled: true, card: { enabled: false } },
      logs: {
        enabled: true,
        ignoreBots: false,
        events: todosLosLogs(LOGS_COMPLETOS),
      },
      automod: {
        enabled: true,
        exemptModerators: true,
        filters: {
          invites: { enabled: true, action: 'kick', deleteMessage: true, threshold: 1 },
          links: { enabled: true, action: 'delete', deleteMessage: true, threshold: 1 },
          spam: { enabled: true, action: 'timeout', duration: 15, deleteMessage: true, threshold: 1 },
          mentions: { enabled: true, action: 'timeout', duration: 10, deleteMessage: true, threshold: 1 },
        },
        options: { maxMentions: 4, spamMessages: 5, spamInterval: 5, allowedLinks: [] },
      },
    },
  },

  {
    id: 'blindado',
    nombre: 'Servidor blindado',
    icono: '🛡️',
    descripcion:
      'Máxima protección para un servidor grande o que ya ha sufrido un ataque. Todo vigilado y AutoMod sin contemplaciones.',
    destacados: [
      'Anti-Raid y Protección VIP activados',
      'Auditoría completa',
      'AutoMod estricto en todos los filtros',
      'Registro de quién hace cada acción',
    ],
    pendientes: [
      'Elegir el canal de registros y el de alertas',
      'Revisar los límites del Anti-Raid según el tamaño del servidor',
      'Marcar los roles protegidos en Protección VIP',
    ],
    premium: true,
    settings: {
      antiraid: { enabled: true },
      vipProtection: { enabled: true },
      welcome: { enabled: true, card: { enabled: false } },
      logs: {
        enabled: true,
        ignoreBots: false,
        events: todosLosLogs(LOGS_COMPLETOS),
      },
      automod: {
        enabled: true,
        exemptModerators: true,
        filters: {
          invites: { enabled: true, action: 'ban', deleteMessage: true, threshold: 1 },
          links: { enabled: true, action: 'timeout', duration: 30, deleteMessage: true, threshold: 1 },
          words: { enabled: true, action: 'timeout', duration: 30, deleteMessage: true, threshold: 1 },
          caps: { enabled: true, action: 'delete', deleteMessage: true, threshold: 2 },
          spam: { enabled: true, action: 'timeout', duration: 30, deleteMessage: true, threshold: 1 },
          mentions: { enabled: true, action: 'timeout', duration: 60, deleteMessage: true, threshold: 1 },
          emojis: { enabled: true, action: 'delete', deleteMessage: true, threshold: 3 },
          zalgo: { enabled: true, action: 'delete', deleteMessage: true, threshold: 1 },
          newlines: { enabled: true, action: 'delete', deleteMessage: true, threshold: 2 },
          duplicates: { enabled: true, action: 'timeout', duration: 10, deleteMessage: true, threshold: 2 },
        },
        options: {
          capsPercentage: 65,
          capsMinLength: 10,
          maxMentions: 3,
          maxEmojis: 8,
          maxNewlines: 8,
          spamMessages: 4,
          spamInterval: 5,
        },
      },
    },
  },
];

/** Busca una plantilla por su identificador. */
function getTemplate(id) {
  return TEMPLATES.find((t) => t.id === id) || null;
}

module.exports = { TEMPLATES, getTemplate, LOGS_ESENCIALES, LOGS_COMPLETOS };

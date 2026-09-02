'use strict';

const filters = require('./automodFilters');

/**
 * Simulador del AutoMod.
 *
 * Evalúa un mensaje imaginario contra la configuración guardada y explica qué
 * pasaría, sin tocar Discord. El panel lo usa para que se pueda probar el
 * filtro ANTES de activarlo.
 *
 * Es la queja más repetida sobre los automod de la competencia: se activan a
 * ciegas, castigan a alguien que no tocaba y hay que desactivarlos con prisa.
 * Aquí se ve el resultado antes de que afecte a nadie.
 *
 * Comparte los detectores con el bot (`./automodFilters`), así que lo que
 * enseña el simulador es literalmente lo que aplicará el bot.
 */

/**
 * Orden en el que el bot evalúa los filtros.
 *
 * Importa porque el primero que se incumple decide la sanción: si «enlaces» va
 * antes que «palabras», un mensaje con ambas cosas se castiga como enlace.
 * Debe coincidir con `apps/bot/src/modules/automod.js`.
 */
const ORDEN_FILTROS = [
  'invites',
  'links',
  'words',
  'caps',
  'mentions',
  'emojis',
  'zalgo',
  'newlines',
  'attachments',
  'spam',
  'duplicates',
];

/** Filtros que el simulador no puede evaluar con un solo mensaje. */
const NECESITAN_HISTORIAL = new Set(['spam', 'duplicates']);

/**
 * Comprueba un único filtro contra el contenido.
 *
 * @returns {{ incumple: boolean, motivo: string|null }}
 */
function evaluarFiltro(id, contenido, options, contexto) {
  switch (id) {
    case 'invites': {
      // En el simulador no se consultan las invitaciones reales del servidor:
      // se avisa aparte de que las propias estarían permitidas.
      const incumple = filters.hasInvite(contenido, { allowOwnInvites: false });
      return { incumple, motivo: incumple ? 'Invitación a otro servidor' : null };
    }

    case 'links': {
      const incumple = filters.hasLink(contenido, options.allowedLinks);
      return { incumple, motivo: incumple ? 'Enlace no permitido' : null };
    }

    case 'words': {
      const palabra = filters.findBannedWord(contenido, options.bannedWords);
      return { incumple: Boolean(palabra), motivo: palabra ? `Palabra prohibida («${palabra}»)` : null };
    }

    case 'caps': {
      const incumple = filters.hasExcessiveCaps(
        contenido,
        options.capsPercentage,
        options.capsMinLength
      );
      return { incumple, motivo: incumple ? 'Exceso de mayúsculas' : null };
    }

    case 'mentions': {
      const incumple = filters.hasExcessiveMentions(contenido, options.maxMentions);
      return { incumple, motivo: incumple ? 'Demasiadas menciones' : null };
    }

    case 'emojis': {
      const incumple = filters.hasExcessiveEmojis(contenido, options.maxEmojis);
      return { incumple, motivo: incumple ? 'Demasiados emojis' : null };
    }

    case 'zalgo': {
      const incumple = filters.isZalgo(contenido);
      return { incumple, motivo: incumple ? 'Texto deformado (zalgo)' : null };
    }

    case 'newlines': {
      const incumple = filters.hasExcessiveNewlines(contenido, options.maxNewlines);
      return { incumple, motivo: incumple ? 'Demasiados saltos de línea' : null };
    }

    case 'attachments': {
      const incumple = Boolean(contexto.conAdjunto);
      return { incumple, motivo: incumple ? 'Archivo adjunto no permitido' : null };
    }

    default:
      return { incumple: false, motivo: null };
  }
}

/**
 * Describe en una frase qué haría el bot.
 * @param {object} config Configuración del filtro.
 */
function describirAccion(config) {
  const accion = config.action || 'delete';
  const borra = config.deleteMessage !== false;
  const minutos = config.duration || 10;

  const acciones = {
    none: 'No haría nada más.',
    delete: 'Solo borraría el mensaje.',
    warn: 'Le pondría una advertencia.',
    timeout: `Lo aislaría ${minutos} minutos.`,
    mute: `Lo silenciaría ${minutos} minutos.`,
    kick: 'Lo expulsaría del servidor.',
    ban: 'Lo banearía del servidor.',
  };

  const texto = acciones[accion] ?? acciones.delete;
  if (accion === 'none') return borra ? 'Solo borraría el mensaje.' : 'No haría nada.';
  if (accion === 'delete') return texto;

  return borra ? `Borraría el mensaje y ${texto.toLowerCase()}` : texto;
}

/**
 * Simula un mensaje contra la configuración de AutoMod del servidor.
 *
 * @param {object} params
 * @param {string} params.content Texto del mensaje a probar.
 * @param {object} params.settings Configuración completa del servidor.
 * @param {string} [params.channelId] Canal donde se enviaría (para exenciones).
 * @param {string[]} [params.roleIds] Roles del autor imaginario.
 * @param {boolean} [params.isModerator] Si el autor sería moderador.
 * @param {boolean} [params.hasAttachment] Si el mensaje llevaría un archivo.
 * @returns {{
 *   moduloActivo: boolean,
 *   exento: boolean,
 *   motivoExencion: string|null,
 *   bloqueado: boolean,
 *   resultado: object|null,
 *   coincidencias: object[],
 *   noEvaluados: object[],
 *   filtrosActivos: number
 * }}
 */
function simulate({
  content = '',
  settings = {},
  channelId = null,
  roleIds = [],
  isModerator = false,
  hasAttachment = false,
} = {}) {
  const automod = settings.automod || {};
  const options = automod.options || {};
  const contenido = String(content ?? '');

  const base = {
    moduloActivo: Boolean(automod.enabled),
    exento: false,
    motivoExencion: null,
    bloqueado: false,
    resultado: null,
    coincidencias: [],
    noEvaluados: [],
    filtrosActivos: 0,
  };

  // Cuántos filtros hay encendidos, se llegue o no a evaluarlos.
  base.filtrosActivos = ORDEN_FILTROS.filter((id) => automod.filters?.[id]?.enabled).length;

  if (!automod.enabled) {
    return { ...base, motivoExencion: 'El módulo AutoMod está desactivado.' };
  }

  // ── Exenciones globales, en el mismo orden que el bot ──────────
  const ignorados = automod.ignoredChannels || [];
  if (channelId && ignorados.includes(channelId)) {
    return {
      ...base,
      exento: true,
      motivoExencion: 'Ese canal está en la lista de canales ignorados del AutoMod.',
    };
  }

  const rolesIgnorados = automod.ignoredRoles || [];
  const rolExento = roleIds.find((r) => rolesIgnorados.includes(r));
  if (rolExento) {
    return {
      ...base,
      exento: true,
      motivoExencion: 'El autor tiene un rol que el AutoMod ignora.',
    };
  }

  if (isModerator && automod.exemptModerators !== false) {
    return {
      ...base,
      exento: true,
      motivoExencion: 'Los moderadores están exentos del AutoMod.',
    };
  }

  // ── Filtros ────────────────────────────────────────────────────
  const contexto = { conAdjunto: hasAttachment };
  const coincidencias = [];
  const noEvaluados = [];

  for (const id of ORDEN_FILTROS) {
    const config = automod.filters?.[id];
    if (!config?.enabled) continue;

    // Exenciones propias del filtro.
    if (channelId && (config.ignoredChannels || []).includes(channelId)) continue;
    if (roleIds.some((r) => (config.ignoredRoles || []).includes(r))) continue;

    if (NECESITAN_HISTORIAL.has(id)) {
      noEvaluados.push({
        id,
        motivo:
          id === 'spam'
            ? `Depende de cuántos mensajes se envíen seguidos (más de ${options.spamMessages || 5} en ${options.spamInterval || 5} s).`
            : 'Depende de que el mensaje anterior fuera idéntico.',
      });
      continue;
    }

    const { incumple, motivo } = evaluarFiltro(id, contenido, options, contexto);
    if (!incumple) continue;

    const umbral = config.threshold || 1;

    coincidencias.push({
      id,
      motivo,
      accion: config.action || 'delete',
      borraMensaje: config.deleteMessage !== false,
      umbral,
      // Con umbral > 1 el bot borra pero no sanciona hasta acumular avisos.
      sancionaAlPrimero: umbral <= 1,
      descripcion: describirAccion(config),
      avisoEnCanal: config.warnMessage || null,
    });
  }

  // El bot para en el primero que se incumple: ese decide la sanción.
  const resultado = coincidencias[0] || null;

  return {
    ...base,
    bloqueado: Boolean(resultado),
    resultado,
    coincidencias,
    noEvaluados,
  };
}

module.exports = {
  simulate,
  // Nombre explícito para cuando se importa desde el índice del paquete,
  // donde `simulate` a secas no diría de qué.
  simulateAutomod: simulate,
  ORDEN_FILTROS,
  describirAccion,
};

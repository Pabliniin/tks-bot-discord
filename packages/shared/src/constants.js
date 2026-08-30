'use strict';

/**
 * Constantes compartidas entre el bot y el panel.
 *
 * Los datos viven en `constants.json` a propósito:
 *
 *   · El bot (CommonJS) los carga con `require`.
 *   · El panel los importa desde componentes de cliente. Un `.js` CommonJS
 *     rompe Fast Refresh de Next.js ("Cannot use 'import.meta' outside a
 *     module"), mientras que un `.json` lo entienden los dos sin problemas.
 *
 * Para cambiar algo (añadir un módulo, un evento de logs, un idioma…), edita
 * `constants.json`. Este archivo solo lo reexporta.
 *
 * Contenido:
 *   BRAND                 Nombre, lema y colores del bot.
 *   EMBED_COLORS          Colores de embed según el tipo de respuesta.
 *   COMMAND_CATEGORIES    Las cinco categorías de comandos.
 *   MODULES               Los quince módulos del panel.
 *   MODULE_GROUPS         Agrupaciones de la barra lateral.
 *   LOG_EVENTS            Eventos que puede registrar el módulo de Logs.
 *   AUTOMOD_FILTERS       Filtros disponibles en el AutoMod.
 *   PUNISHMENTS           Castigos aplicables.
 *   VARIABLES             Variables admitidas en los mensajes.
 *   LOCALES               Idiomas soportados.
 *   PREMIUM_TIERS         Límites de cada plan.
 *   REQUIRED_PERMISSIONS  Permisos que el bot pide al ser invitado.
 */

module.exports = require('./constants.json');

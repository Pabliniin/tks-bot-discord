'use strict';

/**
 * Detectores puros del AutoMod.
 *
 * Viven en el paquete compartido para que el simulador del panel web evalúe
 * exactamente los mismos filtros que aplica el bot: si el simulador usara una
 * copia distinta, acabaría mintiendo en cuanto una de las dos se tocara.
 *
 * Se mantiene este archivo como reexportación para no cambiar los `require`
 * del bot ni sus pruebas.
 */
module.exports = require('@tkbot/shared/src/automodFilters');

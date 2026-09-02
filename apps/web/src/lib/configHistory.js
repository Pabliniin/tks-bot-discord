/**
 * Utilidades del historial de cambios del panel.
 *
 * Van en su propio módulo, sin dependencias de Next.js ni de mongoose, para
 * poder probarlas de forma aislada (`apps/web/tests/configHistory.test.mjs`).
 */

// El atributo `with { type: 'json' }` es obligatorio para que Node pueda
// cargar este módulo tal cual en las pruebas; webpack lo acepta igualmente.
import constants from '@tkbot/shared/src/constants.json' with { type: 'json' };

const { MODULES } = constants;

/** Nombre legible de cada rama de la configuración. */
const NOMBRES = {
  prefix: 'Prefijo',
  locale: 'Idioma',
  disabledCommands: 'Comandos desactivados',
  ignoredChannels: 'Canales ignorados',
  modRoles: 'Roles de moderador',
  adminRoles: 'Roles de administrador',
  deleteCommandMessages: 'Borrar mensajes de comando',
  goodbye: 'Despedida',
  embeds: 'Mensajes Embed',
  ...Object.fromEntries(MODULES.map((m) => [m.id, m.es])),
};

/** Nombre para enseñar de una rama de configuración. */
export function nombreDeModulo(clave) {
  return NOMBRES[clave] || clave;
}

/**
 * Extrae de `origen` exactamente los mismos caminos que tiene `forma`.
 *
 * Sirve para guardar los valores ANTERIORES de lo que se acaba de cambiar,
 * sin arrastrar el resto de la configuración: el historial pesaría muchísimo
 * y sería ilegible.
 *
 * Los caminos que no existían quedan a `null`, que es lo que hay que
 * restaurar al deshacer (antes no había nada ahí).
 *
 * @param {object} origen Configuración actual, ya como objeto plano.
 * @param {object} forma Cambios que se van a aplicar.
 * @returns {object}
 */
export function pickShape(origen, forma) {
  if (!forma || typeof forma !== 'object' || Array.isArray(forma)) {
    return origen === undefined ? null : origen;
  }

  const salida = {};

  for (const clave of Object.keys(forma)) {
    const valorOrigen = origen?.[clave];
    const valorForma = forma[clave];

    const formaEsObjeto =
      valorForma && typeof valorForma === 'object' && !Array.isArray(valorForma);

    /*
     * Se sigue bajando aunque la rama no existiera todavía: así se guarda
     * `{ logs: { canal: null } }` en vez de `{ logs: null }`. Es importante,
     * porque al deshacer hay que restaurar SOLO los campos que se tocaron;
     * un `null` en la rama entera borraría el módulo completo.
     *
     * Lo que sí corta la bajada es que el original no sea un objeto (un array,
     * un número): en ese caso hay que conservarlo tal cual para poder volver.
     */
    const origenAdmiteBajar =
      valorOrigen === undefined ||
      valorOrigen === null ||
      (typeof valorOrigen === 'object' && !Array.isArray(valorOrigen));

    salida[clave] =
      formaEsObjeto && origenAdmiteBajar
        ? pickShape(valorOrigen, valorForma)
        : valorOrigen === undefined
          ? null
          : valorOrigen;
  }

  return salida;
}

/**
 * Cuenta los valores finales (hojas) de un objeto de cambios.
 * Un array cuenta como un solo valor: sustituir una lista es un cambio.
 */
export function contarCambios(objeto) {
  if (!objeto || typeof objeto !== 'object' || Array.isArray(objeto)) return 1;

  return Object.values(objeto).reduce((total, valor) => total + contarCambios(valor), 0);
}

/**
 * Frase corta que describe un guardado: «Logs y AutoMod · 4 valores».
 *
 * @param {object} cambios
 * @returns {string}
 */
export function resumirCambios(cambios) {
  const claves = Object.keys(cambios || {});
  if (claves.length === 0) return 'Sin cambios';

  const nombres = claves.map(nombreDeModulo);
  const total = contarCambios(cambios);

  // Con más de tres módulos la lista completa no cabe y no aporta.
  const lista =
    nombres.length <= 3
      ? nombres.join(', ').replace(/, ([^,]*)$/, ' y $1')
      : `${nombres.slice(0, 2).join(', ')} y ${nombres.length - 2} más`;

  return `${lista} · ${total} valor${total === 1 ? '' : 'es'}`;
}

/**
 * Aplana un objeto de cambios a una lista de `{ ruta, valor }`.
 * El panel la usa para enseñar el detalle de una entrada del historial.
 *
 * @param {object} objeto
 * @param {string} [prefijo]
 * @returns {Array<{ ruta: string, valor: unknown }>}
 */
export function aplanar(objeto, prefijo = '') {
  if (!objeto || typeof objeto !== 'object' || Array.isArray(objeto)) {
    return [{ ruta: prefijo, valor: objeto }];
  }

  const salida = [];
  for (const [clave, valor] of Object.entries(objeto)) {
    const ruta = prefijo ? `${prefijo}.${clave}` : clave;
    salida.push(...aplanar(valor, ruta));
  }
  return salida;
}

/**
 * Empareja los valores nuevos con los anteriores para enseñar «antes → después».
 *
 * @param {object} cambios Valores que se aplicaron.
 * @param {object} previos Valores que había antes.
 * @returns {Array<{ ruta: string, antes: unknown, despues: unknown }>}
 */
export function compararCambios(cambios, previos) {
  const antes = new Map(aplanar(previos).map((e) => [e.ruta, e.valor]));

  return aplanar(cambios).map(({ ruta, valor }) => ({
    ruta,
    antes: antes.has(ruta) ? antes.get(ruta) : null,
    despues: valor,
  }));
}

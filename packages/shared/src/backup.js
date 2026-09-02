'use strict';

/**
 * Copias de seguridad de la configuración.
 *
 * Exporta los ajustes de un servidor a un archivo e importa ese archivo en el
 * mismo servidor o en otro. Nadie del sector lo ofrece: hoy, si quieres montar
 * un segundo servidor igual que el primero, toca repetir quince módulos a mano.
 *
 * Hay dos modos, y la diferencia importa:
 *
 *   · **completa** — conserva los identificadores de canales y roles. Sirve
 *     para restaurar el MISMO servidor (deshacer un destrozo, volver atrás).
 *
 *   · **portable** — borra esos identificadores. Sirve para llevar la
 *     configuración a OTRO servidor, donde los canales son distintos y copiar
 *     los identificadores dejaría el bot apuntando a canales que no existen.
 */

/** Versión del formato. Sube si el archivo deja de ser compatible. */
const BACKUP_VERSION = 1;

/** Un identificador de Discord: 17 a 20 dígitos. */
const SNOWFLAKE = /^\d{16,20}$/;

/**
 * Nombres de campo que guardan identificadores de Discord.
 *
 * Se filtra por nombre y no por «parece un número largo» a propósito: el texto
 * de un embed puede contener una mención, y no queremos destrozarlo.
 */
const CLAVES_CON_ID = /(?:^|[a-z])(?:channel|role|category|guild|message|user|webhook)s?(?:id)?$/i;

/** ¿Este valor es un identificador de Discord, o una lista de ellos? */
function esIdentificador(valor) {
  if (typeof valor === 'string') return SNOWFLAKE.test(valor);
  if (Array.isArray(valor)) return valor.length > 0 && valor.every((v) => typeof v === 'string' && SNOWFLAKE.test(v));
  return false;
}

/**
 * Devuelve una copia sin los identificadores propios del servidor.
 * Los campos afectados quedan a `null` (o a lista vacía) para que el panel los
 * marque como pendientes de elegir.
 */
function despersonalizar(valor, clave = '') {
  if (Array.isArray(valor)) {
    if (CLAVES_CON_ID.test(clave) && esIdentificador(valor)) return [];
    return valor.map((v) => despersonalizar(v, ''));
  }

  if (valor && typeof valor === 'object') {
    const salida = {};
    for (const [k, v] of Object.entries(valor)) {
      if (CLAVES_CON_ID.test(k) && esIdentificador(v)) {
        salida[k] = Array.isArray(v) ? [] : null;
        continue;
      }
      salida[k] = despersonalizar(v, k);
    }
    return salida;
  }

  return valor;
}

/**
 * Cuenta cuántos identificadores se han quitado, para poder avisar de cuántos
 * canales y roles habrá que volver a elegir.
 */
function contarIdentificadores(valor, clave = '') {
  if (Array.isArray(valor)) {
    if (CLAVES_CON_ID.test(clave) && esIdentificador(valor)) return valor.length;
    return valor.reduce((acc, v) => acc + contarIdentificadores(v, ''), 0);
  }

  if (valor && typeof valor === 'object') {
    let total = 0;
    for (const [k, v] of Object.entries(valor)) {
      if (CLAVES_CON_ID.test(k) && esIdentificador(v)) {
        total += Array.isArray(v) ? v.length : 1;
        continue;
      }
      total += contarIdentificadores(v, k);
    }
    return total;
  }

  return 0;
}

/**
 * Construye el archivo de copia de seguridad.
 *
 * @param {object} params
 * @param {object} params.settings Configuración completa (ya como objeto plano).
 * @param {Set<string>|string[]} params.editableKeys Ramas que se pueden guardar.
 * @param {string} params.guildId
 * @param {string} [params.guildName]
 * @param {'completa'|'portable'} [params.modo]
 * @returns {{ version: number, tipo: string, modo: string, creado: string,
 *            servidor: object, settings: object, identificadoresQuitados: number }}
 */
function buildBackup({ settings, editableKeys, guildId, guildName = '', modo = 'completa' }) {
  const permitidas = editableKeys instanceof Set ? editableKeys : new Set(editableKeys || []);

  // Solo se exporta lo que el panel puede volver a escribir. Incluir `premium`
  // o `stats` haría que la copia pareciera restaurar cosas que nunca aplica.
  const limpio = {};
  for (const clave of permitidas) {
    if (settings?.[clave] !== undefined) limpio[clave] = settings[clave];
  }

  const portable = modo === 'portable';
  const identificadoresQuitados = portable ? contarIdentificadores(limpio) : 0;

  return {
    version: BACKUP_VERSION,
    tipo: 'tkbot-backup',
    modo: portable ? 'portable' : 'completa',
    creado: new Date().toISOString(),
    servidor: { id: guildId, nombre: guildName },
    identificadoresQuitados,
    settings: portable ? despersonalizar(limpio) : limpio,
  };
}

/**
 * Valida y extrae la configuración de un archivo de copia.
 *
 * Es deliberadamente estricto: importar un archivo cualquiera podría dejar el
 * servidor con una configuración sin sentido y sin forma evidente de volver.
 *
 * @param {unknown} datos Contenido del archivo, ya parseado.
 * @param {Set<string>|string[]} editableKeys
 * @returns {{ ok: true, settings: object, meta: object, ignoradas: string[] }
 *          | { ok: false, error: string }}
 */
function parseBackup(datos, editableKeys) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    return { ok: false, error: 'El archivo no contiene una copia de seguridad válida.' };
  }

  if (datos.tipo !== 'tkbot-backup') {
    return {
      ok: false,
      error: 'Ese archivo no es una copia de seguridad de TK$ Bot.',
    };
  }

  if (datos.version > BACKUP_VERSION) {
    return {
      ok: false,
      error: `La copia se hizo con una versión más nueva del panel (v${datos.version}). Actualiza antes de importarla.`,
    };
  }

  if (!datos.settings || typeof datos.settings !== 'object' || Array.isArray(datos.settings)) {
    return { ok: false, error: 'La copia no contiene ninguna configuración.' };
  }

  const permitidas = editableKeys instanceof Set ? editableKeys : new Set(editableKeys || []);

  const settings = {};
  const ignoradas = [];

  for (const [clave, valor] of Object.entries(datos.settings)) {
    if (permitidas.has(clave)) settings[clave] = valor;
    else ignoradas.push(clave);
  }

  if (Object.keys(settings).length === 0) {
    return { ok: false, error: 'La copia no tiene ningún ajuste que se pueda aplicar.' };
  }

  return {
    ok: true,
    settings,
    ignoradas,
    meta: {
      modo: datos.modo === 'portable' ? 'portable' : 'completa',
      creado: datos.creado || null,
      servidor: datos.servidor || null,
      version: datos.version ?? 1,
    },
  };
}

module.exports = {
  BACKUP_VERSION,
  buildBackup,
  parseBackup,
  despersonalizar,
  contarIdentificadores,
};

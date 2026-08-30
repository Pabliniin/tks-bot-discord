/**
 * Lectura y escritura por ruta de puntos (`welcome.card.enabled`).
 *
 * El panel guarda la configuración como un único objeto y los campos del
 * formulario apuntan a rutas dentro de él.
 */

/**
 * Lee un valor anidado.
 * @param {object} object
 * @param {string} path Ruta separada por puntos.
 * @param {*} [fallback] Valor si la ruta no existe.
 */
export function get(object, path, fallback = undefined) {
  if (!object || typeof path !== 'string') return fallback;

  let current = object;
  for (const key of path.split('.')) {
    if (current === null || current === undefined) return fallback;
    current = current[key];
  }
  return current === undefined ? fallback : current;
}

/**
 * Devuelve una copia del objeto con el valor cambiado.
 *
 * No modifica el original: React necesita referencias nuevas para redibujar.
 *
 * @param {object} object
 * @param {string} path
 * @param {*} value
 * @returns {object} Objeto nuevo.
 */
export function set(object, path, value) {
  const keys = path.split('.');
  const root = Array.isArray(object) ? [...object] : { ...(object || {}) };

  let current = root;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    const next = current[key];

    // Se clona cada nivel del camino para no mutar el estado anterior.
    current[key] = Array.isArray(next) ? [...next] : { ...(next || {}) };
    current = current[key];
  }

  current[keys[keys.length - 1]] = value;
  return root;
}

/**
 * Recorre dos objetos y devuelve solo las ramas que cambiaron.
 * Se usa para enviar al servidor únicamente lo modificado.
 */
export function diff(original, updated) {
  const result = {};

  for (const key of Object.keys(updated || {})) {
    const before = original?.[key];
    const after = updated[key];

    if (JSON.stringify(before) === JSON.stringify(after)) continue;

    // Los objetos planos se comparan en profundidad; arrays y primitivos, enteros.
    if (
      after &&
      typeof after === 'object' &&
      !Array.isArray(after) &&
      before &&
      typeof before === 'object' &&
      !Array.isArray(before)
    ) {
      const nested = diff(before, after);
      if (Object.keys(nested).length > 0) result[key] = nested;
    } else {
      result[key] = after;
    }
  }

  return result;
}

/** Identificador corto y único para los elementos de las listas. */
export function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

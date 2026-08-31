/**
 * Combina los eventos de `logs.events` que llegan del panel con los que ya
 * había guardados.
 *
 * `logs.events` es un `Map` de mongoose. El panel solo envía en cada guardado
 * los eventos que el usuario ha tocado (para no mandar el documento entero),
 * pero asignar un objeto parcial a un `Map` con `document.set()` reemplaza el
 * `Map` por completo en vez de combinarlo. Sin este paso, activar "Mensajes
 * editados" hoy borraría "Mensajes eliminados" si se activó en un guardado
 * anterior.
 *
 * Va en su propio módulo, sin dependencias de Next.js ni de mongoose, para
 * poder probarlo de forma aislada (`apps/web/tests/mergeLogEvents.test.mjs`).
 *
 * @param {object} changes Cambios ya filtrados por `sanitizePayload`.
 * @param {{ logs?: { events?: unknown } }} settings Configuración actual guardada.
 * @returns {object} Copia de `changes` con `logs.events` ya combinado.
 */
export function mergeLogEvents(changes, settings) {
  if (!changes?.logs?.events) return changes;

  const existentes = settings?.logs?.events;
  const existentesObj =
    existentes && typeof existentes.entries === 'function'
      ? Object.fromEntries(existentes)
      : existentes || {};

  return {
    ...changes,
    logs: {
      ...changes.logs,
      events: { ...existentesObj, ...changes.logs.events },
    },
  };
}

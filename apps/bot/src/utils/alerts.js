'use strict';

const logger = require('./logger');

/**
 * Avisos de errores a un canal de Discord.
 *
 * En producción no vas a estar mirando los registros del servidor. Con un
 * webhook en `ERROR_WEBHOOK_URL`, los fallos importantes te llegan a un canal
 * privado en cuanto ocurren.
 *
 * Si la variable no está puesta, no hace nada: el bot funciona igual.
 */

/** Errores ya avisados, para no repetir el mismo mensaje sin parar. */
const vistos = new Map();
const SILENCIO_MS = 300_000; // 5 minutos por error idéntico

/** Recorta un texto para que quepa en un embed de Discord. */
function recortar(texto, max) {
  const valor = String(texto ?? '');
  return valor.length > max ? `${valor.slice(0, max - 3)}...` : valor;
}

/** `true` si este error ya se avisó hace poco. */
function repetido(clave) {
  const ahora = Date.now();
  const ultimo = vistos.get(clave);

  if (ultimo && ahora - ultimo < SILENCIO_MS) return true;

  vistos.set(clave, ahora);

  // Limpieza para que el mapa no crezca sin control.
  if (vistos.size > 200) {
    for (const [k, t] of vistos) {
      if (ahora - t > SILENCIO_MS) vistos.delete(k);
    }
  }
  return false;
}

/**
 * Envía un aviso de error.
 *
 * @param {string} titulo Qué ha fallado, en pocas palabras.
 * @param {Error|string} error El error.
 * @param {Record<string, string>} [contexto] Datos útiles: servidor, comando…
 */
async function reportError(titulo, error, contexto = {}) {
  const url = process.env.ERROR_WEBHOOK_URL;
  if (!url || !/^https:\/\/discord(app)?\.com\/api\/webhooks\//.test(url)) return;

  const mensaje = error instanceof Error ? error.message : String(error);
  const pila = error instanceof Error ? error.stack : null;

  // Se agrupa por título y mensaje: el mismo fallo repetido no llena el canal.
  if (repetido(`${titulo}:${mensaje}`)) return;

  const campos = Object.entries(contexto)
    .filter(([, valor]) => valor !== undefined && valor !== null)
    .slice(0, 8)
    .map(([nombre, valor]) => ({
      name: recortar(nombre, 256),
      value: recortar(String(valor), 1024),
      inline: true,
    }));

  const cuerpo = {
    username: 'TK$ Bot · Alertas',
    embeds: [
      {
        title: recortar(`⚠️ ${titulo}`, 256),
        description: `\`\`\`${recortar(mensaje, 1000)}\`\`\``,
        color: 0xed4245,
        fields: [
          ...campos,
          {
            name: 'Instancia',
            value: process.env.INSTANCE_LABEL || require('node:os').hostname(),
            inline: true,
          },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  };

  if (pila) {
    cuerpo.embeds[0].fields.push({
      name: 'Traza',
      value: `\`\`\`${recortar(pila.split('\n').slice(0, 6).join('\n'), 1000)}\`\`\``,
    });
  }

  try {
    // Tiempo límite corto: avisar de un error no debe bloquear el bot.
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    logger.debug(`No se pudo enviar la alerta: ${err.message}`);
  }
}

module.exports = { reportError };

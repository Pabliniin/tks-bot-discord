/**
 * Cliente de la API interna del bot.
 *
 * Todas las llamadas se hacen desde el servidor de Next.js; la clave nunca
 * llega al navegador.
 */

const BASE = process.env.BOT_API_URL || 'http://127.0.0.1:3001';

/**
 * Llama a la API del bot.
 * @param {string} path Ruta, por ejemplo `/api/stats`.
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
async function request(path, options = {}) {
  const secret = process.env.BOT_API_SECRET;
  if (!secret) throw new Error('BOT_API_SECRET no está configurado en el .env.');

  // Si el bot está apagado, la petición debe fallar rápido y no colgar la web.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${BASE}${path}`, {
      ...options,
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': secret,
        ...(options.headers || {}),
      },
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      const error = new Error(data.error || `El bot respondió ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

/** `true` si el bot está encendido y conectado a Discord. */
export async function isBotOnline() {
  try {
    const response = await fetch(`${BASE}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return false;
    const data = await response.json();
    return Boolean(data.ready);
  } catch {
    return false;
  }
}

/** Estadísticas globales, con valores de respaldo si el bot está apagado. */
export async function getStats() {
  try {
    return await request('/api/stats');
  } catch {
    return { guilds: 0, users: 0, commands: 0, ping: 0, offline: true };
  }
}

/** Lista de comandos que el bot tiene cargados. */
export async function getCommands() {
  try {
    return await request('/api/commands');
  } catch {
    return null;
  }
}

/**
 * IDs de los servidores donde está el bot.
 * Devuelve un `Set` vacío si el bot está apagado.
 * @returns {Promise<Set<string>>}
 */
export async function getBotGuildIds() {
  try {
    const data = await request('/api/guilds');
    return new Set(data.ids || []);
  } catch {
    return new Set();
  }
}

/**
 * Datos en vivo de un servidor (canales, roles, emojis).
 * Devuelve `null` si el bot no está en ese servidor o está apagado.
 */
export async function getGuildData(guildId) {
  try {
    return await request(`/api/guilds/${guildId}`);
  } catch {
    return null;
  }
}

/** Refresca la caché de configuración del bot tras guardar. */
export async function invalidateGuild(guildId) {
  try {
    await request(`/api/guilds/${guildId}/invalidate`, { method: 'POST' });
    return true;
  } catch {
    // Si falla, la caché caduca sola en 60 segundos.
    return false;
  }
}

/** Publica (o actualiza) un embed guardado. */
export function publishEmbed(guildId, embedId) {
  return request(`/api/guilds/${guildId}/embeds/${embedId}/publish`, { method: 'POST' });
}

/** Publica (o actualiza) un panel de roles autoasignables. */
export function publishSelfrolePanel(guildId, panelId) {
  return request(`/api/guilds/${guildId}/selfroles/${panelId}/publish`, { method: 'POST' });
}

/** Publica (o actualiza) un panel de tickets. */
export function publishTicketPanel(guildId, panelId) {
  return request(`/api/guilds/${guildId}/tickets/${panelId}/publish`, { method: 'POST' });
}

/** Envía una previsualización del mensaje de bienvenida o despedida. */
export function testWelcome(guildId, userId, type = 'welcome') {
  return request(`/api/guilds/${guildId}/welcome/test`, {
    method: 'POST',
    body: JSON.stringify({ userId, type }),
  });
}

export { request };

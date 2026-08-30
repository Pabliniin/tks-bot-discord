/**
 * Cliente de la API de Discord para el flujo OAuth2 del panel.
 */

const API = 'https://discord.com/api/v10';

/** Permiso «Gestionar servidor», necesario para configurar el bot. */
const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;

/** URL a la que se envía al usuario para iniciar sesión. */
export function buildAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds',
    state,
    prompt: 'none',
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

/** URL para invitar al bot a un servidor. */
export function buildInviteUrl(guildId = null) {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID || '',
    permissions: process.env.BOT_PERMISSIONS || '1633094616310',
    scope: 'bot applications.commands',
  });
  if (guildId) {
    params.set('guild_id', guildId);
    params.set('disable_guild_select', 'true');
  }
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

/** Intercambia el código de autorización por un token de acceso. */
export async function exchangeCode(code) {
  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    client_secret: process.env.DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
  });

  const response = await fetch(`${API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Discord rechazó el código de autorización: ${detail.slice(0, 200)}`);
  }
  return response.json();
}

/** Petición autenticada con el token del usuario. */
async function authorizedFetch(path, accessToken) {
  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    // Los datos del usuario cambian a menudo; no se cachean.
    cache: 'no-store',
  });

  if (response.status === 429) {
    const data = await response.json().catch(() => ({}));
    const error = new Error('Discord ha limitado las peticiones. Prueba en unos segundos.');
    error.retryAfter = data.retry_after ?? 5;
    error.rateLimited = true;
    throw error;
  }
  if (!response.ok) {
    throw new Error(`Discord respondió ${response.status} en ${path}`);
  }
  return response.json();
}

/** Perfil del usuario autenticado. */
export function fetchUser(accessToken) {
  return authorizedFetch('/users/@me', accessToken);
}

/** Servidores del usuario autenticado. */
export function fetchUserGuilds(accessToken) {
  return authorizedFetch('/users/@me/guilds', accessToken);
}

/**
 * ¿Puede este usuario configurar el bot en ese servidor?
 * Basta con ser el dueño o tener «Administrador» o «Gestionar servidor».
 */
export function canManageGuild(guild) {
  return accessReason(guild) !== null;
}

/**
 * Por qué este usuario puede administrar el servidor.
 * Se muestra en la tarjeta del panel para que sepa de dónde le viene el acceso.
 *
 * @returns {'owner'|'administrator'|'manageGuild'|null} `null` si no tiene acceso.
 */
export function accessReason(guild) {
  if (!guild) return null;
  if (guild.owner) return 'owner';

  let permissions;
  try {
    permissions = BigInt(guild.permissions ?? 0);
  } catch {
    // Un valor de permisos corrupto se trata como «sin acceso».
    return null;
  }

  // Administrador implica todos los demás permisos: se comprueba primero.
  if ((permissions & ADMINISTRATOR) === ADMINISTRATOR) return 'administrator';
  if ((permissions & MANAGE_GUILD) === MANAGE_GUILD) return 'manageGuild';
  return null;
}

/** Texto en español de cada motivo de acceso. */
export const ACCESS_LABELS = {
  owner: 'Dueño del servidor',
  administrator: 'Administrador',
  manageGuild: 'Gestionar servidor',
};

/** URL del icono del servidor, o `null` si no tiene. */
export function guildIconUrl(guild, size = 128) {
  if (!guild.icon) return null;
  const extension = guild.icon.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${extension}?size=${size}`;
}

/** URL del avatar del usuario, con respaldo al avatar por defecto. */
export function userAvatarUrl(user, size = 128) {
  if (!user?.avatar) {
    // Los usuarios sin avatar usan uno de los cinco por defecto.
    const index = user?.discriminator && user.discriminator !== '0'
      ? Number(user.discriminator) % 5
      : Number((BigInt(user?.id || '0') >> 22n) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  }
  const extension = user.avatar.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=${size}`;
}

export { MANAGE_GUILD, ADMINISTRATOR, API };

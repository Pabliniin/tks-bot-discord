import { User, Guild, premiumStatus, maxGuildsFor, connect } from '@tkbot/shared';

/**
 * Lectura de datos premium para el panel.
 *
 * Todo se ejecuta en el servidor: el navegador nunca habla con MongoDB.
 */

/**
 * Estado premium del usuario que ha iniciado sesión, con los servidores
 * donde lo tiene activado.
 *
 * @param {string} userId
 */
export async function getUserPremium(userId) {
  if (!userId) return null;

  try {
    await connect();

    const doc = await User.findOne({ userId }).lean();
    const estado = premiumStatus(doc?.premium);
    const guildIds = doc?.premium?.guilds || [];

    // Se acompañan con el nombre real del servidor, si lo tenemos guardado.
    const guilds = await Guild.find({ guildId: { $in: guildIds } })
      .select('guildId premium')
      .lean();

    return {
      ...estado,
      maxGuilds: maxGuildsFor(estado.tier),
      appliedGuilds: guildIds.map((id) => ({
        id,
        premium: premiumStatus(guilds.find((g) => g.guildId === id)?.premium),
      })),
    };
  } catch (error) {
    // Sin base de datos la página sigue mostrándose, solo que sin estado.
    console.error('No se pudo leer el premium del usuario:', error.message);
    return null;
  }
}

/**
 * Estado premium de un servidor.
 * @param {string} guildId
 */
export async function getGuildPremium(guildId) {
  if (!guildId) return null;

  try {
    await connect();
    const doc = await Guild.findOne({ guildId }).select('premium').lean();
    return premiumStatus(doc?.premium);
  } catch (error) {
    console.error('No se pudo leer el premium del servidor:', error.message);
    return null;
  }
}

/** Fecha legible en español, o `null`. */
export function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

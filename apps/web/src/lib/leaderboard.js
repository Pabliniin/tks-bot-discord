import { Member, getGuildSettings, progressFromXp } from '@tkbot/shared';

import { resolveMembers, getPublicGuild } from './botApi';

/**
 * Datos de la clasificación pública.
 *
 * Es la función con más valor comercial de todo el panel: cada miembro del
 * servidor entra a mirar su puesto, y de paso ve la marca. Ningún competidor
 * directo la ofrece, y es la vía por la que crecen los bots que sí la tienen.
 */

/** Criterios por los que se puede ordenar. */
export const CRITERIOS = {
  xp: { campo: 'xp', etiqueta: 'Nivel', unidad: 'XP' },
  messages: { campo: 'messages', etiqueta: 'Mensajes', unidad: 'mensajes' },
  voice: { campo: 'voiceMinutes', etiqueta: 'Voz', unidad: 'minutos' },
  invites: { campo: 'invites.total', etiqueta: 'Invitaciones', unidad: 'invitaciones' },
};

/** Cuántos puestos se enseñan como mucho. */
export const MAX_PUESTOS = 100;

/**
 * Convierte minutos a un texto legible («3 h 20 min»).
 * @param {number} minutos
 */
export function formatearMinutos(minutos) {
  const total = Math.max(0, Math.round(Number(minutos) || 0));
  if (total < 60) return `${total} min`;

  const horas = Math.floor(total / 60);
  const resto = total % 60;

  if (horas < 24) return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;

  const dias = Math.floor(horas / 24);
  return `${dias} d ${horas % 24} h`;
}

/**
 * Lee la clasificación de un servidor.
 *
 * @param {string} guildId
 * @param {object} [options]
 * @param {keyof CRITERIOS} [options.criterio]
 * @param {number} [options.limite]
 * @returns {Promise<{ disponible: boolean, motivo?: string, guild: object|null,
 *                     descripcion: string, puestos: object[], criterio: string }>}
 */
export async function getLeaderboard(guildId, { criterio = 'xp', limite = 50 } = {}) {
  const elegido = CRITERIOS[criterio] ? criterio : 'xp';
  const { campo } = CRITERIOS[elegido];

  const settings = await getGuildSettings(guildId);

  // La clasificación pública va apagada por defecto: publicarla sin que su
  // dueño la haya encendido sería filtrar datos de un servidor privado.
  if (!settings.levels?.publicLeaderboard?.enabled) {
    return {
      disponible: false,
      motivo: 'Este servidor no tiene la clasificación pública activada.',
      guild: null,
      descripcion: '',
      puestos: [],
      criterio: elegido,
    };
  }

  const tope = Math.min(MAX_PUESTOS, Math.max(1, Number(limite) || 50));

  // Solo se piden los campos que se enseñan: el documento entero traería
  // roles guardados y datos de moderación que no pintan en una página pública.
  const miembros = await Member.find({ guildId, [campo]: { $gt: 0 } })
    .sort({ [campo]: -1 })
    .limit(tope)
    .select('userId xp level messages voiceMinutes invites.total')
    .lean();

  const [guild, usuarios] = await Promise.all([
    getPublicGuild(guildId),
    resolveMembers(guildId, miembros.map((m) => m.userId)),
  ]);

  const puestos = miembros.map((miembro, indice) => {
    const usuario = usuarios[miembro.userId];
    const progreso = progressFromXp(miembro.xp || 0);

    return {
      posicion: indice + 1,
      userId: miembro.userId,
      // Sin el bot encendido no hay nombres: se enseña el identificador antes
      // que dejar la fila vacía.
      nombre: usuario?.name || `Usuario ${miembro.userId.slice(-4)}`,
      avatar: usuario?.avatar || null,
      sigueEnElServidor: usuario?.inGuild ?? null,
      nivel: progreso.level,
      xp: miembro.xp || 0,
      progreso: Math.round(progreso.percent),
      xpActual: progreso.current,
      xpNecesaria: progreso.required,
      mensajes: miembro.messages || 0,
      minutosVoz: miembro.voiceMinutes || 0,
      invitaciones: miembro.invites?.total || 0,
    };
  });

  return {
    disponible: true,
    guild,
    descripcion: settings.levels.publicLeaderboard.description || '',
    puestos,
    criterio: elegido,
  };
}

import { Case, Appeal, getGuildSettings } from '@tkbot/shared';

/**
 * Lógica de las apelaciones.
 *
 * Se apoya en que el usuario inicie sesión con Discord: así el sistema sabe
 * quién apela sin fiarse de nada que venga en la dirección, y nadie puede
 * apelar en nombre de otro.
 */

/** Etiqueta en castellano de cada tipo de sanción apelable. */
export const TIPOS_APELABLES = {
  ban: 'Baneo',
  kick: 'Expulsión',
  timeout: 'Aislamiento',
  mute: 'Silenciado',
  softban: 'Softban',
  warn: 'Advertencia',
};

/**
 * Busca la sanción apelable más reciente de un usuario en un servidor.
 *
 * @param {string} guildId
 * @param {string} userId
 * @returns {Promise<{ estado: string, mensaje?: string, caso?: object,
 *                     apelacion?: object, settings?: object }>}
 */
export async function buscarSancionApelable(guildId, userId) {
  const settings = await getGuildSettings(guildId);

  if (!settings.appeals?.enabled) {
    return { estado: 'desactivado', mensaje: 'Este servidor no acepta apelaciones.' };
  }

  const tipos = settings.appeals.types?.length
    ? settings.appeals.types
    : Object.keys(TIPOS_APELABLES);

  const caso = await Case.findOne({ guildId, userId, type: { $in: tipos } })
    .sort({ createdAt: -1 })
    .lean();

  if (!caso) {
    return {
      estado: 'sin_sancion',
      mensaje: 'No encontramos ninguna sanción tuya que se pueda apelar en este servidor.',
      settings,
    };
  }

  // Pasado el plazo la apelación ya no tiene sentido: el equipo no va a
  // revisar algo de hace meses, y decirlo claro evita falsas esperanzas.
  const plazo = settings.appeals.deadlineDays || 0;
  if (plazo > 0) {
    const limite = new Date(caso.createdAt).getTime() + plazo * 86_400_000;
    if (Date.now() > limite) {
      return {
        estado: 'fuera_de_plazo',
        mensaje: `El plazo para apelar era de ${plazo} días desde la sanción, y ya ha pasado.`,
        caso: serializarCaso(caso),
        settings,
      };
    }
  }

  const apelacion = await Appeal.findOne({ guildId, caseId: caso.caseId }).lean();
  if (apelacion) {
    return {
      estado: 'ya_apelada',
      caso: serializarCaso(caso),
      apelacion: serializarApelacion(apelacion),
      settings,
    };
  }

  return { estado: 'apelable', caso: serializarCaso(caso), settings };
}

/** Deja el caso en los campos que puede ver el sancionado. */
export function serializarCaso(caso) {
  return {
    caseId: caso.caseId,
    type: caso.type,
    tipoLegible: TIPOS_APELABLES[caso.type] || caso.type,
    reason: caso.reason,
    createdAt: caso.createdAt,
    duration: caso.duration,
    // Deliberadamente NO se incluye quién fue el moderador: enseñárselo al
    // sancionado es una vía directa al acoso al equipo.
  };
}

/** Deja la apelación en los campos que puede ver quien la escribió. */
export function serializarApelacion(apelacion) {
  return {
    id: String(apelacion._id),
    caseId: apelacion.caseId,
    text: apelacion.text,
    status: apelacion.status,
    reviewNote: apelacion.reviewNote,
    reviewedAt: apelacion.reviewedAt,
    createdAt: apelacion.createdAt,
    sanctionLifted: apelacion.sanctionLifted,
  };
}

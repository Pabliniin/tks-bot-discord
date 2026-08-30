'use strict';

const { Schema, model, models } = require('mongoose');

/** Estadísticas de un usuario dentro de un servidor concreto. */
const memberSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },

    // ── Niveles ──────────────────────────────────────────────────
    xp: { type: Number, default: 0, min: 0 },
    level: { type: Number, default: 0, min: 0 },
    /** Mensajes contados para el ranking de texto. */
    messages: { type: Number, default: 0, min: 0 },
    /** Minutos acumulados en canales de voz. */
    voiceMinutes: { type: Number, default: 0, min: 0 },
    /** Marca de tiempo del último XP otorgado (control de cooldown). */
    lastXpAt: { type: Date, default: null },

    // ── Invitaciones ─────────────────────────────────────────────
    invites: {
      total: { type: Number, default: 0 },
      left: { type: Number, default: 0 },
      fake: { type: Number, default: 0 },
      bonus: { type: Number, default: 0 },
    },
    /** Quién invitó a este miembro. */
    invitedBy: { type: String, default: null },

    // ── Moderación ───────────────────────────────────────────────
    /** Puntos otorgados por moderadores (comando `points`). */
    points: { type: Number, default: 0 },
    /** Advertencias activas (el histórico completo vive en `Case`). */
    warnCount: { type: Number, default: 0, min: 0 },

    // ── Módulos ──────────────────────────────────────────────────
    /** Rol de color activo asignado por el módulo Colores. */
    colorRoleId: { type: String, default: null },
    /** Roles guardados para restaurarlos si el miembro vuelve. */
    savedRoles: { type: [String], default: [] },
    /** Silenciado por el sistema de mute (rol) hasta esta fecha. */
    mutedUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

// Un único documento por combinación servidor + usuario.
memberSchema.index({ guildId: 1, userId: 1 }, { unique: true });
// Consultas del ranking (`top`).
memberSchema.index({ guildId: 1, xp: -1 });
memberSchema.index({ guildId: 1, voiceMinutes: -1 });
memberSchema.index({ guildId: 1, 'invites.total': -1 });

module.exports = models.Member || model('Member', memberSchema);

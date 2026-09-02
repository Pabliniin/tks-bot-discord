'use strict';

const { Schema, model, models } = require('mongoose');

/**
 * Apelaciones de sanciones.
 *
 * Cuando se banea o expulsa a alguien, el mensaje privado incluye un enlace
 * al panel público de apelación. El sancionado escribe su versión sin
 * necesidad de estar en el servidor (del que ya no puede entrar), y el equipo
 * lo revisa desde el panel.
 *
 * Es de lo más pedido en servidores grandes y ProBot no lo tiene: hoy la
 * única vía es que el baneado busque a un moderador por mensaje privado.
 */
const appealSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    /** Caso de moderación que se apela (`Case.caseId`). */
    caseId: { type: Number, required: true },

    userId: { type: String, required: true, index: true },
    userTag: { type: String, default: '' },

    /** Qué alega el sancionado. */
    text: { type: String, required: true, maxlength: 2000 },

    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
      index: true,
    },

    /** Quién la revisó y qué respondió. */
    reviewedBy: { type: String, default: null },
    reviewedByTag: { type: String, default: '' },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: '', maxlength: 1000 },

    /** Si al aceptarla se levantó la sanción automáticamente. */
    sanctionLifted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Una sola apelación por caso: evita que se inunde al equipo con reenvíos.
appealSchema.index({ guildId: 1, caseId: 1 }, { unique: true });
// Bandeja de entrada del panel: pendientes primero, más recientes arriba.
appealSchema.index({ guildId: 1, status: 1, createdAt: -1 });

module.exports = models.Appeal || model('Appeal', appealSchema);

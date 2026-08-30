'use strict';

const { Schema, model, models } = require('mongoose');

/**
 * Historial de acciones de moderación.
 * Cada sanción (ban, kick, warn, timeout…) genera un caso numerado por servidor.
 */
const caseSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    /** Número correlativo dentro del servidor. */
    caseId: { type: Number, required: true },

    type: {
      type: String,
      required: true,
      enum: [
        'ban',
        'unban',
        'softban',
        'kick',
        'vkick',
        'warn',
        'timeout',
        'untimeout',
        'mute',
        'unmute',
        'vmute',
        'vunmute',
        'clear',
        'points',
        'automod',
      ],
      index: true,
    },

    userId: { type: String, required: true, index: true },
    userTag: { type: String, default: '' },
    moderatorId: { type: String, required: true },
    moderatorTag: { type: String, default: '' },

    reason: { type: String, default: 'Sin razón especificada', maxlength: 1000 },
    /** Duración en milisegundos para sanciones temporales. */
    duration: { type: Number, default: null },
    expiresAt: { type: Date, default: null },
    /** Una advertencia retirada deja de contar pero se conserva. */
    active: { type: Boolean, default: true },
    /** Mensaje del registro de logs, para poder editarlo después. */
    logMessageId: { type: String, default: null },
  },
  { timestamps: true }
);

caseSchema.index({ guildId: 1, caseId: 1 }, { unique: true });
caseSchema.index({ guildId: 1, userId: 1, type: 1, active: 1 });
caseSchema.index({ expiresAt: 1 }, { sparse: true });

module.exports = models.Case || model('Case', caseSchema);

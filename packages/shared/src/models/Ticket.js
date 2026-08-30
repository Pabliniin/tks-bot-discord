'use strict';

const { Schema, model, models } = require('mongoose');

/** Un ticket abierto o cerrado del módulo de Tickets. */
const ticketSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true, index: true },
    /** Número correlativo mostrado en el nombre del canal. */
    number: { type: Number, required: true },

    userId: { type: String, required: true, index: true },
    userTag: { type: String, default: '' },
    panelId: { type: String, default: null },

    status: { type: String, enum: ['open', 'claimed', 'closed'], default: 'open', index: true },
    claimedBy: { type: String, default: null },
    closedBy: { type: String, default: null },
    closedAt: { type: Date, default: null },
    closeReason: { type: String, default: '' },

    /** Usuarios añadidos manualmente al ticket. */
    participants: { type: [String], default: [] },
    /** Respuestas del formulario de apertura. */
    formAnswers: [
      {
        _id: false,
        label: { type: String, default: '' },
        value: { type: String, default: '' },
      },
    ],
    /** Transcripción en texto plano generada al cerrar. */
    transcript: { type: String, default: '' },
  },
  { timestamps: true }
);

ticketSchema.index({ guildId: 1, number: 1 }, { unique: true });
ticketSchema.index({ guildId: 1, userId: 1, status: 1 });

module.exports = models.Ticket || model('Ticket', ticketSchema);

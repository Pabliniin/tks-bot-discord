'use strict';

const { Schema, model, models } = require('mongoose');

/**
 * Canal de voz temporal creado por el módulo de Canales Temporales.
 * Se guarda en base de datos para poder limpiar los huérfanos al reiniciar.
 */
const tempChannelSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true, unique: true },
    ownerId: { type: String, required: true },
    /** Miembros bloqueados por el dueño del canal. */
    blockedUsers: { type: [String], default: [] },
    locked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = models.TempChannel || model('TempChannel', tempChannelSchema);

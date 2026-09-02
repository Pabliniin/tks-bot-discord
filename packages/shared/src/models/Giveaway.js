'use strict';

const { Schema, model, models } = require('mongoose');

/**
 * Sorteos.
 *
 * Se guardan en la base de datos y no en memoria porque un sorteo dura días:
 * tiene que sobrevivir a un reinicio del bot. Al arrancar se recogen los que
 * quedaron pendientes y se reprograman.
 */
const giveawaySchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    /** Mensaje del sorteo, que se edita al terminar. */
    messageId: { type: String, required: true, unique: true },

    prize: { type: String, required: true, maxlength: 256 },
    /** Cuántos ganadores hay que sacar. */
    winnerCount: { type: Number, default: 1, min: 1, max: 20 },

    hostId: { type: String, required: true },
    endsAt: { type: Date, required: true, index: true },

    /** `activo`, `terminado` o `cancelado`. */
    status: {
      type: String,
      enum: ['activo', 'terminado', 'cancelado'],
      default: 'activo',
      index: true,
    },

    /**
     * Quién participa.
     *
     * Se guarda la lista entera en el documento en vez de una colección
     * aparte: un sorteo normal tiene decenas o cientos de participantes, y
     * así sortear es leer un solo documento.
     */
    entries: { type: [String], default: [] },

    /** Quién ha ganado, una vez sorteado. */
    winners: { type: [String], default: [] },

    // ── Requisitos para participar ───────────────────────────────
    requirements: {
      /** Hay que tener alguno de estos roles. */
      requiredRoles: { type: [String], default: [] },
      /** No se puede tener ninguno de estos. */
      blockedRoles: { type: [String], default: [] },
      /** Días mínimos en el servidor. */
      minAccountDays: { type: Number, default: 0, min: 0, max: 3650 },
      /** Nivel mínimo del sistema de niveles. */
      minLevel: { type: Number, default: 0, min: 0, max: 1000 },
    },
  },
  { timestamps: true }
);

// Lo que busca la tarea programada: sorteos activos que ya han vencido.
giveawaySchema.index({ status: 1, endsAt: 1 });
// Listado del panel y del comando.
giveawaySchema.index({ guildId: 1, status: 1, endsAt: -1 });

// Los sorteos terminados se conservan 90 días, por si hay que revisar quién
// ganó. Después se borran solos.
giveawaySchema.index({ updatedAt: 1 }, { expireAfterSeconds: 7_776_000 });

module.exports = models.Giveaway || model('Giveaway', giveawaySchema);

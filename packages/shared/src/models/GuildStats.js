'use strict';

const { Schema, model, models } = require('mongoose');

/**
 * Fotografía diaria de la actividad de un servidor.
 *
 * Un documento por servidor y día. El bot va sumando contadores en memoria y
 * los vuelca aquí, así que escribir es barato aunque el servidor sea grande.
 *
 * Con esto el panel dibuja las gráficas de crecimiento y actividad que ProBot
 * no ofrece: hoy un dueño de servidor no tiene forma de saber si está creciendo
 * o perdiendo gente sin contratar otro bot solo para eso.
 */
const guildStatsSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },

    /** Día en formato `AAAA-MM-DD` (UTC), para agrupar sin ambigüedad. */
    date: { type: String, required: true },

    // ── Movimiento de miembros ───────────────────────────────────
    joins: { type: Number, default: 0, min: 0 },
    leaves: { type: Number, default: 0, min: 0 },
    /** Miembros totales al cierre del día: da la curva de crecimiento. */
    memberCount: { type: Number, default: 0, min: 0 },

    // ── Actividad ────────────────────────────────────────────────
    messages: { type: Number, default: 0, min: 0 },
    commands: { type: Number, default: 0, min: 0 },
    /** Minutos de voz acumulados por todos los miembros ese día. */
    voiceMinutes: { type: Number, default: 0, min: 0 },

    // ── Moderación ───────────────────────────────────────────────
    moderationActions: { type: Number, default: 0, min: 0 },
    automodActions: { type: Number, default: 0, min: 0 },

    /**
     * Mensajes por canal (`{ canalId: cantidad }`), para el ranking de
     * canales más activos. Es un Map para no crear un campo por canal.
     */
    channelMessages: { type: Map, of: Number, default: () => new Map() },
  },
  {
    timestamps: true,
    minimize: false,
    // Sin `flattenMaps`, `channelMessages` llegaría al panel como `{}`.
    toObject: { flattenMaps: true },
    toJSON: { flattenMaps: true },
  }
);

// Un documento por servidor y día.
guildStatsSchema.index({ guildId: 1, date: 1 }, { unique: true });
// Consulta habitual del panel: los últimos N días de un servidor.
guildStatsSchema.index({ guildId: 1, createdAt: -1 });

// Se conservan 400 días: permite comparar con el mismo mes del año anterior.
guildStatsSchema.index({ createdAt: 1 }, { expireAfterSeconds: 34_560_000 });

module.exports = models.GuildStats || model('GuildStats', guildStatsSchema);

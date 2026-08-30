'use strict';

const { Schema, model, models } = require('mongoose');

/** Perfil global del usuario, compartido entre todos los servidores. */
const userSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },

    /** Moneda global mostrada por el comando `credits`. */
    credits: { type: Number, default: 0, min: 0 },
    /** Puntos de reputación recibidos (`rep`). */
    reputation: { type: Number, default: 0, min: 0 },
    /** Última vez que dio reputación (cooldown de 24 h). */
    lastRepAt: { type: Date, default: null },
    lastDailyAt: { type: Date, default: null },
    /** Días consecutivos reclamando la recompensa diaria. */
    dailyStreak: { type: Number, default: 0, min: 0 },

    // ── Tarjeta de perfil ────────────────────────────────────────
    profile: {
      title: { type: String, default: '', maxlength: 60 },
      bio: { type: String, default: '', maxlength: 190 },
      background: { type: String, default: '' },
      accentColor: { type: String, default: '#5865F2' },
      textColor: { type: String, default: '#FFFFFF' },
    },

    /** Suscripción premium personal (permite activar servidores). */
    premium: {
      tier: { type: Number, enum: [0, 1, 2], default: 0 },
      until: { type: Date, default: null },
      /** Servidores donde el usuario ha aplicado su premium. */
      guilds: { type: [String], default: [] },
    },

    /** Idioma preferido para las respuestas en mensaje privado. */
    locale: { type: String, enum: ['es', 'en'], default: 'es' },
    /** Excluido de usar el bot (moderación global). */
    blacklisted: { type: Boolean, default: false },
    blacklistReason: { type: String, default: '' },
  },
  { timestamps: true }
);

userSchema.index({ credits: -1 });
userSchema.index({ reputation: -1 });

module.exports = models.User || model('User', userSchema);

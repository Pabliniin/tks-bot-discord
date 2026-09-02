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

    /**
     * Suscripción premium personal (permite activar servidores).
     *
     * Es la única fuente de verdad de lo que tiene contratado alguien, venga
     * de un pago con tarjeta o de un `/premium add` a mano. Así el comando y
     * la pasarela no compiten entre sí: los dos escriben aquí.
     */
    premium: {
      tier: { type: Number, enum: [0, 1, 2], default: 0 },
      until: { type: Date, default: null },
      /** Servidores donde el usuario ha aplicado su premium. */
      guilds: { type: [String], default: [] },
    },

    /**
     * Datos de la pasarela de pago.
     *
     * Van aparte de `premium` a propósito: `premium` dice QUÉ tiene, y esto
     * dice CÓMO lo paga. Alguien con premium regalado no tiene nada aquí, y
     * eso no debe romper nada.
     */
    billing: {
      /** Cliente en Stripe. Hace falta para abrir el portal de facturación. */
      stripeCustomerId: { type: String, default: null, index: true, sparse: true },
      subscriptionId: { type: String, default: null },
      /** `active`, `past_due`, `canceled`, `incomplete`, `trialing`… */
      status: { type: String, default: null },
      /** Precio contratado, para saber a qué plan corresponde. */
      priceId: { type: String, default: null },
      /** Fin del periodo pagado. Es hasta cuándo llega el acceso. */
      currentPeriodEnd: { type: Date, default: null },
      /** Ha pedido la baja: sigue activo hasta que acabe el periodo. */
      cancelAtPeriodEnd: { type: Boolean, default: false },
      /**
       * Marca del último evento aplicado, para descartar los que lleguen
       * tarde: los webhooks no llegan en orden y uno antiguo podría revertir
       * un cambio más nuevo.
       */
      lastEventAt: { type: Date, default: null },
    },

    /**
     * Personal del bot: puede repartir premium con el comando `premium`.
     * Los dueños (variable BOT_OWNERS) tienen acceso siempre, estén aquí o no,
     * y son los únicos que pueden dar o quitar este permiso.
     */
    botStaff: {
      enabled: { type: Boolean, default: false, index: true },
      /** Quién le dio el permiso y cuándo, para poder auditarlo. */
      addedBy: { type: String, default: null },
      addedAt: { type: Date, default: null },
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

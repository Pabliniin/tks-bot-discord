'use strict';

const { Schema, model, models } = require('mongoose');

/**
 * Eventos de Stripe ya procesados.
 *
 * Stripe reintenta un webhook si no responde rápido, y puede mandar el mismo
 * evento varias veces. Sin esta tabla, un reintento de «suscripción creada»
 * volvería a aplicar el mismo cambio; con un pago no es grave, pero con una
 * cancelación o un cambio de plan sí puede dejar la cuenta en un estado raro.
 *
 * El índice único sobre `eventId` es lo que garantiza que solo se procese una
 * vez: el segundo intento choca contra él y se descarta.
 */
const stripeEventSchema = new Schema(
  {
    /** Identificador del evento en Stripe (`evt_...`). */
    eventId: { type: String, required: true, unique: true },
    type: { type: String, required: true },
    /** A quién afectaba, para poder investigar un cobro concreto. */
    userId: { type: String, default: null },
  },
  { timestamps: true }
);

// Se conservan 30 días: de sobra para cubrir los reintentos de Stripe, que
// abandona a las 72 horas.
stripeEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2_592_000 });

module.exports = models.StripeEvent || model('StripeEvent', stripeEventSchema);

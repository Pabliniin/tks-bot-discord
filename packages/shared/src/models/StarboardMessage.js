'use strict';

const { Schema, model, models } = require('mongoose');

/** Relación entre un mensaje original y su copia destacada en el starboard. */
const starboardMessageSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    /** Mensaje original que recibió las estrellas. */
    messageId: { type: String, required: true },
    channelId: { type: String, required: true },
    authorId: { type: String, default: null },
    /** Mensaje publicado en el canal del starboard. */
    starMessageId: { type: String, default: null },
    count: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

starboardMessageSchema.index({ guildId: 1, messageId: 1 }, { unique: true });

module.exports = models.StarboardMessage || model('StarboardMessage', starboardMessageSchema);

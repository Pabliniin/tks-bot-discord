'use strict';

const { Schema, model, models } = require('mongoose');

/**
 * Registro de las instancias del bot que están en marcha.
 *
 * Sirve para detectar el error más confuso que se puede cometer al desplegar:
 * tener el bot encendido en dos sitios a la vez (por ejemplo en el PC y en el
 * servidor) con el mismo token. Discord reparte los comandos entre ambos, y si
 * cada uno usa una base de datos distinta, la mitad de las acciones "no
 * funcionan" sin ningún mensaje de error.
 *
 * Cada instancia se anuncia cada 30 segundos. Si al arrancar detecta otra
 * activa, avisa por consola.
 */
const botInstanceSchema = new Schema(
  {
    /** Identificador único de esta ejecución. */
    instanceId: { type: String, required: true, unique: true },
    /** Nombre de la máquina o del contenedor, para saber cuál es. */
    host: { type: String, default: 'desconocido' },
    /** Etiqueta legible: `local`, `easypanel`, `docker`… */
    label: { type: String, default: 'desconocido' },

    startedAt: { type: Date, default: Date.now },
    /**
     * Última señal de vida. Se actualiza cada 30 segundos.
     * El índice lo declara `schema.index()` más abajo, con caducidad.
     */
    lastSeen: { type: Date, default: Date.now },

    guildCount: { type: Number, default: 0 },
    botTag: { type: String, default: '' },
  },
  { timestamps: false }
);

// Las instancias que dejan de dar señales se borran solas a los 5 minutos.
botInstanceSchema.index({ lastSeen: 1 }, { expireAfterSeconds: 300 });

module.exports = models.BotInstance || model('BotInstance', botInstanceSchema);

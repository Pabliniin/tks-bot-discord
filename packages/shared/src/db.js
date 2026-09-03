'use strict';

const mongoose = require('mongoose');

/**
 * Conexión a MongoDB cacheada.
 *
 * Next.js recarga los módulos en caliente durante el desarrollo, así que la
 * conexión se guarda en `globalThis` para no abrir una nueva en cada recarga.
 */
const globalCache = globalThis;
if (!globalCache.__tkbotMongoose) {
  globalCache.__tkbotMongoose = { conn: null, promise: null };
}
const cached = globalCache.__tkbotMongoose;

mongoose.set('strictQuery', true);

/**
 * Abre (o reutiliza) la conexión con MongoDB.
 * @param {string} [uri] Cadena de conexión. Por defecto `process.env.MONGODB_URI`.
 * @returns {Promise<import('mongoose').Mongoose>}
 */
async function connect(uri = process.env.MONGODB_URI) {
  if (!uri) {
    throw new Error(
      'Falta MONGODB_URI. Copia .env.example a .env y rellena la cadena de conexión.'
    );
  }
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, {
        maxPoolSize: 20,
        /*
         * Antes eran 15 segundos, pero Discord descarta una interacción a los
         * 3: con el valor viejo, una base de datos inaccesible dejaba al bot
         * mudo ante cualquier comando de barra, sin error visible. Ahora falla
         * pronto y quien llama puede responder con los valores por defecto.
         */
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        /*
         * Sin esto, mongoose encola las consultas cuando no hay conexión y las
         * deja esperando 10 segundos antes de fallar, que es justo el mismo
         * problema por otra vía.
         */
        bufferTimeoutMS: 3000,
      })
      .then((m) => {
        cached.conn = m;
        return m;
      })
      .catch((err) => {
        // Permite reintentar en la siguiente llamada en lugar de cachear el fallo.
        cached.promise = null;
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

/** Cierra la conexión (usado en tests y al apagar el proceso). */
async function disconnect() {
  if (cached.conn) {
    await mongoose.disconnect();
    cached.conn = null;
    cached.promise = null;
  }
}

/** `true` si hay una conexión activa. */
function isConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connect, disconnect, isConnected, mongoose };

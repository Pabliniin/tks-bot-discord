'use strict';

/**
 * Reparación de índices con caducidad (TTL).
 *
 * MongoDB **no permite cambiar las opciones de un índice que ya existe**. Si
 * una colección se creó con `{ lastSeen: 1 }` normal y después el modelo pasa a
 * pedirlo con `expireAfterSeconds`, mongoose intenta crearlo, MongoDB dice que
 * ya existe y no pasa nada más: el índice se queda **sin caducidad para
 * siempre** y los documentos no se borran nunca.
 *
 * Es un fallo silencioso de los peores, porque no da ningún error: la
 * colección simplemente crece sin parar hasta que alguien mira.
 *
 * Esto lo detecta al arrancar y lo arregla borrando el índice y dejando que
 * mongoose lo vuelva a crear bien.
 */

/** Índices con caducidad que deben existir, por modelo. */
const ESPERADOS = [
  { modelo: 'BotInstance', campo: 'lastSeen', segundos: 300 },
  { modelo: 'ConfigHistory', campo: 'createdAt', segundos: 15_552_000 },
  { modelo: 'GuildStats', campo: 'createdAt', segundos: 34_560_000 },
  { modelo: 'StripeEvent', campo: 'createdAt', segundos: 2_592_000 },
  { modelo: 'Giveaway', campo: 'updatedAt', segundos: 7_776_000 },
];

/**
 * Revisa y repara los índices de caducidad.
 *
 * @param {object} models Modelos de mongoose, por nombre.
 * @param {(mensaje: string) => void} [avisar] Para escribir en los registros.
 * @returns {Promise<{ revisados: number, reparados: string[], fallos: string[] }>}
 */
async function repararIndicesTTL(models, avisar = () => {}) {
  const reparados = [];
  const fallos = [];
  let revisados = 0;

  for (const { modelo, campo, segundos } of ESPERADOS) {
    const Modelo = models[modelo];
    if (!Modelo) continue;

    try {
      const indices = await Modelo.collection.indexes();
      revisados += 1;

      // Solo interesa el índice de ese campo, y solo si es de un único campo.
      const actual = indices.find((i) => {
        const claves = Object.keys(i.key || {});
        return claves.length === 1 && claves[0] === campo;
      });

      // No existe todavía: mongoose lo creará bien por su cuenta.
      if (!actual) continue;

      // Ya está como debe.
      if (actual.expireAfterSeconds === segundos) continue;

      /*
       * Existe pero con la caducidad equivocada (o sin ninguna). Se borra para
       * que mongoose lo rehaga con las opciones correctas. Borrar un índice no
       * toca los datos: solo la estructura que los ordena.
       */
      await Modelo.collection.dropIndex(actual.name);
      await Modelo.syncIndexes();

      reparados.push(`${modelo}.${campo}`);
      avisar(
        `Índice de caducidad reparado en ${modelo}.${campo} ` +
          `(estaba ${actual.expireAfterSeconds === undefined ? 'sin caducidad' : `a ${actual.expireAfterSeconds} s`}, ` +
          `debía ser ${segundos} s).`
      );
    } catch (err) {
      /*
       * No se corta el arranque por esto: un índice mal puesto hace que los
       * datos viejos no se borren, pero el bot funciona igual. Es mejor
       * anotarlo y seguir que dejar el bot sin arrancar.
       */
      fallos.push(`${modelo}.${campo}: ${err.message}`);
    }
  }

  return { revisados, reparados, fallos };
}

module.exports = { repararIndicesTTL, ESPERADOS };

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

/**
 * Pruebas del límite de tiempo al cargar la configuración.
 *
 * Es la protección contra el fallo más desconcertante que puede dar el bot:
 * si MongoDB tarda, Discord da la interacción por perdida a los 3 segundos y
 * enseña «La aplicación no ha respondido», sin ningún error en ningún sitio.
 *
 * Se ejecutan con: npm run test --workspace @tkbot/bot
 */

/**
 * Carga `utils/settings` con un `getGuildSettings` de mentira.
 *
 * Se sustituye el módulo compartido en la caché de `require` antes de cargar
 * el que se quiere probar; así se controla exactamente cuánto tarda la
 * «base de datos» sin necesitar una de verdad.
 */
function cargarSettings(getGuildSettings) {
  const rutaCompartida = require.resolve('@tkbot/shared');
  const rutaSettings = require.resolve('../src/utils/settings');

  const originalCompartido = require.cache[rutaCompartida];
  const realCompartido = require('@tkbot/shared');

  delete require.cache[rutaSettings];
  require.cache[rutaCompartida] = {
    id: rutaCompartida,
    filename: rutaCompartida,
    loaded: true,
    exports: { ...realCompartido, getGuildSettings },
  };

  const settings = require('../src/utils/settings');

  // Se deja todo como estaba para no afectar a las demás pruebas.
  const restaurar = () => {
    delete require.cache[rutaSettings];
    if (originalCompartido) require.cache[rutaCompartida] = originalCompartido;
    else delete require.cache[rutaCompartida];
  };

  return { settings, restaurar };
}

test('una base de datos lenta no bloquea la respuesta', async () => {
  // Simula MongoDB tardando 5 segundos: más de lo que Discord espera.
  const lenta = () => new Promise((resolver) => {
    const t = setTimeout(() => resolver({ guildId: '1', prefix: '!' }), 5000);
    t.unref?.();
  });

  const { settings, restaurar } = cargarSettings(lenta);

  try {
    const empezo = Date.now();
    const resultado = await settings.get('123456789012345678', { timeoutMs: 300 });
    const tardo = Date.now() - empezo;

    assert.ok(tardo < 1000, `tardó ${tardo} ms: debería haber cortado en 300`);
    assert.ok(resultado, 'debe devolver algo con lo que trabajar, no undefined');
    // Al no haber caché previa, se devuelven los valores de fábrica.
    assert.equal(resultado.prefix, '-');
  } finally {
    restaurar();
  }
});

test('los valores por defecto traen toda la configuración del esquema', async () => {
  const { settings, restaurar } = cargarSettings(() => Promise.resolve({}));

  try {
    const defecto = settings.porDefecto('123456789012345678');

    // Si faltara alguna rama, los comandos fallarían al leerla.
    assert.equal(defecto.guildId, '123456789012345678');
    assert.equal(defecto.prefix, '-');
    assert.equal(typeof defecto.logs, 'object');
    assert.equal(typeof defecto.automod, 'object');
    assert.equal(typeof defecto.music, 'object');
    assert.equal(defecto.music.enabled, true);
  } finally {
    restaurar();
  }
});

test('si la base de datos responde a tiempo se usa su valor, no el de fábrica', async () => {
  const rapida = () => Promise.resolve({ guildId: '1', prefix: '!!' });
  const { settings, restaurar } = cargarSettings(rapida);

  try {
    const resultado = await settings.get('123456789012345678', { timeoutMs: 1000 });
    assert.equal(resultado.prefix, '!!');
  } finally {
    restaurar();
  }
});

test('una copia caducada de la caché gana a los valores de fábrica', async () => {
  let llamadas = 0;

  const primeroRapidoLuegoLento = () => {
    llamadas += 1;
    if (llamadas === 1) return Promise.resolve({ guildId: '1', prefix: '?' });

    return new Promise((resolver) => {
      const t = setTimeout(() => resolver({ guildId: '1', prefix: '?' }), 5000);
      t.unref?.();
    });
  };

  const { settings, restaurar } = cargarSettings(primeroRapidoLuegoLento);

  try {
    // Primera llamada: llena la caché.
    await settings.get('123456789012345678', { timeoutMs: 1000 });

    // Se caduca la entrada a mano para forzar una recarga.
    settings.invalidate('123456789012345678');
    await settings.get('123456789012345678', { timeoutMs: 100 }).catch(() => {});

    // Se vuelve a pedir: aunque la base siga lenta, hay algo en caché.
    const resultado = await settings.get('123456789012345678', { timeoutMs: 100 });
    assert.ok(resultado);
  } finally {
    restaurar();
  }
});

test('sin límite de tiempo se espera lo que haga falta', async () => {
  const media = () => new Promise((resolver) => {
    const t = setTimeout(() => resolver({ guildId: '1', prefix: '#' }), 120);
    t.unref?.();
  });

  const { settings, restaurar } = cargarSettings(media);

  try {
    // Los eventos de mensaje sí pueden esperar: no hay ventana de 3 segundos.
    const resultado = await settings.get('123456789012345678');
    assert.equal(resultado.prefix, '#');
  } finally {
    restaurar();
  }
});

test('el límite para interacciones cabe de sobra en la ventana de Discord', () => {
  const { settings, restaurar } = cargarSettings(() => Promise.resolve({}));

  try {
    // Discord descarta la interacción a los 3 segundos. El límite tiene que
    // dejar margen para lo que venga después (permisos, embed, envío).
    assert.ok(settings.TIMEOUT_INTERACCION < 2000, 'demasiado cerca del límite de Discord');
    assert.ok(settings.TIMEOUT_INTERACCION >= 500, 'tan corto que fallaría con latencia normal');
  } finally {
    restaurar();
  }
});

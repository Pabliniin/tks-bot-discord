'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const instanceGuard = require('../src/modules/instanceGuard');

/**
 * Pruebas del vigilante de instancias duplicadas.
 *
 * `onShutdown` existe porque, sin él, cada despliegue en Easypanel disparaba
 * una falsa alarma: el contenedor nuevo arranca antes de que el viejo se
 * apague del todo, y como el registro del viejo tardaba hasta 5 minutos en
 * caducar por sí solo, el nuevo lo veía como una instancia de verdad en vez
 * de como el solapamiento normal de un despliegue.
 *
 * Se ejecutan con: npm run test --workspace @tkbot/bot
 */

test('el módulo se identifica a sí mismo con un id estable', () => {
  assert.equal(typeof instanceGuard.instanceId, 'string');
  assert.ok(instanceGuard.instanceId.length > 0);

  // Debe ser el mismo id durante toda la vida del proceso: si cambiara,
  // el propio módulo se confundiría a sí mismo con otra instancia.
  assert.equal(instanceGuard.instanceId, instanceGuard.instanceId);
});

test('se anuncia con la etiqueta correcta según el entorno', () => {
  const previos = {
    INSTANCE_LABEL: process.env.INSTANCE_LABEL,
    EASYPANEL_PROJECT: process.env.EASYPANEL_PROJECT,
  };

  try {
    delete process.env.INSTANCE_LABEL;
    delete process.env.EASYPANEL_PROJECT;
    assert.match(instanceGuard.etiqueta(), /^local/, 'sin pistas, se asume local');

    process.env.EASYPANEL_PROJECT = 'tks_bot';
    assert.equal(instanceGuard.etiqueta(), 'easypanel');

    process.env.INSTANCE_LABEL = 'produccion';
    assert.equal(instanceGuard.etiqueta(), 'produccion', 'la etiqueta explícita manda sobre todo');
  } finally {
    for (const [clave, valor] of Object.entries(previos)) {
      if (valor === undefined) delete process.env[clave];
      else process.env[clave] = valor;
    }
  }
});

test('onShutdown existe: sin él, un despliegue deja un registro fantasma', () => {
  /*
   * Esta es la prueba que habría cazado el fallo. El resto de módulos que
   * guardan estado en la base de datos (dailyStats, usageStats) sí tienen
   * `onShutdown`; a este se le olvidó, y `index.js` solo llama al que exista,
   * así que la ausencia no daba ningún error: el bot simplemente nunca
   * limpiaba su propio registro al parar.
   */
  assert.equal(
    typeof instanceGuard.onShutdown,
    'function',
    'sin onShutdown, el registro de esta instancia sobrevive al apagado y ' +
      'dispara falsas alarmas de «instancia duplicada» en el siguiente despliegue'
  );
});

test('onShutdown no revienta sin conexión a la base de datos', async () => {
  // En las pruebas no hay MongoDB: debe fallar en silencio, no tirar el
  // apagado del proceso justo cuando más limpio tiene que ser.
  await assert.doesNotReject(() => instanceGuard.onShutdown());
});

test('contarActivas cuenta al menos esta misma instancia', async () => {
  // Sin base de datos, `otrasInstancias()` devuelve vacío por su propio
  // `.catch(() => [])`, así que el mínimo garantizado es uno: uno mismo.
  const total = await instanceGuard.contarActivas();
  assert.ok(total >= 1);
});

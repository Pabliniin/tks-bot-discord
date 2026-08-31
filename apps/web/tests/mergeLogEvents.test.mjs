import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeLogEvents } from '../src/lib/mergeLogEvents.js';

/**
 * Pruebas del arreglo para `logs.events`: activar un evento en un guardado
 * no debía borrar los eventos activados en guardados anteriores.
 *
 * Se ejecutan con: npm run test --workspace @tkbot/web
 */

test('combina el evento nuevo con los que ya había guardados', () => {
  const settings = { logs: { events: { messageDelete: { enabled: true, channelId: '1' } } } };
  const changes = { logs: { events: { messageUpdate: { enabled: true, channelId: '2' } } } };

  const resultado = mergeLogEvents(changes, settings);

  assert.deepEqual(resultado.logs.events, {
    messageDelete: { enabled: true, channelId: '1' },
    messageUpdate: { enabled: true, channelId: '2' },
  });
});

test('el evento nuevo sustituye al antiguo si es el mismo', () => {
  const settings = { logs: { events: { messageDelete: { enabled: true, channelId: '1' } } } };
  const changes = { logs: { events: { messageDelete: { enabled: false } } } };

  const resultado = mergeLogEvents(changes, settings);

  assert.deepEqual(resultado.logs.events.messageDelete, { enabled: false });
});

test('funciona cuando `logs.events` llega como Map de mongoose', () => {
  const settings = { logs: { events: new Map([['memberBan', { enabled: true, channelId: '3' }]]) } };
  const changes = { logs: { events: { messageDelete: { enabled: true } } } };

  const resultado = mergeLogEvents(changes, settings);

  assert.deepEqual(resultado.logs.events, {
    memberBan: { enabled: true, channelId: '3' },
    messageDelete: { enabled: true },
  });
});

test('no toca los cambios si no hay `logs.events` en el guardado', () => {
  const settings = { logs: { events: { messageDelete: { enabled: true } } } };
  const changes = { prefix: '!' };

  assert.equal(mergeLogEvents(changes, settings), changes);
});

test('conserva el resto de `logs` (enabled, defaultChannelId…) sin tocarlo', () => {
  const settings = { logs: { events: { messageDelete: { enabled: true } } } };
  const changes = { logs: { enabled: true, defaultChannelId: '9', events: { messageUpdate: { enabled: true } } } };

  const resultado = mergeLogEvents(changes, settings);

  assert.equal(resultado.logs.enabled, true);
  assert.equal(resultado.logs.defaultChannelId, '9');
  assert.deepEqual(resultado.logs.events, {
    messageDelete: { enabled: true },
    messageUpdate: { enabled: true },
  });
});

test('no revienta si la configuración guardada no tiene `logs` todavía', () => {
  const changes = { logs: { events: { messageDelete: { enabled: true } } } };

  const resultado = mergeLogEvents(changes, {});

  assert.deepEqual(resultado.logs.events, { messageDelete: { enabled: true } });
});

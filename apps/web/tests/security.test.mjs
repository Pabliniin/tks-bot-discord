import test from 'node:test';
import assert from 'node:assert/strict';

import { validateSettings, urlValida } from '../src/lib/validateSettings.js';
import { checkRateLimit, resetRateLimits, REGLAS } from '../src/lib/rateLimit.js';

/**
 * Pruebas de las protecciones del panel.
 *
 * Todas comprueban cosas que el navegador ya impide, pero que hay que
 * verificar en el servidor: un atacante no usa el navegador.
 */

// ── Límites del plan ──────────────────────────────────────────

test('un servidor gratuito no puede superar los 5 embeds', () => {
  const cambios = { embeds: Array.from({ length: 6 }, (_, i) => ({ id: `e${i}` })) };
  const resultado = validateSettings(cambios, {}, 0);

  assert.equal(resultado.ok, false);
  assert.match(resultado.errors[0], /5 embeds guardados/);
});

test('con Premium 2 sí puede tener 100 embeds', () => {
  const cambios = { embeds: Array.from({ length: 100 }, (_, i) => ({ id: `e${i}` })) };
  assert.equal(validateSettings(cambios, {}, 2).ok, true);

  // Pero no 101.
  cambios.embeds.push({ id: 'extra' });
  assert.equal(validateSettings(cambios, {}, 2).ok, false);
});

test('los límites se aplican a las cuatro listas de pago', () => {
  const casos = [
    { cambios: { embeds: Array(6).fill({}) }, texto: /embeds/ },
    { cambios: { autoresponder: { responses: Array(11).fill({}) } }, texto: /respuestas/ },
    { cambios: { selfroles: { panels: Array(6).fill({}) } }, texto: /paneles de roles/ },
    { cambios: { tickets: { panels: Array(2).fill({}) } }, texto: /paneles de tickets/ },
  ];

  for (const caso of casos) {
    const r = validateSettings(caso.cambios, {}, 0);
    assert.equal(r.ok, false, `deberia rechazar: ${JSON.stringify(caso.cambios).slice(0, 40)}`);
    assert.match(r.errors.join(' '), caso.texto);
  }
});

test('hay topes absolutos aunque tengas el plan más alto', () => {
  // Nadie necesita 5000 roles por nivel: eso es un intento de llenar la base.
  const cambios = { levels: { roles: Array(500).fill({ level: 1, roleId: '1' }) } };
  const resultado = validateSettings(cambios, {}, 2);

  assert.equal(resultado.ok, false);
  assert.match(resultado.errors.join(' '), /roles por nivel/);
});

// ── URLs peligrosas ───────────────────────────────────────────

test('acepta http y https, y rechaza el resto', () => {
  assert.equal(urlValida('https://ejemplo.com/a.png'), true);
  assert.equal(urlValida('http://ejemplo.com/a.png'), true);
  assert.equal(urlValida(''), true, 'vacío es válido: significa sin imagen');
  assert.equal(urlValida(undefined), true);

  assert.equal(urlValida('javascript:alert(1)'), false);
  assert.equal(urlValida('data:text/html,<script>alert(1)</script>'), false);
  assert.equal(urlValida('file:///etc/passwd'), false);
  assert.equal(urlValida('no es una url'), false);
});

test('rechaza una URL javascript: dentro de un embed', () => {
  const cambios = {
    welcome: {
      embed: { color: '#FFFFFF', thumbnail: 'javascript:alert(1)', fields: [] },
    },
  };

  const resultado = validateSettings(cambios, {}, 0);
  assert.equal(resultado.ok, false);
  assert.match(resultado.errors.join(' '), /http:\/\/ o https:\/\//);
});

test('encuentra embeds peligrosos dentro de listas anidadas', () => {
  const cambios = {
    embeds: [
      { id: 'a', embed: { color: '#FFF', image: 'https://ok.com/a.png', fields: [] } },
      { id: 'b', embed: { color: '#FFF', image: 'data:text/html,<script>', fields: [] } },
    ],
  };

  assert.equal(validateSettings(cambios, {}, 1).ok, false);
});

test('rechaza fondos de tarjeta que no sean http', () => {
  const cambios = { welcome: { card: { background: 'javascript:void(0)' } } };
  assert.equal(validateSettings(cambios, {}, 0).ok, false);
});

// ── Textos y prefijo ──────────────────────────────────────────

test('limita la longitud de los mensajes', () => {
  const cambios = { welcome: { message: 'a'.repeat(2500) } };
  const resultado = validateSettings(cambios, {}, 2);

  assert.equal(resultado.ok, false);
  assert.match(resultado.errors.join(' '), /2000 caracteres/);
});

test('el prefijo no puede estar vacío ni llevar espacios', () => {
  assert.equal(validateSettings({ prefix: '' }, {}, 0).ok, false);
  assert.equal(validateSettings({ prefix: '  ' }, {}, 0).ok, false);
  assert.equal(validateSettings({ prefix: 'a b' }, {}, 0).ok, false);
  assert.equal(validateSettings({ prefix: '!' }, {}, 0).ok, true);
  assert.equal(validateSettings({ prefix: '??' }, {}, 0).ok, true);
});

test('una configuración normal pasa sin problemas', () => {
  const cambios = {
    prefix: '-',
    welcome: {
      enabled: true,
      channelId: '123456789012345678',
      message: '¡Bienvenido [user]!',
      card: { enabled: true, background: 'https://ejemplo.com/fondo.png' },
      embed: { color: '#5865F2', title: 'Hola', fields: [] },
    },
    levels: { enabled: true, roles: [{ level: 5, roleId: '1' }] },
  };

  const resultado = validateSettings(cambios, {}, 0);
  assert.equal(resultado.ok, true, resultado.errors.join(' · '));
});

// ── Limitador de peticiones ───────────────────────────────────

test('deja pasar hasta el límite y luego corta', () => {
  resetRateLimits();
  const usuario = 'usuario-1';

  for (let i = 0; i < REGLAS.guardar.max; i += 1) {
    assert.equal(checkRateLimit(usuario, 'guardar').ok, true, `peticion ${i + 1} deberia pasar`);
  }

  const cortada = checkRateLimit(usuario, 'guardar');
  assert.equal(cortada.ok, false);
  assert.ok(cortada.resetEnSegundos > 0);
});

test('cada usuario tiene su propio contador', () => {
  resetRateLimits();

  for (let i = 0; i < REGLAS.guardar.max; i += 1) checkRateLimit('usuario-a', 'guardar');
  assert.equal(checkRateLimit('usuario-a', 'guardar').ok, false);

  // El otro usuario no se ve afectado.
  assert.equal(checkRateLimit('usuario-b', 'guardar').ok, true);
});

test('los distintos tipos de acción no comparten cuota', () => {
  resetRateLimits();

  for (let i = 0; i < REGLAS.publicar.max; i += 1) checkRateLimit('usuario-c', 'publicar');
  assert.equal(checkRateLimit('usuario-c', 'publicar').ok, false);

  // Guardar sigue disponible.
  assert.equal(checkRateLimit('usuario-c', 'guardar').ok, true);
});

test('publicar es más restrictivo que leer', () => {
  assert.ok(
    REGLAS.publicar.max < REGLAS.leer.max,
    'publicar consume cuota de Discord: debe ser más estricto'
  );
});

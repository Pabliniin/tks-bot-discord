'use strict';

const { createCanvas } = require('@napi-rs/canvas');
const { AttachmentBuilder } = require('discord.js');
const { parseVariables } = require('@tkbot/shared');

const h = require('./helpers');

const WIDTH = 1000;
const HEIGHT = 350;

/**
 * Genera la imagen de bienvenida o despedida.
 *
 * @param {object} options
 * @param {string} options.avatarUrl URL del avatar del miembro.
 * @param {object} options.card Configuración `welcome.card` o `goodbye.card`.
 * @param {Record<string, unknown>} options.variables Variables a sustituir.
 * @returns {Promise<import('discord.js').AttachmentBuilder>}
 */
async function generateWelcomeCard({ avatarUrl, card = {}, variables = {} }) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  const accent = h.safeColor(card.accentColor, '#5865F2');
  const textColor = h.safeColor(card.textColor, '#FFFFFF');

  await h.drawBackground(ctx, WIDTH, HEIGHT, card.background, accent, card.overlayOpacity ?? 0.45);

  // Marco interior sutil.
  ctx.strokeStyle = h.hexToRgba(accent, 0.6);
  ctx.lineWidth = 3;
  h.roundRect(ctx, 16, 16, WIDTH - 32, HEIGHT - 32, 22);
  ctx.stroke();

  // Avatar centrado en la parte superior.
  const avatarSize = 150;
  const avatarX = (WIDTH - avatarSize) / 2;
  const avatarY = 32;
  const avatar = await h.loadImageSafe(avatarUrl);
  h.drawAvatar(ctx, avatar, avatarX, avatarY, avatarSize, card.avatarShape || 'circle', accent, 6);

  ctx.textAlign = 'center';
  ctx.fillStyle = textColor;

  // Sombra para que el texto se lea sobre cualquier fondo.
  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;

  const maxWidth = WIDTH - 100;

  const title = parseVariables(card.titleText || 'BIENVENIDO', variables).toUpperCase();
  const titleSize = h.fitText(ctx, title, maxWidth, 46, 'bold');
  ctx.font = h.font(titleSize, 'bold');
  ctx.fillText(title, WIDTH / 2, 232);

  const subtitle = parseVariables(card.subtitleText || '[userName]', variables);
  const subtitleSize = h.fitText(ctx, subtitle, maxWidth, 36, 'bold');
  ctx.font = h.font(subtitleSize, 'bold');
  ctx.fillStyle = accent;
  ctx.fillText(subtitle, WIDTH / 2, 280);

  const footer = parseVariables(card.footerText || '', variables);
  if (footer) {
    ctx.fillStyle = h.hexToRgba(textColor === '#FFFFFF' ? '#FFFFFF' : textColor, 0.85);
    const footerSize = h.fitText(ctx, footer, maxWidth, 24, 'normal');
    ctx.font = h.font(footerSize, 'normal');
    ctx.fillText(footer, WIDTH / 2, 318);
  }

  ctx.shadowColor = 'transparent';

  const buffer = await canvas.encode('png');
  return new AttachmentBuilder(buffer, { name: 'bienvenida.png' });
}

module.exports = { generateWelcomeCard, WIDTH, HEIGHT };

'use strict';

const { createCanvas } = require('@napi-rs/canvas');
const { AttachmentBuilder } = require('discord.js');
const { progressFromXp } = require('@tkbot/shared');

const h = require('./helpers');
const { formatNumber } = require('../utils/time');

const WIDTH = 934;
const HEIGHT = 282;

/**
 * Genera la tarjeta de rango del comando `rank`.
 *
 * @param {object} options
 * @param {string} options.username
 * @param {string} options.avatarUrl
 * @param {number} options.xp XP total del miembro.
 * @param {number} options.rank Posición en el ranking del servidor.
 * @param {string} [options.status] Estado de Discord (`online`, `idle`…).
 * @param {object} [options.card] Personalización (`levels.card`).
 * @returns {Promise<AttachmentBuilder>}
 */
async function generateRankCard({ username, avatarUrl, xp, rank, status = 'offline', card = {} }) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  const accent = h.safeColor(card.accentColor, '#5865F2');
  const textColor = h.safeColor(card.textColor, '#FFFFFF');
  const { level, current, required, percent } = progressFromXp(xp);

  // Fondo.
  if (card.background) {
    await h.drawBackground(ctx, WIDTH, HEIGHT, card.background, accent, 0.55);
  } else {
    h.drawGradient(ctx, WIDTH, HEIGHT, '#23272A', '#1A1C1F');
  }

  // Panel interior semitransparente.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  h.roundRect(ctx, 22, 22, WIDTH - 44, HEIGHT - 44, 24);
  ctx.fill();

  // Avatar con anillo de estado.
  const avatarSize = 160;
  const avatarX = 55;
  const avatarY = (HEIGHT - avatarSize) / 2;
  const avatar = await h.loadImageSafe(avatarUrl);
  h.drawAvatar(ctx, avatar, avatarX, avatarY, avatarSize, 'circle', accent, 6);

  const STATUS_COLORS = {
    online: '#3BA55D',
    idle: '#FAA81A',
    dnd: '#ED4245',
    offline: '#747F8D',
    invisible: '#747F8D',
  };
  const dotRadius = 22;
  const dotX = avatarX + avatarSize - dotRadius - 4;
  const dotY = avatarY + avatarSize - dotRadius - 4;

  ctx.fillStyle = '#1A1C1F';
  ctx.beginPath();
  ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = STATUS_COLORS[status] || STATUS_COLORS.offline;
  ctx.beginPath();
  ctx.arc(dotX, dotY, dotRadius - 5, 0, Math.PI * 2);
  ctx.fill();

  // Nombre de usuario.
  const textX = 250;
  ctx.textAlign = 'left';
  ctx.fillStyle = textColor;
  const nameSize = h.fitText(ctx, username, 380, 34, 'bold');
  ctx.font = h.font(nameSize, 'bold');
  ctx.fillText(username, textX, 118);

  // Nivel y posición, colocados de derecha a izquierda para que no se solapen.
  const rightEdge = WIDTH - 55;

  /**
   * Dibuja una pareja `ETIQUETA valor` terminada en `rightX`.
   * @returns {number} Anchura total ocupada, para encadenar la siguiente.
   */
  const drawStatPair = (label, value, rightX, valueColor) => {
    ctx.textAlign = 'right';

    ctx.font = h.font(36, 'bold');
    const valueWidth = ctx.measureText(value).width;
    ctx.fillStyle = valueColor;
    ctx.fillText(value, rightX, 92);

    ctx.font = h.font(22, 'bold');
    const labelWidth = ctx.measureText(label).width;
    ctx.fillStyle = h.hexToRgba(textColor, 0.6);
    ctx.fillText(label, rightX - valueWidth - 10, 90);

    return valueWidth + labelWidth + 10;
  };

  const levelWidth = drawStatPair('NIVEL', String(level), rightEdge, accent);
  drawStatPair('RANGO', `#${formatNumber(rank)}`, rightEdge - levelWidth - 30, textColor);

  // XP actual / necesaria.
  ctx.font = h.font(22, 'normal');
  ctx.fillStyle = h.hexToRgba(textColor, 0.8);
  ctx.fillText(`${formatNumber(current)} / ${formatNumber(required)} XP`, rightEdge, 160);

  // Barra de progreso.
  const barX = textX;
  const barY = 180;
  const barWidth = WIDTH - textX - 55;
  const barHeight = 38;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  h.roundRect(ctx, barX, barY, barWidth, barHeight, barHeight / 2);
  ctx.fill();

  // Anchura mínima para que el extremo redondeado se vea aunque el progreso sea 0.
  const filled = Math.max(barHeight, (barWidth * Math.min(100, percent)) / 100);
  const gradient = ctx.createLinearGradient(barX, barY, barX + filled, barY);
  gradient.addColorStop(0, h.hexToRgba(accent, 0.75));
  gradient.addColorStop(1, accent);
  ctx.fillStyle = gradient;
  h.roundRect(ctx, barX, barY, filled, barHeight, barHeight / 2);
  ctx.fill();

  // Porcentaje sobre la barra.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = h.font(19, 'bold');
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 4;
  ctx.fillText(`${percent.toFixed(1)}%`, barX + barWidth / 2, barY + barHeight / 2 + 7);
  ctx.shadowColor = 'transparent';

  const buffer = await canvas.encode('png');
  return new AttachmentBuilder(buffer, { name: 'rango.png' });
}

module.exports = { generateRankCard, WIDTH, HEIGHT };

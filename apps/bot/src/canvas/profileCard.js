'use strict';

const { createCanvas } = require('@napi-rs/canvas');
const { AttachmentBuilder } = require('discord.js');

const h = require('./helpers');
const { formatNumber } = require('../utils/time');

const WIDTH = 900;
const HEIGHT = 400;

/**
 * Genera la tarjeta de perfil global del comando `profile`.
 *
 * @param {object} options
 * @param {string} options.username
 * @param {string} options.avatarUrl
 * @param {string} [options.title] Título personalizado del usuario.
 * @param {string} [options.bio]
 * @param {number} options.credits
 * @param {number} options.reputation
 * @param {number} options.level Nivel en el servidor actual.
 * @param {number} options.rank Posición en el servidor actual.
 * @param {Date} options.createdAt Fecha de creación de la cuenta.
 * @param {object} [options.profile] Personalización guardada del usuario.
 */
async function generateProfileCard({
  username,
  avatarUrl,
  title = '',
  bio = '',
  credits = 0,
  reputation = 0,
  level = 0,
  rank = 0,
  createdAt = new Date(),
  profile = {},
}) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  const accent = h.safeColor(profile.accentColor, '#5865F2');
  const textColor = h.safeColor(profile.textColor, '#FFFFFF');

  if (profile.background) {
    await h.drawBackground(ctx, WIDTH, HEIGHT, profile.background, accent, 0.6);
  } else {
    h.drawGradient(ctx, WIDTH, HEIGHT, '#23272A', '#15171A');
  }

  // Banda superior con el color de acento.
  ctx.fillStyle = h.hexToRgba(accent, 0.9);
  ctx.fillRect(0, 0, WIDTH, 8);

  // Avatar.
  const avatarSize = 150;
  const avatarX = 50;
  const avatarY = 55;
  const avatar = await h.loadImageSafe(avatarUrl);
  h.drawAvatar(ctx, avatar, avatarX, avatarY, avatarSize, 'rounded', accent, 5);

  ctx.textAlign = 'left';
  const textX = avatarX + avatarSize + 35;

  // Nombre.
  ctx.fillStyle = textColor;
  const nameSize = h.fitText(ctx, username, WIDTH - textX - 50, 40, 'bold');
  ctx.font = h.font(nameSize, 'bold');
  ctx.fillText(username, textX, 100);

  // Título personalizado.
  if (title) {
    ctx.fillStyle = accent;
    ctx.font = h.font(24, 'bold');
    ctx.fillText(h.ellipsize(ctx, title, WIDTH - textX - 50), textX, 138);
  }

  // Biografía en dos líneas como máximo.
  if (bio) {
    ctx.fillStyle = h.hexToRgba(textColor, 0.75);
    ctx.font = h.font(20, 'normal');
    const maxWidth = WIDTH - textX - 50;
    const words = bio.split(/\s+/);
    let line = '';
    let y = title ? 176 : 148;
    let lines = 0;

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth) {
        ctx.fillText(line, textX, y);
        lines += 1;
        y += 28;
        line = word;
        if (lines >= 2) break;
      } else {
        line = candidate;
      }
    }
    if (lines < 2 && line) ctx.fillText(h.ellipsize(ctx, line, maxWidth), textX, y);
  }

  // Tarjetas de estadísticas.
  const stats = [
    { label: 'CRÉDITOS', value: formatNumber(credits) },
    { label: 'REPUTACIÓN', value: formatNumber(reputation) },
    { label: 'NIVEL', value: String(level) },
    { label: 'RANGO', value: rank > 0 ? `#${formatNumber(rank)}` : '—' },
  ];

  const boxWidth = 185;
  const boxHeight = 90;
  const gap = 18;
  const totalWidth = stats.length * boxWidth + (stats.length - 1) * gap;
  let boxX = (WIDTH - totalWidth) / 2;
  const boxY = 240;

  for (const stat of stats) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    h.roundRect(ctx, boxX, boxY, boxWidth, boxHeight, 14);
    ctx.fill();

    ctx.strokeStyle = h.hexToRgba(accent, 0.35);
    ctx.lineWidth = 2;
    h.roundRect(ctx, boxX, boxY, boxWidth, boxHeight, 14);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = h.hexToRgba(textColor, 0.6);
    ctx.font = h.font(15, 'bold');
    ctx.fillText(stat.label, boxX + boxWidth / 2, boxY + 30);

    ctx.fillStyle = textColor;
    const valueSize = h.fitText(ctx, stat.value, boxWidth - 20, 30, 'bold');
    ctx.font = h.font(valueSize, 'bold');
    ctx.fillText(stat.value, boxX + boxWidth / 2, boxY + 68);

    boxX += boxWidth + gap;
  }

  // Fecha de creación de la cuenta.
  ctx.textAlign = 'center';
  ctx.fillStyle = h.hexToRgba(textColor, 0.5);
  ctx.font = h.font(16, 'normal');
  const joined = new Date(createdAt).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  ctx.fillText(`Cuenta creada el ${joined}`, WIDTH / 2, 370);

  const buffer = await canvas.encode('png');
  return new AttachmentBuilder(buffer, { name: 'perfil.png' });
}

module.exports = { generateProfileCard, WIDTH, HEIGHT };

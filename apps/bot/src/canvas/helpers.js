'use strict';

const { loadImage, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('node:fs');
const path = require('node:path');

const logger = require('../utils/logger');

/**
 * Utilidades comunes para las tarjetas generadas con canvas.
 */

/**
 * Registra las fuentes de `assets/fonts`.
 * @returns {string[]} Nombres de las familias registradas, en orden alfabético.
 */
function registerFonts() {
  const dir = path.join(__dirname, '..', '..', 'assets', 'fonts');
  if (!fs.existsSync(dir)) return [];

  const registered = [];
  for (const file of fs.readdirSync(dir).sort()) {
    if (!/\.(ttf|otf)$/i.test(file)) continue;
    const family = path.parse(file).name;
    try {
      GlobalFonts.registerFromPath(path.join(dir, file), family);
      registered.push(family);
      logger.debug(`Fuente registrada: ${file}`);
    } catch (err) {
      logger.warn(`No se pudo registrar la fuente ${file}: ${err.message}`);
    }
  }
  return registered;
}

const CUSTOM_FAMILIES = registerFonts();

/**
 * Familia tipográfica con alternativas.
 *
 * Solo se anteponen las fuentes que el usuario haya colocado en `assets/fonts`.
 * No se buscan familias del sistema por nombre: hacerlo puede seleccionar una
 * fuente con serifa que solo coincide por casualidad.
 */
const FONT_STACK = [...CUSTOM_FAMILIES, 'Segoe UI', 'Arial', 'DejaVu Sans', 'sans-serif']
  .map((f) => (f.includes(' ') ? `"${f}"` : f))
  .join(', ');

/** Construye una cadena de fuente para el contexto 2D. */
function font(size, weight = 'normal') {
  return `${weight} ${size}px ${FONT_STACK}`;
}

/**
 * Carga una imagen desde una URL o ruta, devolviendo `null` si falla.
 * Nunca lanza: una tarjeta debe generarse aunque el fondo no cargue.
 */
async function loadImageSafe(source) {
  if (!source) return null;
  try {
    return await loadImage(source);
  } catch (err) {
    logger.debug(`No se pudo cargar la imagen "${String(source).slice(0, 80)}": ${err.message}`);
    return null;
  }
}

/** Dibuja un rectángulo con esquinas redondeadas en el trazado actual. */
function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Dibuja el avatar recortado con la forma indicada y un borde de color.
 * @param {'circle'|'square'|'rounded'} shape
 */
function drawAvatar(ctx, image, x, y, size, shape = 'circle', borderColor = null, borderWidth = 6) {
  ctx.save();

  if (shape === 'circle') {
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
  } else if (shape === 'rounded') {
    roundRect(ctx, x, y, size, size, size * 0.2);
  } else {
    ctx.beginPath();
    ctx.rect(x, y, size, size);
  }

  ctx.clip();
  if (image) {
    ctx.drawImage(image, x, y, size, size);
  } else {
    // Marcador de posición si el avatar no cargó.
    ctx.fillStyle = '#4E5058';
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();

  if (borderColor) {
    ctx.save();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2 - borderWidth / 2, 0, Math.PI * 2);
      ctx.stroke();
    } else if (shape === 'rounded') {
      roundRect(ctx, x + borderWidth / 2, y + borderWidth / 2, size - borderWidth, size - borderWidth, size * 0.2);
      ctx.stroke();
    } else {
      ctx.strokeRect(x + borderWidth / 2, y + borderWidth / 2, size - borderWidth, size - borderWidth);
    }
    ctx.restore();
  }
}

/**
 * Reduce el tamaño de fuente hasta que el texto quepa en `maxWidth`.
 * @returns {number} El tamaño finalmente usado.
 */
function fitText(ctx, text, maxWidth, startSize, weight = 'bold', minSize = 10) {
  let size = startSize;
  ctx.font = font(size, weight);
  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size -= 2;
    ctx.font = font(size, weight);
  }
  return size;
}

/** Recorta un texto añadiendo puntos suspensivos si no cabe. */
function ellipsize(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

/** Convierte `#RRGGBB` a `rgba(r, g, b, alpha)`. */
function hexToRgba(hex, alpha = 1) {
  const cleaned = String(hex || '').trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return `rgba(0, 0, 0, ${alpha})`;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Devuelve el color si es un hex válido, o el color por defecto. */
function safeColor(hex, fallback = '#FFFFFF') {
  const cleaned = String(hex || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(cleaned) ? cleaned : fallback;
}

/** Rellena el lienzo con un degradado diagonal. */
function drawGradient(ctx, width, height, from, to) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, from);
  gradient.addColorStop(1, to);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/** Dibuja el fondo: imagen si existe, degradado si no, más una capa oscura. */
async function drawBackground(ctx, width, height, backgroundUrl, accentColor, overlayOpacity = 0.45) {
  const image = await loadImageSafe(backgroundUrl);

  if (image) {
    // Escala la imagen para cubrir el lienzo sin deformarla.
    const scale = Math.max(width / image.width, height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  } else {
    drawGradient(ctx, width, height, '#1E1F22', hexToRgba(accentColor, 0.55));
  }

  if (overlayOpacity > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, Math.max(0, overlayOpacity))})`;
    ctx.fillRect(0, 0, width, height);
  }
}

module.exports = {
  FONT_STACK,
  font,
  loadImageSafe,
  roundRect,
  drawAvatar,
  fitText,
  ellipsize,
  hexToRgba,
  safeColor,
  drawGradient,
  drawBackground,
};

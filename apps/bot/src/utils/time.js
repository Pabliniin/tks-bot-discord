'use strict';

/** Utilidades para leer y mostrar duraciones. */

const UNITS = {
  s: 1000,
  seg: 1000,
  segundo: 1000,
  segundos: 1000,
  m: 60_000,
  min: 60_000,
  minuto: 60_000,
  minutos: 60_000,
  h: 3_600_000,
  hora: 3_600_000,
  horas: 3_600_000,
  d: 86_400_000,
  dia: 86_400_000,
  dias: 86_400_000,
  day: 86_400_000,
  days: 86_400_000,
  w: 604_800_000,
  sem: 604_800_000,
  semana: 604_800_000,
  semanas: 604_800_000,
};

/**
 * Convierte una duración escrita a milisegundos.
 * Acepta formatos combinados: `1d`, `30m`, `2h30m`, `1d 12h`.
 *
 * @param {string|number} input
 * @returns {number|null} Milisegundos, o `null` si no se reconoce.
 */
function parseDuration(input) {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return input > 0 ? input : null;
  }
  if (typeof input !== 'string') return null;

  const normalized = input
    .toLowerCase()
    .normalize('NFD')
    // Quita tildes para aceptar "día" igual que "dia".
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');

  if (normalized.length === 0) return null;

  // Un número suelto se interpreta como minutos.
  if (/^\d+$/.test(normalized)) {
    const minutes = parseInt(normalized, 10);
    return minutes > 0 ? minutes * 60_000 : null;
  }

  const matches = normalized.match(/(\d+)([a-z]+)/g);
  if (!matches) return null;

  let total = 0;
  for (const part of matches) {
    const [, amount, unit] = part.match(/(\d+)([a-z]+)/);
    const multiplier = UNITS[unit];
    if (!multiplier) return null;
    total += parseInt(amount, 10) * multiplier;
  }

  return total > 0 ? total : null;
}

/**
 * Formatea milisegundos en texto legible en español.
 * @param {number} ms
 * @param {{ short?: boolean }} [options]
 */
function formatDuration(ms, options = {}) {
  const value = Math.max(0, Math.floor(Number(ms) || 0));
  if (value < 1000) return options.short ? '0s' : '0 segundos';

  const days = Math.floor(value / 86_400_000);
  const hours = Math.floor((value % 86_400_000) / 3_600_000);
  const minutes = Math.floor((value % 3_600_000) / 60_000);
  const seconds = Math.floor((value % 60_000) / 1000);

  const parts = [];
  if (options.short) {
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    if (seconds) parts.push(`${seconds}s`);
    return parts.join(' ');
  }

  if (days) parts.push(`${days} ${days === 1 ? 'día' : 'días'}`);
  if (hours) parts.push(`${hours} ${hours === 1 ? 'hora' : 'horas'}`);
  if (minutes) parts.push(`${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`);
  if (seconds) parts.push(`${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}`);

  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
}

/** Marca de tiempo dinámica de Discord: `<t:1700000000:R>`. */
function discordTimestamp(date, style = 'f') {
  const ms = date instanceof Date ? date.getTime() : Number(date);
  if (!Number.isFinite(ms)) return 'Desconocido';
  return `<t:${Math.floor(ms / 1000)}:${style}>`;
}

/** Formatea un número con separadores de miles en español. */
function formatNumber(value) {
  return new Intl.NumberFormat('es-ES').format(Number(value) || 0);
}

module.exports = { parseDuration, formatDuration, discordTimestamp, formatNumber, UNITS };

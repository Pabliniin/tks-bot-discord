'use strict';

/** Registro por consola con colores ANSI y marca de tiempo. */

const COLORS = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function timestamp() {
  return new Date().toLocaleTimeString('es-ES', { hour12: false });
}

function format(color, label, args) {
  return [`${COLORS.gray}[${timestamp()}]${COLORS.reset}`, `${color}${label}${COLORS.reset}`, ...args];
}

const logger = {
  info: (...args) => console.log(...format(COLORS.cyan, 'INFO ', args)),
  ready: (...args) => console.log(...format(COLORS.green, 'READY', args)),
  warn: (...args) => console.warn(...format(COLORS.yellow, 'WARN ', args)),
  error: (...args) => console.error(...format(COLORS.red, 'ERROR', args)),
  debug: (...args) => {
    if (process.env.DEBUG === 'true') console.log(...format(COLORS.magenta, 'DEBUG', args));
  },
  module: (name, ...args) => console.log(...format(COLORS.blue, name.toUpperCase().padEnd(5), args)),
};

module.exports = logger;

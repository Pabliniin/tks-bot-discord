#!/usr/bin/env node
'use strict';

/**
 * Copia el `.env` de la raíz a `apps/web/.env`.
 *
 * Next.js solo lee el `.env` de su propia carpeta, así que sin esta copia el
 * panel arrancaría sin las claves de Discord ni la de sesión. Se ejecuta solo
 * antes de `dev` y de `build`, de modo que nunca haya que acordarse de hacerlo
 * a mano al desplegar.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

/**
 * Sincroniza el archivo.
 * @returns {'sin-origen'|'sin-cambios'|'copiado'}
 */
function syncEnv() {
  const source = path.join(ROOT, '.env');
  const target = path.join(ROOT, 'apps', 'web', '.env');

  if (!fs.existsSync(source)) {
    return 'sin-origen';
  }

  const header =
    '# Generado automáticamente por scripts/sync-env.js a partir del .env de la raíz.\n' +
    '# No lo edites aquí: edita el .env de la raíz y vuelve a ejecutar dev o build.\n\n';

  const contents = header + fs.readFileSync(source, 'utf8');

  // Solo se escribe si cambió, para no invalidar la caché de Next sin motivo.
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
  if (current === contents) return 'sin-cambios';

  fs.writeFileSync(target, contents, 'utf8');
  return 'copiado';
}

// Solo actúa al ejecutarlo directamente. Importarlo no debe tener efectos:
// la comprobación estática del proyecto carga todos los scripts con `require`.
if (require.main === module) {
  const result = syncEnv();

  if (result === 'sin-origen') {
    console.warn('AVISO  No existe .env en la raíz. Copia .env.example a .env y rellénalo.');
    // No se corta la ejecución: las variables pueden venir del entorno del sistema.
  } else if (result === 'copiado') {
    console.log('Variables de entorno sincronizadas -> apps/web/.env');
  }
}

module.exports = syncEnv;

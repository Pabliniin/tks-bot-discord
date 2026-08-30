#!/usr/bin/env node
'use strict';

/**
 * Prepara los archivos .bat para que Windows los ejecute bien.
 *
 * `cmd.exe` es muy quisquilloso:
 *   · Necesita finales de línea CRLF. Con LF (estilo Linux) la ventana se
 *     abre y se cierra al instante, sin decir nada.
 *   · Los caracteres no ASCII pueden mostrarse mal o romper el análisis del
 *     archivo, según la página de códigos activa.
 *
 * Este script convierte los .bat a CRLF y sustituye los caracteres decorativos
 * por equivalentes ASCII. Se ejecuta solo dentro de `npm run lint`, así que
 * los .bat quedan siempre en buen estado.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

/** Sustituciones de caracteres no ASCII por su equivalente seguro. */
const REEMPLAZOS = [
  [/─|━|┄|┅/g, '-'], // guiones de dibujo de cajas
  [/│|┃/g, '|'],
  [/[┌-╋]/g, '+'], // esquinas y cruces
  [/á/g, 'a'], [/é/g, 'e'], [/í/g, 'i'],
  [/ó/g, 'o'], [/ú/g, 'u'], [/ñ/g, 'n'],
  [/Á/g, 'A'], [/É/g, 'E'], [/Í/g, 'I'],
  [/Ó/g, 'O'], [/Ú/g, 'U'], [/Ñ/g, 'N'],
  [/ü/g, 'u'], [/Ü/g, 'U'],
  [/¿/g, '?'], [/¡/g, '!'],
  [/→/g, '->'], [/←/g, '<-'],
  [/‘|’/g, "'"], [/“|”/g, '"'],
  [/…/g, '...'], [/«/g, '"'], [/»/g, '"'],
];

/**
 * Arregla un archivo .bat.
 * @returns {{ cambiado: boolean, crlf: boolean, ascii: number }}
 */
function fixBatFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');

  // 1. Quitar el BOM: cmd.exe no lo entiende y falla en la primera línea.
  let texto = original.replace(/^﻿/, '');

  // 2. Sustituir los caracteres problemáticos.
  let sustituidos = 0;
  for (const [patron, reemplazo] of REEMPLAZOS) {
    const antes = texto;
    texto = texto.replace(patron, reemplazo);
    if (antes !== texto) sustituidos += 1;
  }

  // 3. Normalizar a CRLF (primero todo a LF, para no duplicar los \r).
  texto = texto.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');

  const restantesNoAscii = (texto.match(/[^\x00-\x7F]/g) || []).length;

  if (texto !== original) {
    fs.writeFileSync(filePath, texto, 'latin1');
  }

  return {
    cambiado: texto !== original,
    crlf: !/[^\r]\n/.test(texto),
    ascii: restantesNoAscii,
  };
}

function main() {
  const archivos = fs
    .readdirSync(ROOT)
    .filter((f) => f.toLowerCase().endsWith('.bat'))
    .map((f) => path.join(ROOT, f));

  if (archivos.length === 0) {
    console.log('No hay archivos .bat que revisar.');
    return;
  }

  for (const archivo of archivos) {
    const r = fixBatFile(archivo);
    const nombre = path.basename(archivo).padEnd(24);
    const estado = r.cambiado ? 'corregido' : 'ya estaba bien';
    const aviso = r.ascii > 0 ? `  (quedan ${r.ascii} caracteres no ASCII)` : '';
    console.log(`  ${nombre} ${estado}${aviso}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = fixBatFile;

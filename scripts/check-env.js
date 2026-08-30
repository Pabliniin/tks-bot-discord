#!/usr/bin/env node
'use strict';

/**
 * Comprueba que el `.env` está completo antes de arrancar.
 *
 * Detecta los valores de ejemplo que vienen en `.env.example` y avisa de cuáles
 * faltan por rellenar, en lugar de dejar que el bot falle más adelante con un
 * error críptico.
 *
 *   node scripts/check-env.js            solo comprueba el archivo
 *   node scripts/check-env.js --db       además intenta conectar con MongoDB
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const EXAMPLE_PATH = path.join(ROOT, '.env.example');

/** Valores de ejemplo que significan «sin rellenar». */
const PLACEHOLDERS = new Set([
  'tu_token_del_bot',
  'id_de_la_aplicacion',
  'secreto_de_la_aplicacion',
  'cambia_esto_por_una_cadena_aleatoria_larga',
  'cambia_esto_por_otra_cadena_aleatoria_larga',
  'tu_token_real',
  'tu_client_id',
  'tu_client_secret',
]);

/** Campos imprescindibles, con la explicación de dónde se consigue cada uno. */
const REQUIRED = [
  {
    key: 'DISCORD_TOKEN',
    donde: 'Portal de Discord -> tu aplicación -> Bot -> Reset Token',
  },
  {
    key: 'DISCORD_CLIENT_ID',
    donde: 'Portal de Discord -> tu aplicación -> OAuth2 -> Client ID',
  },
  {
    key: 'DISCORD_CLIENT_SECRET',
    donde: 'Portal de Discord -> tu aplicación -> OAuth2 -> Client Secret',
  },
  {
    key: 'MONGODB_URI',
    donde: 'mongodb://127.0.0.1:27017/tkbot si es local, o la cadena de MongoDB Atlas',
  },
  {
    key: 'BOT_API_SECRET',
    donde: 'Genérala con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    minLength: 24,
  },
  {
    key: 'SESSION_SECRET',
    donde: 'Genérala con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    minLength: 24,
  },
  {
    key: 'DISCORD_REDIRECT_URI',
    donde: 'Debe coincidir EXACTAMENTE con la de Discord -> OAuth2 -> Redirects',
  },
];

/** Campos que no impiden arrancar pero conviene rellenar. */
const RECOMMENDED = [
  {
    key: 'DISCORD_DEV_GUILD_ID',
    donde: 'ID de tu servidor de pruebas. Sin él solo podrás registrar comandos globales.',
  },
  {
    key: 'BOT_OWNERS',
    donde: 'Tu ID de usuario de Discord, para los comandos de desarrollador.',
  },
];

/** Lee el `.env` como pares clave/valor, sin depender de dotenv. */
function parseEnvFile(filePath) {
  const values = {};
  if (!fs.existsSync(filePath)) return values;

  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    // Se quitan las comillas si el valor viene entrecomillado.
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^["'](.*)["']$/, '$1');

    values[key] = value;
  }
  return values;
}

/** `true` si el valor sigue siendo el de ejemplo o está vacío. */
function isUnset(value, minLength = 0) {
  if (!value) return true;
  if (PLACEHOLDERS.has(value)) return true;
  if (value.length < minLength) return true;
  return false;
}

/** Comprueba que se puede conectar con MongoDB. */
async function checkDatabase(uri) {
  const { connect, disconnect } = require('@tkbot/shared');
  try {
    await connect(uri);
    await disconnect();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function main() {
  console.log('Comprobando la configuración...\n');

  // ── El archivo existe ───────────────────────────────────────
  if (!fs.existsSync(ENV_PATH)) {
    if (fs.existsSync(EXAMPLE_PATH)) {
      fs.copyFileSync(EXAMPLE_PATH, ENV_PATH);
      console.log('Se ha creado el archivo .env a partir de .env.example.\n');
    } else {
      console.error('ERROR  No existe .env ni .env.example en la carpeta del proyecto.');
      process.exitCode = 1;
      return;
    }
  }

  const env = parseEnvFile(ENV_PATH);

  // ── Campos obligatorios ─────────────────────────────────────
  const missing = REQUIRED.filter((field) => isUnset(env[field.key], field.minLength));
  const pending = RECOMMENDED.filter((field) => isUnset(env[field.key]));

  if (missing.length > 0) {
    console.error('Faltan por rellenar estos campos en el archivo .env:\n');
    for (const field of missing) {
      console.error(`  ${field.key}`);
      console.error(`      ${field.donde}\n`);
    }
    console.error('Abre el archivo .env con el Bloc de notas, rellénalos y vuelve a intentarlo.');
    console.error('El portal de Discord está en: https://discord.com/developers/applications');
    process.exitCode = 1;
    return;
  }

  console.log('Los campos obligatorios están rellenos.');

  if (pending.length > 0) {
    console.log('\nOpcionales sin rellenar (el bot funciona igualmente):');
    for (const field of pending) {
      console.log(`  ${field.key} — ${field.donde}`);
    }
  }

  // ── Coherencia entre la web y Discord ───────────────────────
  const site = env.NEXT_PUBLIC_SITE_URL || '';
  const redirect = env.DISCORD_REDIRECT_URI || '';

  if (site && redirect && !redirect.startsWith(site)) {
    console.log('\nAVISO  DISCORD_REDIRECT_URI no empieza por NEXT_PUBLIC_SITE_URL.');
    console.log(`       Sitio:    ${site}`);
    console.log(`       Callback: ${redirect}`);
    console.log('       Deberían ser el mismo dominio, o el inicio de sesión fallará.');
  }

  if (redirect && !redirect.endsWith('/api/auth/callback')) {
    console.log('\nAVISO  DISCORD_REDIRECT_URI debería terminar en /api/auth/callback');
  }

  if (site.startsWith('https://') && !redirect.startsWith('https://')) {
    console.log('\nAVISO  El sitio usa HTTPS pero el callback no. Deben coincidir.');
  }

  // ── Conexión con la base de datos ───────────────────────────
  if (process.argv.includes('--db')) {
    console.log('\nProbando la conexión con MongoDB...');
    const result = await checkDatabase(env.MONGODB_URI);

    if (result.ok) {
      console.log('MongoDB responde correctamente.');
    } else {
      console.error('\nERROR  No se ha podido conectar con MongoDB.');
      console.error(`       ${result.error}`);
      console.error('\n       Si usas MongoDB en tu PC, comprueba que el servicio esté iniciado.');
      console.error('       Si usas MongoDB Atlas, revisa la cadena de MONGODB_URI y que tu IP');
      console.error('       esté permitida en Network Access.');
      process.exitCode = 1;
      return;
    }
  }

  console.log('\nTodo listo.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('ERROR inesperado al comprobar la configuración:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { parseEnvFile, isUnset, REQUIRED, RECOMMENDED };

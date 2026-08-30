#!/usr/bin/env node
'use strict';

/**
 * Registra los comandos de barra en Discord.
 *
 *   npm run deploy          → los registra en el servidor de pruebas (instantáneo)
 *   npm run deploy:global   → los registra globalmente (tarda hasta 1 hora)
 *   npm run deploy -- --clear  → borra todos los comandos registrados
 *
 * El servidor de pruebas se toma de DISCORD_DEV_GUILD_ID.
 */

const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const { REST, Routes } = require('discord.js');
const TKClient = require('../src/structures/TKClient');
const logger = require('../src/utils/logger');

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const devGuildId = process.env.DISCORD_DEV_GUILD_ID;

  if (!token || !clientId) {
    logger.error('Faltan DISCORD_TOKEN o DISCORD_CLIENT_ID en el .env');
    process.exit(1);
  }

  const isGlobal = process.argv.includes('--global');
  const isClear = process.argv.includes('--clear');

  if (!isGlobal && !devGuildId) {
    logger.error(
      'Falta DISCORD_DEV_GUILD_ID. Añádelo al .env o usa "npm run deploy:global" para registrar globalmente.'
    );
    process.exit(1);
  }

  // Se carga el cliente solo para leer los comandos, sin conectar con Discord.
  const client = new TKClient();
  client.loadCommands();

  const body = isClear ? [] : client.slashCommandData();
  const route = isGlobal
    ? Routes.applicationCommands(clientId)
    : Routes.applicationGuildCommands(clientId, devGuildId);

  const scope = isGlobal ? 'globalmente' : `en el servidor ${devGuildId}`;
  logger.info(
    isClear ? `Borrando todos los comandos ${scope}...` : `Registrando ${body.length} comandos ${scope}...`
  );

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    const result = await rest.put(route, { body });
    logger.ready(
      isClear
        ? `Comandos borrados ${scope}.`
        : `${result.length} comandos registrados ${scope}.`
    );

    if (!isClear && !isGlobal) {
      logger.info('Los comandos de servidor aparecen al instante. Recarga Discord si no los ves.');
    }
    if (!isClear && isGlobal) {
      logger.info('Los comandos globales pueden tardar hasta 1 hora en propagarse.');
    }
  } catch (err) {
    logger.error('Fallo al registrar los comandos:', err.message);

    // Los errores de validación de Discord traen el detalle en `rawError`.
    if (err.rawError?.errors) {
      console.error(JSON.stringify(err.rawError.errors, null, 2));
    }
    process.exit(1);
  }
}

// Solo se ejecuta al lanzarlo directamente, no al importarlo desde otro script
// (por ejemplo, desde la comprobación estática del proyecto).
if (require.main === module) {
  main();
}

module.exports = main;

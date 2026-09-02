'use strict';

const { ChannelType, PermissionsBitField } = require('discord.js');

const logger = require('../utils/logger');

/**
 * Contadores de servidor.
 *
 * Canales de voz cuyo nombre se actualiza solo: «👥 Miembros: 1.234». Se ven
 * en la lista de canales sin entrar en ninguno, y llaman la atención de quien
 * visita el servidor, así que hacen algo de publicidad por su cuenta.
 *
 * Se usan canales de voz y no de texto a propósito: en un canal de voz nadie
 * puede escribir, así que el nombre es lo único que hay, y quedan arriba del
 * todo si se ponen en su propia categoría.
 *
 * **Discord solo permite renombrar un canal dos veces cada diez minutos.** Si
 * se supera, la petición se queda esperando y bloquea la cola del bot. Por eso
 * la actualización va cada quince minutos y nunca a demanda.
 */

/** Cada cuánto se refrescan los contadores. */
const INTERVALO = 15 * 60_000;

/** Tipos de contador y cómo se calcula cada uno. */
const TIPOS = {
  miembros: {
    nombre: 'Miembros',
    plantillaPorDefecto: '👥 Miembros: {valor}',
    calcular: (guild) => guild.memberCount,
  },
  humanos: {
    nombre: 'Personas (sin bots)',
    plantillaPorDefecto: '🧑 Personas: {valor}',
    calcular: (guild) => guild.members.cache.filter((m) => !m.user.bot).size || guild.memberCount,
  },
  bots: {
    nombre: 'Bots',
    plantillaPorDefecto: '🤖 Bots: {valor}',
    calcular: (guild) => guild.members.cache.filter((m) => m.user.bot).size,
  },
  enLinea: {
    nombre: 'En línea',
    plantillaPorDefecto: '🟢 En línea: {valor}',
    calcular: (guild) =>
      guild.members.cache.filter((m) => m.presence && m.presence.status !== 'offline').size,
  },
  canales: {
    nombre: 'Canales',
    plantillaPorDefecto: '💬 Canales: {valor}',
    calcular: (guild) =>
      guild.channels.cache.filter((c) => c.type !== ChannelType.GuildCategory).size,
  },
  roles: {
    nombre: 'Roles',
    plantillaPorDefecto: '🎭 Roles: {valor}',
    calcular: (guild) => guild.roles.cache.size - 1, // Sin contar @everyone.
  },
  boosts: {
    nombre: 'Mejoras',
    plantillaPorDefecto: '💎 Mejoras: {valor}',
    calcular: (guild) => guild.premiumSubscriptionCount || 0,
  },
};

/**
 * Nombre que debería tener un canal contador.
 *
 * @param {import('discord.js').Guild} guild
 * @param {{ type: string, template?: string }} contador
 * @returns {string|null} `null` si el tipo no existe.
 */
function nombreDe(guild, contador) {
  const tipo = TIPOS[contador.type];
  if (!tipo) return null;

  const valor = tipo.calcular(guild);
  const plantilla = contador.template || tipo.plantillaPorDefecto;

  // Los separadores de millar hacen que «1.234» se lea de un vistazo.
  const formateado = new Intl.NumberFormat('es-ES').format(valor);

  // Discord corta los nombres de canal a 100 caracteres.
  return plantilla.replace(/\{valor\}/gi, formateado).slice(0, 100);
}

/**
 * Actualiza los contadores de un servidor.
 *
 * @returns {Promise<{ actualizados: number, saltados: number }>}
 */
async function actualizarServidor(guild, settings) {
  const config = settings?.counters;
  if (!config?.enabled) return { actualizados: 0, saltados: 0 };

  const lista = config.channels || [];
  if (lista.length === 0) return { actualizados: 0, saltados: 0 };

  let actualizados = 0;
  let saltados = 0;

  for (const contador of lista) {
    const canal = guild.channels.cache.get(contador.channelId);
    if (!canal) {
      saltados += 1;
      continue;
    }

    const permisos = canal.permissionsFor(guild.members.me);
    if (!permisos?.has(PermissionsBitField.Flags.ManageChannels)) {
      saltados += 1;
      continue;
    }

    const nombre = nombreDe(guild, contador);
    if (!nombre) {
      saltados += 1;
      continue;
    }

    /*
     * Si el nombre no ha cambiado no se toca. Es lo que evita gastar el cupo
     * de renombrados de Discord en un servidor donde nadie entra ni sale.
     */
    if (canal.name === nombre) {
      saltados += 1;
      continue;
    }

    try {
      await canal.setName(nombre, 'Contador de servidor');
      actualizados += 1;
    } catch (err) {
      logger.debug(`No se pudo actualizar el contador ${canal.id}: ${err.message}`);
      saltados += 1;
    }
  }

  return { actualizados, saltados };
}

/** Recorre todos los servidores y actualiza sus contadores. */
async function actualizarTodos(client) {
  for (const guild of client.guilds.cache.values()) {
    let settings;
    try {
      settings = await client.settings.get(guild.id);
    } catch {
      continue;
    }

    if (!settings.counters?.enabled) continue;

    await actualizarServidor(guild, settings).catch((err) => {
      logger.debug(`Contadores de ${guild.id}: ${err.message}`);
    });
  }
}

module.exports = {
  name: 'counters',
  TIPOS,
  nombreDe,
  actualizarServidor,
  actualizarTodos,

  init(client) {
    const timer = setInterval(() => {
      actualizarTodos(client).catch((err) => {
        logger.debug(`No se pudieron actualizar los contadores: ${err.message}`);
      });
    }, INTERVALO);

    timer.unref?.();
  },
};

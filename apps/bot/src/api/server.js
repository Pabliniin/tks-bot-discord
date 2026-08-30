'use strict';

const express = require('express');
const { ChannelType } = require('discord.js');

const logger = require('../utils/logger');
const embeds = require('../utils/embeds');

/**
 * API interna del bot.
 *
 * El panel web la usa para leer datos en vivo del servidor (canales, roles,
 * emojis), para invalidar la caché al guardar y para publicar mensajes.
 * Solo escucha en localhost y exige una clave compartida.
 */

/** Comprueba la clave compartida en todas las rutas `/api`. */
function auth(req, res, next) {
  const secret = process.env.BOT_API_SECRET;

  if (!secret) {
    return res.status(500).json({ error: 'BOT_API_SECRET no está configurado en el bot.' });
  }
  if (req.get('x-api-key') !== secret) {
    return res.status(401).json({ error: 'Clave de API no válida.' });
  }
  return next();
}

/** Serializa un canal para el panel. */
function serializeChannel(channel) {
  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    parentId: channel.parentId,
    position: channel.rawPosition,
  };
}

/** Serializa un rol para el panel. */
function serializeRole(role) {
  return {
    id: role.id,
    name: role.name,
    color: role.hexColor,
    position: role.position,
    managed: role.managed,
    // El panel oculta los roles que el bot no puede asignar.
    assignable: !role.managed && role.id !== role.guild.id,
  };
}

/**
 * Arranca la API interna.
 * @param {import('../structures/TKClient')} client
 */
function startApi(client) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  // Detrás de un proxy inverso esto permite leer la IP real.
  app.set('trust proxy', 1);

  // ── Estado público (sin clave) ───────────────────────────────
  app.get('/health', (req, res) => {
    res.json({
      ok: true,
      ready: client.isReady(),
      uptime: Math.floor((Date.now() - client.startedAt) / 1000),
    });
  });

  app.use('/api', auth);

  // ── Estadísticas globales ────────────────────────────────────
  app.get('/api/stats', (req, res) => {
    const guilds = client.guilds.cache;
    res.json({
      guilds: guilds.size,
      users: guilds.reduce((acc, g) => acc + (g.memberCount || 0), 0),
      channels: client.channels.cache.size,
      commands: client.commands.size,
      ping: Math.max(0, Math.round(client.ws.ping)),
      uptime: Math.floor((Date.now() - client.startedAt) / 1000),
      cachedSettings: client.settings.size(),
    });
  });

  // ── Lista de comandos, para la web pública ───────────────────
  app.get('/api/commands', (req, res) => {
    res.json(
      client.commands.filter((command) => !command.hidden).map((command) => ({
        name: command.name,
        category: command.category,
        description: command.description || '',
        usage: command.usage || '',
        aliases: command.aliases || [],
        premium: Boolean(command.premium),
      }))
    );
  });

  // ── IDs de los servidores donde está el bot ──────────────────
  // El panel lo usa para saber en qué servidores mostrar "Configurar"
  // en vez de "Invitar", con una sola petición.
  app.get('/api/guilds', (req, res) => {
    res.json({ ids: [...client.guilds.cache.keys()] });
  });

  // ── Datos de un servidor ─────────────────────────────────────
  app.get('/api/guilds/:guildId', async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ error: 'El bot no está en ese servidor.' });

    // La caché de miembros puede estar vacía; se pide el conteo aproximado.
    res.json({
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL({ size: 256 }),
      memberCount: guild.memberCount,
      ownerId: guild.ownerId,
      channels: guild.channels.cache
        .filter((c) =>
          [
            ChannelType.GuildText,
            ChannelType.GuildVoice,
            ChannelType.GuildCategory,
            ChannelType.GuildAnnouncement,
            ChannelType.GuildForum,
            ChannelType.GuildStageVoice,
          ].includes(c.type)
        )
        .map(serializeChannel)
        .sort((a, b) => a.position - b.position),
      roles: guild.roles.cache
        .filter((r) => r.id !== guild.id)
        .map(serializeRole)
        .sort((a, b) => b.position - a.position),
      emojis: guild.emojis.cache.map((e) => ({
        id: e.id,
        name: e.name,
        animated: e.animated,
        url: e.imageURL(),
      })),
      botRolePosition: guild.members.me?.roles.highest.position ?? 0,
    });
  });

  // ── Invalidar la caché tras guardar en el panel ──────────────
  app.post('/api/guilds/:guildId/invalidate', (req, res) => {
    client.settings.invalidate(req.params.guildId);
    res.json({ ok: true });
  });

  // ── Publicar un embed guardado ───────────────────────────────
  app.post('/api/guilds/:guildId/embeds/:embedId/publish', async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ error: 'El bot no está en ese servidor.' });

    // Se relee la configuración para usar lo último que guardó el panel.
    client.settings.invalidate(guild.id);
    const settings = await client.settings.get(guild.id);

    const entry = (settings.embeds || []).find((e) => e.id === req.params.embedId);
    if (!entry) return res.status(404).json({ error: 'Ese embed no existe.' });
    if (!entry.channelId) return res.status(400).json({ error: 'El embed no tiene canal asignado.' });

    const channel = guild.channels.cache.get(entry.channelId);
    if (!channel?.isTextBased()) {
      return res.status(400).json({ error: 'El canal configurado ya no existe.' });
    }

    const embed = embeds.buildFromDesign(entry.embed, {
      server: guild.name,
      memberCount: guild.memberCount,
    });

    const payload = {};
    if (entry.content) payload.content = entry.content;
    if (embed) payload.embeds = [embed];

    if (!payload.content && !payload.embeds) {
      return res.status(400).json({ error: 'El embed está vacío.' });
    }

    try {
      // Si ya se publicó antes, se edita en lugar de duplicar.
      if (entry.messageId) {
        const existing = await channel.messages.fetch(entry.messageId).catch(() => null);
        if (existing) {
          await existing.edit(payload);
          return res.json({ ok: true, messageId: existing.id, updated: true });
        }
      }

      const sent = await channel.send(payload);
      entry.messageId = sent.id;
      await settings.save();

      return res.json({ ok: true, messageId: sent.id, updated: false });
    } catch (err) {
      logger.error('No se pudo publicar el embed:', err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Publicar un panel de roles autoasignables ────────────────
  app.post('/api/guilds/:guildId/selfroles/:panelId/publish', async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ error: 'El bot no está en ese servidor.' });

    client.settings.invalidate(guild.id);
    const settings = await client.settings.get(guild.id);

    const panel = (settings.selfroles?.panels || []).find((p) => p.id === req.params.panelId);
    if (!panel) return res.status(404).json({ error: 'Ese panel no existe.' });
    if (!panel.channelId) return res.status(400).json({ error: 'El panel no tiene canal asignado.' });

    const channel = guild.channels.cache.get(panel.channelId);
    if (!channel?.isTextBased()) {
      return res.status(400).json({ error: 'El canal configurado ya no existe.' });
    }

    const selfroles = client.modules.get('selfroles');
    const embed = embeds.buildFromDesign(panel.embed, { server: guild.name });

    const payload = { components: selfroles ? selfroles.buildComponents(panel) : [] };
    if (panel.content) payload.content = panel.content;
    if (embed) payload.embeds = [embed];

    if (!payload.content && !payload.embeds) {
      payload.content = panel.name || 'Elige tus roles';
    }

    try {
      let message;
      if (panel.messageId) {
        message = await channel.messages.fetch(panel.messageId).catch(() => null);
      }

      if (message) {
        await message.edit(payload);
      } else {
        message = await channel.send(payload);
        panel.messageId = message.id;
        await settings.save();
      }

      // Los paneles por reacción necesitan que el bot ponga los emojis.
      if (panel.type === 'reaction') {
        for (const option of panel.options || []) {
          if (option.emoji) await message.react(option.emoji).catch(() => {});
        }
      }

      return res.json({ ok: true, messageId: message.id });
    } catch (err) {
      logger.error('No se pudo publicar el panel de roles:', err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Publicar un panel de tickets ─────────────────────────────
  app.post('/api/guilds/:guildId/tickets/:panelId/publish', async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ error: 'El bot no está en ese servidor.' });

    client.settings.invalidate(guild.id);
    const settings = await client.settings.get(guild.id);

    const panel = (settings.tickets?.panels || []).find((p) => p.id === req.params.panelId);
    if (!panel) return res.status(404).json({ error: 'Ese panel no existe.' });
    if (!panel.channelId) return res.status(400).json({ error: 'El panel no tiene canal asignado.' });

    const channel = guild.channels.cache.get(panel.channelId);
    if (!channel?.isTextBased()) {
      return res.status(400).json({ error: 'El canal configurado ya no existe.' });
    }

    const { ActionRowBuilder, ButtonBuilder } = require('discord.js');

    const button = new ButtonBuilder()
      .setCustomId(`ticket:open:${panel.id}`)
      .setLabel((panel.buttonLabel || 'Abrir ticket').slice(0, 80))
      .setStyle(panel.buttonStyle || 1);

    if (panel.buttonEmoji) {
      try {
        button.setEmoji(panel.buttonEmoji);
      } catch {
        // Emoji inválido: el botón se queda sin él.
      }
    }

    const embed = embeds.buildFromDesign(panel.embed, { server: guild.name });
    const payload = { components: [new ActionRowBuilder().addComponents(button)] };
    if (embed) payload.embeds = [embed];
    else payload.content = panel.name || 'Pulsa el botón para abrir un ticket.';

    try {
      let message;
      if (panel.messageId) {
        message = await channel.messages.fetch(panel.messageId).catch(() => null);
      }

      if (message) {
        await message.edit(payload);
      } else {
        message = await channel.send(payload);
        panel.messageId = message.id;
        await settings.save();
      }

      return res.json({ ok: true, messageId: message.id });
    } catch (err) {
      logger.error('No se pudo publicar el panel de tickets:', err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Previsualizar el mensaje de bienvenida ───────────────────
  app.post('/api/guilds/:guildId/welcome/test', async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ error: 'El bot no está en ese servidor.' });

    const userId = req.body?.userId;
    if (!userId) return res.status(400).json({ error: 'Falta userId.' });

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return res.status(404).json({ error: 'Ese usuario no está en el servidor.' });

    client.settings.invalidate(guild.id);
    const settings = await client.settings.get(guild.id);

    const welcome = client.modules.get('welcome');
    if (!welcome) return res.status(500).json({ error: 'El módulo de bienvenida no está cargado.' });

    try {
      const type = req.body?.type === 'goodbye' ? 'handleLeave' : 'handleJoin';
      await welcome[type](client, member, settings, null);
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Errores no controlados ───────────────────────────────────
  app.use((err, req, res, next) => {
    logger.error('Error en la API interna:', err.message);
    res.status(500).json({ error: 'Error interno del bot.' });
  });

  const port = Number(process.env.BOT_API_PORT) || 3001;

  /*
   * Por defecto escucha solo en localhost, que es lo correcto cuando el bot y
   * la web comparten máquina.
   *
   * En Docker (Easypanel, docker compose…) van en contenedores distintos y hay
   * que poner BOT_API_HOST=0.0.0.0 para que la web pueda alcanzarla por la red
   * interna. Esa red no está expuesta a internet, y además la API exige la
   * cabecera `x-api-key`.
   */
  const host = process.env.BOT_API_HOST || '127.0.0.1';

  if (host !== '127.0.0.1' && host !== 'localhost') {
    const secret = process.env.BOT_API_SECRET || '';
    if (secret.length < 24) {
      logger.error(
        'BOT_API_HOST no es localhost y BOT_API_SECRET es demasiado corto o no está puesto.'
      );
      logger.error(
        'Genera una clave larga antes de exponer la API: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
      // Sin una clave fuerte no se arranca la API: sería un agujero de seguridad.
      return null;
    }
    logger.warn(`La API interna escucha en ${host}. Asegúrate de NO publicar el puerto ${port}.`);
  }

  const server = app.listen(port, host, () => {
    logger.module('api', `API interna escuchando en http://${host}:${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`El puerto ${port} ya está en uso. Cambia BOT_API_PORT en el .env.`);
    } else {
      logger.error('La API interna falló:', err.message);
    }
  });

  return server;
}

module.exports = startApi;

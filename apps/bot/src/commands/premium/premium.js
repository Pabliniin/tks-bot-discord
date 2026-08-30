'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Guild, getGuildSettings, premiumTier, PREMIUM_TIERS, EMBED_COLORS } = require('@tkbot/shared');

const { parseDuration, formatDuration, discordTimestamp, formatNumber } = require('../../utils/time');
const logger = require('../../utils/logger');

/**
 * Gestión de las suscripciones premium.
 *
 * Reservado al personal del bot (`staffOnly`). Los dueños entran siempre;
 * el resto, si están en la lista que gestiona el comando `staff`.
 */

/** Comprueba que el texto parece un identificador de servidor de Discord. */
function isGuildId(value) {
  return /^\d{16,20}$/.test(String(value || '').trim());
}

/** Nombre legible de un servidor, aunque el bot ya no esté en él. */
function guildLabel(client, guildId) {
  const guild = client.guilds.cache.get(guildId);
  return guild ? `**${guild.name}**` : `servidor \`${guildId}\``;
}

module.exports = {
  name: 'premium',
  category: 'premium',
  aliases: ['prem', 'vipadmin'],
  description: 'Concede o retira suscripciones premium a los servidores.',
  usage: '<add|remove|info|list> [servidor] [nivel] [duración]',
  examples: [
    'premium add 123456789012345678 2 30d',
    'premium add 123456789012345678 1',
    'premium remove 123456789012345678',
    'premium info',
    'premium list',
  ],
  cooldown: 3,
  // No aparece en la web publica ni en /help: es de administracion.
  hidden: true,
  guildOnly: false,
  // Solo el personal del bot y sus dueños.
  staffOnly: true,

  data: new SlashCommandBuilder()
    .setName('premium')
    .setDescription('Concede o retira suscripciones premium a los servidores.')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Concede premium a un servidor.')
        .addStringOption((option) =>
          option.setName('servidor').setDescription('ID del servidor.').setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('nivel')
            .setDescription('Nivel de premium.')
            .setRequired(true)
            .addChoices(
              { name: 'Premium 1', value: 1 },
              { name: 'Premium 2', value: 2 }
            )
        )
        .addStringOption((option) =>
          option
            .setName('duracion')
            .setDescription('Cuánto dura: 30d, 1año… Vacío = para siempre.')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Retira el premium de un servidor.')
        .addStringOption((option) =>
          option.setName('servidor').setDescription('ID del servidor.').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('info')
        .setDescription('Consulta el premium de un servidor.')
        .addStringOption((option) =>
          option
            .setName('servidor')
            .setDescription('ID del servidor. Vacío = el servidor actual.')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('Lista todos los servidores con premium activo.')
    ),

  async execute(ctx) {
    const sub = ctx.options.getSubcommand();

    // ── Listado de servidores premium ────────────────────────────
    if (sub === 'list') {
      await ctx.defer({ ephemeral: true });

      const activos = await Guild.find({
        'premium.tier': { $gt: 0 },
        $or: [{ 'premium.until': null }, { 'premium.until': { $gt: new Date() } }],
      })
        .select('guildId premium stats')
        .sort({ 'premium.tier': -1 })
        .limit(50)
        .lean();

      if (activos.length === 0) {
        await ctx.reply(
          { embeds: [require('../../utils/embeds').info('Ningún servidor tiene premium activo.')] },
          { ephemeral: true }
        );
        return;
      }

      const lineas = activos.map((doc) => {
        const guild = ctx.client.guilds.cache.get(doc.guildId);
        const nombre = guild ? guild.name : 'Servidor desconocido';
        const caduca = doc.premium.until
          ? discordTimestamp(doc.premium.until, 'R')
          : 'para siempre';
        const miembros = guild ? ` · ${formatNumber(guild.memberCount)} miembros` : '';

        return `**${nombre}**\n╰ Nivel ${doc.premium.tier} · caduca ${caduca}${miembros}\n╰ \`${doc.guildId}\``;
      });

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.warning)
        .setTitle(`💎 Servidores con premium (${activos.length})`)
        .setDescription(lineas.join('\n\n').slice(0, 4096))
        .setTimestamp();

      await ctx.reply({ embeds: [embed] }, { ephemeral: true });
      return;
    }

    // ── Resolver de qué servidor hablamos ────────────────────────
    const entrada = ctx.options.getString('servidor');
    const guildId = entrada ? entrada.trim() : ctx.guild?.id;

    if (!guildId) {
      await ctx.errorReply(
        'Indica el ID del servidor. Puedes copiarlo con clic derecho sobre el icono del servidor (con el modo desarrollador activado).'
      );
      return;
    }
    if (!isGuildId(guildId)) {
      await ctx.errorReply(
        `\`${guildId}\` no parece un ID de servidor. Debe ser un número de 17 a 20 cifras.`
      );
      return;
    }

    await ctx.defer({ ephemeral: true });

    let settings;
    try {
      settings = await getGuildSettings(guildId);
    } catch (err) {
      logger.error('No se pudo leer la configuración del servidor:', err.message);
      await ctx.errorReply('No he podido acceder a la base de datos.');
      return;
    }

    // ── Consultar estado ─────────────────────────────────────────
    if (sub === 'info') {
      const nivel = premiumTier(settings);
      const limites = PREMIUM_TIERS[nivel];
      const guild = ctx.client.guilds.cache.get(guildId);

      const embed = new EmbedBuilder()
        .setColor(nivel > 0 ? EMBED_COLORS.warning : EMBED_COLORS.neutral)
        .setTitle(guild ? guild.name : 'Servidor desconocido')
        .addFields(
          { name: 'ID', value: `\`${guildId}\``, inline: true },
          { name: 'Plan', value: limites.name, inline: true },
          {
            name: 'Caduca',
            value: settings.premium?.until
              ? `${discordTimestamp(settings.premium.until, 'D')}\n${discordTimestamp(settings.premium.until, 'R')}`
              : nivel > 0
                ? 'Nunca'
                : '—',
            inline: true,
          }
        )
        .setTimestamp();

      if (guild) {
        embed.addFields({
          name: 'Miembros',
          value: formatNumber(guild.memberCount),
          inline: true,
        });
        if (guild.iconURL()) embed.setThumbnail(guild.iconURL());
      } else {
        embed.setFooter({ text: 'El bot no está en este servidor ahora mismo.' });
      }

      // El nivel guardado puede estar caducado: conviene verlo.
      const guardado = settings.premium?.tier || 0;
      if (guardado > 0 && nivel === 0) {
        embed.addFields({
          name: '⚠️ Estado',
          value: `Tiene guardado el nivel ${guardado}, pero **ha caducado**.`,
        });
      }

      await ctx.reply({ embeds: [embed] }, { ephemeral: true });
      return;
    }

    // ── Retirar premium ──────────────────────────────────────────
    if (sub === 'remove') {
      if ((settings.premium?.tier || 0) === 0) {
        await ctx.errorReply(`${guildLabel(ctx.client, guildId)} no tiene premium.`);
        return;
      }

      const anterior = settings.premium.tier;
      settings.set('premium', { tier: 0, until: null, grantedBy: null });
      await settings.save();

      // El bot cachea la configuración: se refresca para que se aplique ya.
      ctx.client.settings.invalidate(guildId);

      logger.module('prem', `${ctx.user.tag} retiró el premium ${anterior} de ${guildId}`);

      await ctx.reply(
        {
          embeds: [
            require('../../utils/embeds').success(
              `Se ha retirado el **Premium ${anterior}** de ${guildLabel(ctx.client, guildId)}.`
            ),
          ],
        },
        { ephemeral: true }
      );
      return;
    }

    // ── Conceder premium ─────────────────────────────────────────
    const nivel = ctx.options.getInteger('nivel', true);
    const duracionTexto = ctx.options.getString('duracion');

    if (![1, 2].includes(nivel)) {
      await ctx.errorReply('El nivel debe ser **1** o **2**.');
      return;
    }

    let until = null;
    if (duracionTexto) {
      const ms = parseDuration(duracionTexto);
      if (ms === null) {
        await ctx.errorReply(
          'Duración no válida. Usa formatos como `30d`, `6m`, `1semana` o `365d`. Déjalo vacío para que no caduque.'
        );
        return;
      }
      until = new Date(Date.now() + ms);
    }

    // Avisar si el bot no está en ese servidor: lo más habitual es haberse
    // equivocado de ID (por ejemplo pegar el de un usuario en vez del de un
    // servidor). El premium se guarda igualmente y se aplicará al invitarlo.
    const enElServidor = ctx.client.guilds.cache.has(guildId);

    settings.set('premium', { tier: nivel, until, grantedBy: ctx.user.id });
    await settings.save();

    ctx.client.settings.invalidate(guildId);

    logger.module(
      'prem',
      `${ctx.user.tag} concedió Premium ${nivel} a ${guildId}${until ? ` hasta ${until.toISOString()}` : ' (permanente)'}`
    );

    const limites = PREMIUM_TIERS[nivel];
    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.success)
      .setTitle('💎 Premium concedido')
      .setDescription(`${guildLabel(ctx.client, guildId)} ahora tiene **${limites.name}**.`)
      .addFields(
        { name: 'ID del servidor', value: `\`${guildId}\``, inline: true },
        {
          name: 'Duración',
          value: until
            ? `${formatDuration(new Date(until) - Date.now())}\nHasta ${discordTimestamp(until, 'D')}`
            : 'Para siempre',
          inline: true,
        },
        {
          name: 'Desbloquea',
          value: [
            `Anti-Raid: ${limites.antiraid ? '✅' : '❌'}`,
            `Bot personalizado: ${limites.customBot ? '✅' : '❌'}`,
            `Embeds: **${limites.maxEmbeds}** · Respuestas: **${limites.maxAutoresponders}**`,
            `Paneles de roles: **${limites.maxSelfroles}** · Tickets: **${limites.maxTicketPanels}**`,
          ].join('\n'),
        }
      )
      .setFooter({ text: `Concedido por ${ctx.user.tag}` })
      .setTimestamp();

    if (!enElServidor) {
      embed.addFields({
        name: '⚠️ Aviso',
        value:
          'El bot **no está en ese servidor**. Comprueba que el ID sea correcto: puede que hayas pegado el de un usuario o el de un canal.\n\nSi el ID es correcto, el premium se aplicará en cuanto invites al bot.',
      });
    }

    await ctx.reply({ embeds: [embed] }, { ephemeral: true });
  },
};

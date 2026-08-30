'use strict';

const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const { EMBED_COLORS } = require('@tkbot/shared');

module.exports = {
  name: 'starboard',
  category: 'moderation',
  aliases: ['destacados', 'tablero'],
  description: 'Resaltar mensajes destacados.',
  usage: '<config|channel|emoji|threshold|toggle> [valor]',
  examples: ['starboard config', 'starboard channel #destacados', 'starboard threshold 5'],
  cooldown: 3,
  userPermissions: ['ManageGuild'],

  data: new SlashCommandBuilder()
    .setName('starboard')
    .setDescription('Configura el tablero de mensajes destacados.')
    .addSubcommand((sub) =>
      sub.setName('config').setDescription('Muestra la configuración actual del starboard.')
    )
    .addSubcommand((sub) =>
      sub
        .setName('channel')
        .setDescription('Elige el canal donde se publican los mensajes destacados.')
        .addChannelOption((option) =>
          option
            .setName('canal')
            .setDescription('Canal del starboard.')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('emoji')
        .setDescription('Cambia el emoji que destaca los mensajes.')
        .addStringOption((option) =>
          option.setName('emoji').setDescription('Emoji a usar.').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('threshold')
        .setDescription('Cuántas reacciones hacen falta para destacar un mensaje.')
        .addIntegerOption((option) =>
          option
            .setName('cantidad')
            .setDescription('Número de reacciones.')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('toggle').setDescription('Activa o desactiva el starboard.')
    ),

  async execute(ctx) {
    const sub = ctx.options.getSubcommand();
    const config = ctx.settings.starboard;

    // ── Ver configuración ────────────────────────────────────────
    if (sub === 'config') {
      const channel = config.channelId ? `<#${config.channelId}>` : '*sin configurar*';

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.warning)
        .setTitle('⭐ Configuración del Starboard')
        .addFields(
          { name: 'Estado', value: config.enabled ? '✅ Activado' : '❌ Desactivado', inline: true },
          { name: 'Canal', value: channel, inline: true },
          { name: 'Emoji', value: config.emoji || '⭐', inline: true },
          { name: 'Reacciones necesarias', value: String(config.threshold || 3), inline: true },
          { name: 'Auto-destacar', value: config.selfStar ? 'Sí' : 'No', inline: true },
          { name: 'Permitir bots', value: config.allowBots ? 'Sí' : 'No', inline: true }
        )
        .setFooter({ text: 'Puedes configurarlo con más detalle desde el panel web.' });

      await ctx.reply({ embeds: [embed] });
      return;
    }

    // ── Canal ────────────────────────────────────────────────────
    if (sub === 'channel') {
      const channel = ctx.options.getChannel('canal', true);

      const missing = require('../../utils/permissions').missingChannelPermissions(channel, [
        'ViewChannel',
        'SendMessages',
        'EmbedLinks',
      ]);
      if (missing.length > 0) {
        await ctx.errorReply(`Me faltan permisos en ese canal: ${missing.join(', ')}`);
        return;
      }

      config.channelId = channel.id;
      // Elegir canal activa el módulo automáticamente.
      config.enabled = true;
      await ctx.client.settings.save(ctx.settings);

      await ctx.successReply(`El starboard publicará en ${channel} y ha quedado activado.`);
      return;
    }

    // ── Emoji ────────────────────────────────────────────────────
    if (sub === 'emoji') {
      const emoji = ctx.options.getString('emoji', true).trim();

      // Se acepta un emoji unicode o uno personalizado del servidor.
      const custom = emoji.match(/^<a?:\w+:(\d+)>$/);
      if (custom && !ctx.guild.emojis.cache.has(custom[1])) {
        await ctx.errorReply('Ese emoji personalizado no es de este servidor.');
        return;
      }

      config.emoji = emoji;
      await ctx.client.settings.save(ctx.settings);
      await ctx.successReply(`El emoji del starboard ahora es ${emoji}.`);
      return;
    }

    // ── Umbral ───────────────────────────────────────────────────
    if (sub === 'threshold') {
      const amount = ctx.options.getInteger('cantidad', true);
      config.threshold = amount;
      await ctx.client.settings.save(ctx.settings);
      await ctx.successReply(
        `Ahora hacen falta **${amount}** reacción(es) para destacar un mensaje.`
      );
      return;
    }

    // ── Activar / desactivar ─────────────────────────────────────
    if (!config.channelId && !config.enabled) {
      await ctx.errorReply(
        `Primero elige un canal con \`${ctx.prefix}starboard channel #canal\`.`
      );
      return;
    }

    config.enabled = !config.enabled;
    await ctx.client.settings.save(ctx.settings);

    await ctx.successReply(
      config.enabled ? 'Starboard **activado**.' : 'Starboard **desactivado**.'
    );
  },
};

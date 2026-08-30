'use strict';

const { SlashCommandBuilder, EmbedBuilder, ChannelType, GuildVerificationLevel } = require('discord.js');
const { EMBED_COLORS } = require('@tkbot/shared');

const { discordTimestamp, formatNumber } = require('../../utils/time');

const VERIFICATION_LABELS = {
  [GuildVerificationLevel.None]: 'Ninguno',
  [GuildVerificationLevel.Low]: 'Bajo',
  [GuildVerificationLevel.Medium]: 'Medio',
  [GuildVerificationLevel.High]: 'Alto',
  [GuildVerificationLevel.VeryHigh]: 'Muy alto',
};

module.exports = {
  name: 'server',
  category: 'info',
  aliases: ['servidor', 'serverinfo', 'si'],
  description: 'Muestra información sobre el servidor.',
  usage: '',
  examples: ['server'],
  cooldown: 5,

  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription('Muestra información sobre el servidor.'),

  async execute(ctx) {
    const guild = ctx.guild;
    await ctx.defer();

    const owner = await guild.fetchOwner().catch(() => null);
    const channels = guild.channels.cache;

    const count = (type) => channels.filter((c) => c.type === type).size;

    // `memberCount` incluye bots; se separan usando la caché disponible.
    const bots = guild.members.cache.filter((m) => m.user.bot).size;

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.default)
      .setAuthor({ name: guild.name, iconURL: guild.iconURL() ?? undefined })
      .setThumbnail(guild.iconURL({ size: 512 }))
      .addFields(
        { name: '🆔 ID', value: `\`${guild.id}\``, inline: true },
        { name: '👑 Dueño', value: owner ? `${owner.user.tag}` : 'Desconocido', inline: true },
        {
          name: '📅 Creado',
          value: `${discordTimestamp(guild.createdAt, 'D')}\n${discordTimestamp(guild.createdAt, 'R')}`,
          inline: true,
        },
        {
          name: '👥 Miembros',
          value: [
            `Total: **${formatNumber(guild.memberCount)}**`,
            bots > 0 ? `Bots en caché: **${formatNumber(bots)}**` : null,
          ]
            .filter(Boolean)
            .join('\n'),
          inline: true,
        },
        {
          name: '💬 Canales',
          value: [
            `Texto: **${count(ChannelType.GuildText)}**`,
            `Voz: **${count(ChannelType.GuildVoice)}**`,
            `Categorías: **${count(ChannelType.GuildCategory)}**`,
            `Foros: **${count(ChannelType.GuildForum)}**`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '🎨 Personalización',
          value: [
            `Roles: **${guild.roles.cache.size}**`,
            `Emojis: **${guild.emojis.cache.size}**`,
            `Stickers: **${guild.stickers.cache.size}**`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '🚀 Mejoras',
          value: `Nivel **${guild.premiumTier}** · **${guild.premiumSubscriptionCount || 0}** boosts`,
          inline: true,
        },
        {
          name: '🔒 Verificación',
          value: VERIFICATION_LABELS[guild.verificationLevel] || 'Desconocido',
          inline: true,
        },
        {
          name: '🌐 Idioma',
          value: guild.preferredLocale || 'Desconocido',
          inline: true,
        }
      )
      .setTimestamp();

    if (guild.description) embed.setDescription(guild.description);
    if (guild.bannerURL()) embed.setImage(guild.bannerURL({ size: 1024 }));

    if (guild.vanityURLCode) {
      embed.addFields({ name: '🔗 URL personalizada', value: `discord.gg/${guild.vanityURLCode}` });
    }

    await ctx.reply({ embeds: [embed] });
  },
};

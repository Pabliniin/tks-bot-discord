'use strict';

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { EMBED_COLORS, PREMIUM_TIERS, premiumTier, BRAND } = require('@tkbot/shared');

const { discordTimestamp } = require('../../utils/time');

module.exports = {
  name: 'vip',
  category: 'premium',
  // `premium` ya no es alias: es el comando de administración de suscripciones.
  aliases: ['membresia', 'membresía', 'miplan'],
  description: 'Muestra información sobre tu bot premium.',
  usage: '',
  examples: ['vip'],
  cooldown: 5,

  data: new SlashCommandBuilder()
    .setName('vip')
    .setDescription('Muestra información sobre tu suscripción premium.'),

  async execute(ctx) {
    const tier = premiumTier(ctx.settings);
    const limits = PREMIUM_TIERS[tier];
    const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const embed = new EmbedBuilder()
      .setColor(tier > 0 ? EMBED_COLORS.warning : EMBED_COLORS.neutral)
      .setAuthor({ name: `${BRAND.name} Premium`, iconURL: ctx.client.user.displayAvatarURL() })
      .setThumbnail(ctx.guild.iconURL() ?? null);

    if (tier === 0) {
      embed
        .setDescription(
          [
            `**${ctx.guild.name}** está usando el plan **Gratis**.`,
            '',
            'Con **TK$ Premium** desbloqueas:',
            '· 🚨 **Anti-Raid** y **Protección VIP** completas',
            '· 📋 Hasta **100 embeds** guardados',
            '· 💬 Hasta **200 respuestas automáticas**',
            '· ✅ Hasta **100 roles autoasignables**',
            '· 🎫 Hasta **25 paneles de tickets**',
            '· 🤖 **Bot personalizado** con tu nombre y avatar (nivel 2)',
            '· ⚡ Soporte prioritario',
          ].join('\n')
        )
        .addFields({
          name: 'Límites actuales',
          value: [
            `Embeds: **${limits.maxEmbeds}**`,
            `Respuestas automáticas: **${limits.maxAutoresponders}**`,
            `Paneles de roles: **${limits.maxSelfroles}**`,
            `Paneles de tickets: **${limits.maxTicketPanels}**`,
          ].join('\n'),
        });
    } else {
      const until = ctx.settings.premium?.until;
      embed
        .setDescription(
          `**${ctx.guild.name}** tiene **${limits.name}** activo. ¡Gracias por el apoyo! 💎`
        )
        .addFields(
          { name: 'Plan', value: limits.name, inline: true },
          {
            name: 'Vence',
            value: until ? discordTimestamp(until, 'D') : 'Nunca',
            inline: true,
          },
          {
            name: 'Funciones activas',
            value: [
              `Anti-Raid: ${limits.antiraid ? '✅' : '❌'}`,
              `Bot personalizado: ${limits.customBot ? '✅' : '❌'}`,
              `Embeds: **${limits.maxEmbeds}**`,
              `Respuestas automáticas: **${limits.maxAutoresponders}**`,
              `Paneles de roles: **${limits.maxSelfroles}**`,
              `Paneles de tickets: **${limits.maxTicketPanels}**`,
            ].join('\n'),
          }
        );
    }

    embed.setFooter({ text: `ID del servidor: ${ctx.guild.id}` }).setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel(tier === 0 ? 'Conseguir Premium' : 'Gestionar suscripción')
        .setStyle(ButtonStyle.Link)
        .setURL(`${site}/premium`),
      new ButtonBuilder()
        .setLabel('Panel de control')
        .setStyle(ButtonStyle.Link)
        .setURL(`${site}/dashboard/${ctx.guild.id}`)
    );

    await ctx.reply({ embeds: [embed], components: [row] });
  },
};

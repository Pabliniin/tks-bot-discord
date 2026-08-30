'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { EMBED_COLORS, Member, Case, levelFromXp } = require('@tkbot/shared');

const { discordTimestamp, formatNumber } = require('../../utils/time');
const { parseColor } = require('../../utils/embeds');

/** Insignias de Discord y su emoji. */
const FLAG_LABELS = {
  Staff: '👑 Staff de Discord',
  Partner: '🤝 Partner',
  Hypesquad: '🎉 HypeSquad Events',
  HypeSquadOnlineHouse1: '🏠 Bravery',
  HypeSquadOnlineHouse2: '🏠 Brilliance',
  HypeSquadOnlineHouse3: '🏠 Balance',
  BugHunterLevel1: '🐛 Cazador de bugs',
  BugHunterLevel2: '🐛 Cazador de bugs (oro)',
  PremiumEarlySupporter: '💎 Early Supporter',
  VerifiedDeveloper: '🛠️ Desarrollador verificado',
  CertifiedModerator: '🛡️ Moderador certificado',
  ActiveDeveloper: '⚙️ Desarrollador activo',
};

module.exports = {
  name: 'user',
  category: 'info',
  aliases: ['usuario', 'userinfo', 'ui'],
  description: 'Muestra información, como el ID y la fecha de registro, sobre ti o un usuario.',
  usage: '[usuario]',
  examples: ['user', 'user @Rogue'],
  cooldown: 5,

  data: new SlashCommandBuilder()
    .setName('user')
    .setDescription('Muestra información sobre ti o un usuario.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('De quién quieres la información.').setRequired(false)
    ),

  async execute(ctx) {
    const target = ctx.options.getUser('usuario') || ctx.user;
    const member = await ctx.guild.members.fetch(target.id).catch(() => null);

    // Se pide el usuario completo para tener banner y color de acento.
    const full = await target.fetch().catch(() => target);

    const embed = new EmbedBuilder()
      .setColor(member?.displayColor || parseColor(full.hexAccentColor, EMBED_COLORS.default))
      .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
      .setThumbnail(target.displayAvatarURL({ size: 512 }))
      .addFields(
        { name: '🆔 ID', value: `\`${target.id}\``, inline: true },
        { name: '🤖 Bot', value: target.bot ? 'Sí' : 'No', inline: true },
        {
          name: '📅 Cuenta creada',
          value: `${discordTimestamp(target.createdAt, 'D')}\n${discordTimestamp(target.createdAt, 'R')}`,
          inline: true,
        }
      );

    if (member) {
      embed.addFields({
        name: '📥 Se unió al servidor',
        value: member.joinedAt
          ? `${discordTimestamp(member.joinedAt, 'D')}\n${discordTimestamp(member.joinedAt, 'R')}`
          : 'Desconocido',
        inline: true,
      });

      if (member.premiumSince) {
        embed.addFields({
          name: '💎 Mejorando el servidor desde',
          value: discordTimestamp(member.premiumSince, 'R'),
          inline: true,
        });
      }

      if (member.nickname) {
        embed.addFields({ name: '📝 Apodo', value: member.nickname, inline: true });
      }

      const roles = member.roles.cache
        .filter((r) => r.id !== ctx.guild.id)
        .sort((a, b) => b.position - a.position)
        .map((r) => `<@&${r.id}>`);

      if (roles.length > 0) {
        const shown = roles.slice(0, 25).join(' ');
        embed.addFields({
          name: `🎭 Roles (${roles.length})`,
          value: (roles.length > 25 ? `${shown} y ${roles.length - 25} más…` : shown).slice(0, 1024),
        });
      }

      // Estadísticas del servidor.
      const [stats, warnings] = await Promise.all([
        Member.findOne({ guildId: ctx.guild.id, userId: target.id }).lean(),
        Case.countDocuments({ guildId: ctx.guild.id, userId: target.id, type: 'warn', active: true }),
      ]);

      if (stats) {
        embed.addFields({
          name: '📊 Estadísticas',
          value: [
            `Nivel **${levelFromXp(stats.xp || 0)}** · ${formatNumber(stats.xp || 0)} XP`,
            `${formatNumber(stats.messages || 0)} mensajes · ${formatNumber(stats.voiceMinutes || 0)} min en voz`,
            `${formatNumber(stats.invites?.total || 0)} invitaciones · ${warnings} advertencia(s)`,
          ].join('\n'),
        });
      }
    } else {
      embed.setFooter({ text: 'Este usuario no está en el servidor.' });
    }

    const flags = full.flags?.toArray() || [];
    const badges = flags.map((f) => FLAG_LABELS[f]).filter(Boolean);
    if (badges.length > 0) {
      embed.addFields({ name: '🏅 Insignias', value: badges.join('\n') });
    }

    const banner = full.bannerURL?.({ size: 1024 });
    if (banner) embed.setImage(banner);

    await ctx.reply({ embeds: [embed] });
  },
};

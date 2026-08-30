'use strict';

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { EMBED_COLORS } = require('@tkbot/shared');

module.exports = {
  name: 'avatar',
  category: 'info',
  aliases: ['av', 'pfp', 'foto'],
  description: 'Te muestra el avatar de un usuario.',
  usage: '[usuario]',
  examples: ['avatar', 'avatar @Rogue'],
  cooldown: 5,

  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Te muestra el avatar de un usuario.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('De quién quieres el avatar.').setRequired(false)
    ),

  async execute(ctx) {
    const target = ctx.options.getUser('usuario') || ctx.user;
    const member = await ctx.guild.members.fetch(target.id).catch(() => null);

    const globalAvatar = target.displayAvatarURL({ size: 1024, extension: 'png' });
    // El avatar propio del servidor, si el miembro tiene uno distinto.
    const serverAvatar = member?.avatar
      ? member.displayAvatarURL({ size: 1024, extension: 'png' })
      : null;

    const embed = new EmbedBuilder()
      .setColor(member?.displayColor || EMBED_COLORS.default)
      .setAuthor({ name: target.tag, iconURL: globalAvatar })
      .setImage(serverAvatar || globalAvatar)
      .setFooter({
        text: serverAvatar ? 'Mostrando el avatar del servidor' : 'Mostrando el avatar global',
      });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('PNG').setStyle(ButtonStyle.Link).setURL(
        target.displayAvatarURL({ size: 4096, extension: 'png' })
      ),
      new ButtonBuilder().setLabel('WEBP').setStyle(ButtonStyle.Link).setURL(
        target.displayAvatarURL({ size: 4096, extension: 'webp' })
      )
    );

    if (serverAvatar) {
      row.addComponents(
        new ButtonBuilder()
          .setLabel('Avatar del servidor')
          .setStyle(ButtonStyle.Link)
          .setURL(member.displayAvatarURL({ size: 4096, extension: 'png' }))
      );
    }

    await ctx.reply({ embeds: [embed], components: [row] });
  },
};

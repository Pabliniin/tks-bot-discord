'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { User, EMBED_COLORS } = require('@tkbot/shared');

const { formatNumber } = require('../../utils/time');

module.exports = {
  name: 'credits',
  category: 'general',
  aliases: ['creditos', 'créditos', 'bal', 'balance'],
  description: 'Muestra tus créditos o el de otra persona.',
  usage: '[usuario]',
  examples: ['credits', 'credits @Rogue'],
  cooldown: 5,

  data: new SlashCommandBuilder()
    .setName('credits')
    .setDescription('Muestra tus créditos o el de otra persona.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('De quién quieres ver los créditos.').setRequired(false)
    ),

  async execute(ctx) {
    const target = ctx.options.getUser('usuario') || ctx.user;

    const doc = await User.findOneAndUpdate(
      { userId: target.id },
      { $setOnInsert: { userId: target.id } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Posición global por créditos.
    const higher = await User.countDocuments({ credits: { $gt: doc.credits || 0 } });

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.default)
      .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
      .setThumbnail(target.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '💰 Créditos', value: `**${formatNumber(doc.credits || 0)}**`, inline: true },
        { name: '⭐ Reputación', value: `**${formatNumber(doc.reputation || 0)}**`, inline: true },
        { name: '🏆 Posición global', value: `**#${formatNumber(higher + 1)}**`, inline: true }
      )
      .setTimestamp();

    await ctx.reply({ embeds: [embed] });
  },
};

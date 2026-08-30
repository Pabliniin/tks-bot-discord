'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { EMBED_COLORS } = require('@tkbot/shared');

const { formatNumber } = require('../../utils/time');

/**
 * Interpreta una notación de dados tipo `2d6+3`.
 * @returns {{ count: number, sides: number, modifier: number }|null}
 */
function parseDice(input) {
  const match = String(input || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .match(/^(\d*)d(\d+)([+-]\d+)?$/);

  if (!match) return null;

  const count = match[1] ? Number.parseInt(match[1], 10) : 1;
  const sides = Number.parseInt(match[2], 10);
  const modifier = match[3] ? Number.parseInt(match[3], 10) : 0;

  if (count < 1 || count > 100) return null;
  if (sides < 2 || sides > 1000) return null;

  return { count, sides, modifier };
}

module.exports = {
  name: 'roll',
  category: 'general',
  aliases: ['dado', 'dados', 'dice'],
  description: 'Tira un dado.',
  usage: '[dados]',
  examples: ['roll', 'roll 2d20', 'roll 3d6+2'],
  cooldown: 3,
  guildOnly: false,

  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Tira un dado.')
    .addStringOption((option) =>
      option
        .setName('dados')
        .setDescription('Notación de dados, por ejemplo 2d20 o 3d6+2. Por defecto 1d6.')
        .setRequired(false)
    ),

  async execute(ctx) {
    const input = ctx.options.getString('dados') || '1d6';
    const dice = parseDice(input);

    if (!dice) {
      await ctx.errorReply(
        'Formato no válido. Usa algo como `1d6`, `2d20` o `3d6+2`.\nMáximo 100 dados de hasta 1000 caras.'
      );
      return;
    }

    const rolls = [];
    for (let i = 0; i < dice.count; i += 1) {
      rolls.push(Math.floor(Math.random() * dice.sides) + 1);
    }

    const sum = rolls.reduce((acc, value) => acc + value, 0);
    const total = sum + dice.modifier;

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.default)
      .setAuthor({ name: ctx.user.tag, iconURL: ctx.user.displayAvatarURL() })
      .setTitle('🎲 Tirada de dados')
      .addFields(
        { name: 'Dados', value: `\`${dice.count}d${dice.sides}${dice.modifier ? (dice.modifier > 0 ? `+${dice.modifier}` : dice.modifier) : ''}\``, inline: true },
        { name: 'Resultado', value: `**${formatNumber(total)}**`, inline: true }
      );

    // Con muchos dados la lista completa no cabe en el embed.
    if (dice.count > 1) {
      const detail = rolls.join(' + ');
      embed.addFields({
        name: 'Tiradas',
        value: detail.length > 1000 ? `${dice.count} tiradas (suma: ${formatNumber(sum)})` : detail,
      });
    }

    await ctx.reply({ embeds: [embed] });
  },

  // Exportado para las pruebas.
  parseDice,
};

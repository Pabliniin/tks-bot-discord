'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { Member, levelFromXp } = require('@tkbot/shared');

const { formatNumber } = require('../../utils/time');

module.exports = {
  name: 'setxp',
  category: 'levels',
  aliases: ['establecerxp'],
  description: 'Establece el xp del usuario.',
  usage: '<usuario> <cantidad>',
  examples: ['setxp @Rogue 5000'],
  cooldown: 3,
  userPermissions: ['ManageGuild'],

  data: new SlashCommandBuilder()
    .setName('setxp')
    .setDescription('Establece el xp del usuario.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('A quién le cambias el XP.').setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('cantidad')
        .setDescription('Nueva cantidad de XP.')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(100_000_000)
    ),

  async execute(ctx) {
    const target = ctx.options.getUser('usuario', true);
    const amount = ctx.options.getInteger('cantidad', true);

    if (target.bot) {
      await ctx.errorReply('Los bots no acumulan experiencia.');
      return;
    }

    const level = levelFromXp(amount);

    await Member.updateOne(
      { guildId: ctx.guild.id, userId: target.id },
      {
        $set: { xp: amount, level },
        $setOnInsert: { guildId: ctx.guild.id, userId: target.id },
      },
      { upsert: true }
    );

    // Ajusta los roles de nivel a la nueva situación.
    const levels = ctx.client.modules.get('levels');
    const member = await ctx.guild.members.fetch(target.id).catch(() => null);
    if (levels && member) {
      await levels.applyLevelRoles(member, ctx.settings, level).catch(() => {});
    }

    await ctx.successReply(
      `**${target.tag}** ahora tiene **${formatNumber(amount)} XP** (nivel **${level}**).`
    );
  },
};

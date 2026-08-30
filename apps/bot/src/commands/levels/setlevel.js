'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { Member, totalXpForLevel } = require('@tkbot/shared');

const { formatNumber } = require('../../utils/time');

module.exports = {
  name: 'setlevel',
  category: 'levels',
  aliases: ['establecernivel'],
  description: 'Establece el nivel del usuario.',
  usage: '<usuario> <nivel>',
  examples: ['setlevel @Rogue 25'],
  cooldown: 3,
  userPermissions: ['ManageGuild'],

  data: new SlashCommandBuilder()
    .setName('setlevel')
    .setDescription('Establece el nivel del usuario.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('A quién le cambias el nivel.').setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('nivel')
        .setDescription('Nuevo nivel.')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(500)
    ),

  async execute(ctx) {
    const target = ctx.options.getUser('usuario', true);
    const level = ctx.options.getInteger('nivel', true);

    if (target.bot) {
      await ctx.errorReply('Los bots no acumulan experiencia.');
      return;
    }

    // Se asigna la XP mínima necesaria para ese nivel.
    const xp = totalXpForLevel(level);

    await Member.updateOne(
      { guildId: ctx.guild.id, userId: target.id },
      {
        $set: { xp, level },
        $setOnInsert: { guildId: ctx.guild.id, userId: target.id },
      },
      { upsert: true }
    );

    const levels = ctx.client.modules.get('levels');
    const member = await ctx.guild.members.fetch(target.id).catch(() => null);
    if (levels && member) {
      await levels.applyLevelRoles(member, ctx.settings, level).catch(() => {});
    }

    await ctx.successReply(
      `**${target.tag}** ahora está en el **nivel ${level}** (${formatNumber(xp)} XP).`
    );
  },
};

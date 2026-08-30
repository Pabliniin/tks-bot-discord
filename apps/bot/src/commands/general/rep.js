'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { User } = require('@tkbot/shared');

const embeds = require('../../utils/embeds');
const { formatDuration } = require('../../utils/time');

/** Una reputación cada 24 horas. */
const COOLDOWN = 86_400_000;

module.exports = {
  name: 'rep',
  category: 'general',
  aliases: ['reputacion', 'reputación'],
  description: 'Otorga a alguien un punto de reputación. Solo se puede utilizar una vez cada 24 horas.',
  usage: '<usuario>',
  examples: ['rep @Rogue'],
  cooldown: 5,

  data: new SlashCommandBuilder()
    .setName('rep')
    .setDescription('Otorga a alguien un punto de reputación (una vez cada 24 horas).')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('A quién quieres dar reputación.').setRequired(true)
    ),

  async execute(ctx) {
    const target = ctx.options.getUser('usuario', true);

    if (target.id === ctx.user.id) {
      await ctx.errorReply('No puedes darte reputación a ti mismo.');
      return;
    }
    if (target.bot) {
      await ctx.errorReply('No puedes dar reputación a un bot.');
      return;
    }

    const giver = await User.findOneAndUpdate(
      { userId: ctx.user.id },
      { $setOnInsert: { userId: ctx.user.id } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const last = giver.lastRepAt ? new Date(giver.lastRepAt).getTime() : 0;
    const elapsed = Date.now() - last;

    if (elapsed < COOLDOWN) {
      await ctx.errorReply(
        `Ya has dado reputación recientemente. Podrás volver a hacerlo en **${formatDuration(
          COOLDOWN - elapsed
        )}**.`
      );
      return;
    }

    await User.updateOne({ userId: ctx.user.id }, { $set: { lastRepAt: new Date() } });

    const receiver = await User.findOneAndUpdate(
      { userId: target.id },
      { $inc: { reputation: 1 }, $setOnInsert: { userId: target.id } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    await ctx.reply({
      embeds: [
        embeds.success(
          `${ctx.user} le ha dado un punto de reputación a ${target}.\nAhora tiene **${receiver.reputation}** puntos.`
        ),
      ],
    });
  },
};

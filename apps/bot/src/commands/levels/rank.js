'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { Member } = require('@tkbot/shared');

const { generateRankCard } = require('../../canvas/rankCard');

module.exports = {
  name: 'rank',
  category: 'levels',
  aliases: ['rango', 'nivel', 'level'],
  description: 'Mira tu tarjeta de rango de servidor o la de otra persona.',
  usage: '[usuario]',
  examples: ['rank', 'rank @Rogue'],
  cooldown: 8,
  botPermissions: ['AttachFiles'],

  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Mira tu tarjeta de rango de servidor o la de otra persona.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('De quién quieres ver el rango.').setRequired(false)
    ),

  async execute(ctx) {
    if (!ctx.settings.levels?.enabled) {
      await ctx.errorReply(
        'El sistema de niveles está desactivado. Un administrador puede activarlo desde el panel.'
      );
      return;
    }

    const target = ctx.options.getUser('usuario') || ctx.user;

    if (target.bot) {
      await ctx.errorReply('Los bots no acumulan experiencia.');
      return;
    }

    await ctx.defer();

    const doc = await Member.findOne({ guildId: ctx.guild.id, userId: target.id }).lean();
    const xp = doc?.xp || 0;

    if (xp === 0) {
      await ctx.reply({
        embeds: [
          require('../../utils/embeds').info(
            target.id === ctx.user.id
              ? 'Todavía no tienes experiencia. ¡Participa en el chat para conseguirla!'
              : `**${target.username}** todavía no tiene experiencia en este servidor.`
          ),
        ],
      });
      return;
    }

    // La posición es el número de miembros con más XP, más uno.
    const higher = await Member.countDocuments({ guildId: ctx.guild.id, xp: { $gt: xp } });

    const member = await ctx.guild.members.fetch(target.id).catch(() => null);

    const attachment = await generateRankCard({
      username: member?.displayName || target.username,
      avatarUrl: target.displayAvatarURL({ extension: 'png', size: 512 }),
      xp,
      rank: higher + 1,
      status: member?.presence?.status || 'offline',
      card: ctx.settings.levels.card,
    });

    await ctx.reply({ files: [attachment] });
  },
};

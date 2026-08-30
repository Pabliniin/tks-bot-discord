'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { Member, User, levelFromXp } = require('@tkbot/shared');

const { generateProfileCard } = require('../../canvas/profileCard');

module.exports = {
  name: 'profile',
  category: 'levels',
  aliases: ['perfil'],
  description: 'Mira tu tarjeta de perfil personal o la de otra persona.',
  usage: '[usuario]',
  examples: ['profile', 'profile @Rogue'],
  cooldown: 8,
  botPermissions: ['AttachFiles'],

  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Mira tu tarjeta de perfil personal o la de otra persona.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('De quién quieres ver el perfil.').setRequired(false)
    ),

  async execute(ctx) {
    const target = ctx.options.getUser('usuario') || ctx.user;

    if (target.bot) {
      await ctx.errorReply('Los bots no tienen perfil.');
      return;
    }

    await ctx.defer();

    const [profile, memberDoc] = await Promise.all([
      User.findOneAndUpdate(
        { userId: target.id },
        { $setOnInsert: { userId: target.id } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ),
      Member.findOne({ guildId: ctx.guild.id, userId: target.id }).lean(),
    ]);

    const xp = memberDoc?.xp || 0;
    const higher =
      xp > 0 ? await Member.countDocuments({ guildId: ctx.guild.id, xp: { $gt: xp } }) : -1;

    const member = await ctx.guild.members.fetch(target.id).catch(() => null);

    const attachment = await generateProfileCard({
      username: member?.displayName || target.username,
      avatarUrl: target.displayAvatarURL({ extension: 'png', size: 512 }),
      title: profile.profile?.title || '',
      bio: profile.profile?.bio || '',
      credits: profile.credits || 0,
      reputation: profile.reputation || 0,
      level: levelFromXp(xp),
      rank: higher >= 0 ? higher + 1 : 0,
      createdAt: target.createdAt,
      profile: profile.profile,
    });

    await ctx.reply({ files: [attachment] });
  },
};

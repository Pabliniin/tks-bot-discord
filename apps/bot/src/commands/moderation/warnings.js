'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Case, EMBED_COLORS } = require('@tkbot/shared');

const { discordTimestamp } = require('../../utils/time');

module.exports = {
  name: 'warnings',
  category: 'moderation',
  aliases: ['advertencias', 'warns'],
  description: 'Obtiene la lista de advertencias del servidor o de un usuario.',
  usage: '[usuario]',
  examples: ['warnings', 'warnings @Rogue'],
  cooldown: 5,
  userPermissions: ['ModerateMembers'],

  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Obtiene la lista de advertencias del servidor o de un usuario.')
    .addUserOption((option) =>
      option
        .setName('usuario')
        .setDescription('De quién quieres ver las advertencias. Vacío para todo el servidor.')
        .setRequired(false)
    ),

  async execute(ctx) {
    const target = ctx.options.getUser('usuario');

    await ctx.defer();

    const filter = { guildId: ctx.guild.id, type: 'warn', active: true };
    if (target) filter.userId = target.id;

    const cases = await Case.find(filter).sort({ caseId: -1 }).limit(20).lean();

    if (cases.length === 0) {
      await ctx.reply({
        embeds: [
          require('../../utils/embeds').info(
            target
              ? `**${target.tag}** no tiene advertencias activas.`
              : 'No hay advertencias activas en este servidor.'
          ),
        ],
      });
      return;
    }

    const total = await Case.countDocuments(filter);

    const lines = cases.map((c) => {
      const who = target ? '' : ` · <@${c.userId}>`;
      return [
        `\`#${c.caseId}\`${who} — ${discordTimestamp(c.createdAt, 'R')}`,
        `╰ **Razón:** ${c.reason}`,
        `╰ **Moderador:** <@${c.moderatorId}>`,
      ].join('\n');
    });

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.warning)
      .setTitle(
        target ? `⚠️ Advertencias de ${target.tag}` : `⚠️ Advertencias de ${ctx.guild.name}`
      )
      .setDescription(lines.join('\n\n').slice(0, 4096))
      .setFooter({
        text:
          total > cases.length
            ? `Mostrando ${cases.length} de ${total} advertencias`
            : `${total} advertencia(s) activa(s)`,
      })
      .setTimestamp();

    if (target) embed.setThumbnail(target.displayAvatarURL());

    await ctx.reply({ embeds: [embed] });
  },
};

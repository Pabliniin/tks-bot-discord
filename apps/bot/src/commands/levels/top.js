'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Member, EMBED_COLORS, levelFromXp } = require('@tkbot/shared');

const { formatNumber, formatDuration } = require('../../utils/time');

/** Medallas para las tres primeras posiciones. */
const MEDALS = ['🥇', '🥈', '🥉'];

/** Configuración de cada tipo de ranking. */
const MODES = {
  text: {
    label: 'texto',
    title: '🏆 Ranking por texto',
    sort: { xp: -1 },
    filter: { xp: { $gt: 0 } },
    format: (doc) =>
      `Nivel **${levelFromXp(doc.xp)}** · ${formatNumber(doc.xp)} XP · ${formatNumber(doc.messages || 0)} mensajes`,
  },
  voice: {
    label: 'voz',
    title: '🎙️ Ranking por voz',
    sort: { voiceMinutes: -1 },
    filter: { voiceMinutes: { $gt: 0 } },
    format: (doc) => formatDuration((doc.voiceMinutes || 0) * 60_000),
  },
  invites: {
    label: 'invitaciones',
    title: '📨 Ranking por invitaciones',
    sort: { 'invites.total': -1 },
    filter: { 'invites.total': { $gt: 0 } },
    format: (doc) => {
      const inv = doc.invites || {};
      const real = (inv.total || 0) - (inv.left || 0) - (inv.fake || 0) + (inv.bonus || 0);
      return `**${formatNumber(real)}** invitaciones (${formatNumber(inv.total || 0)} totales, ${formatNumber(inv.left || 0)} salieron)`;
    },
  },
};

module.exports = {
  name: 'top',
  category: 'levels',
  aliases: ['ranking', 'leaderboard', 'lb'],
  description: 'Muestra los miembros principales por texto o voz.',
  usage: '[texto|voz|invitaciones]',
  examples: ['top', 'top voz', 'top invitaciones'],
  cooldown: 10,

  data: new SlashCommandBuilder()
    .setName('top')
    .setDescription('Muestra los miembros principales por texto o voz.')
    .addStringOption((option) =>
      option
        .setName('tipo')
        .setDescription('Qué ranking quieres ver.')
        .setRequired(false)
        .addChoices(
          { name: 'Texto', value: 'text' },
          { name: 'Voz', value: 'voice' },
          { name: 'Invitaciones', value: 'invites' }
        )
    ),

  async execute(ctx) {
    // Acepta los nombres en español al usarlo por prefijo.
    const raw = (ctx.options.getString('tipo') || 'text').toLowerCase();
    const aliases = {
      texto: 'text',
      text: 'text',
      voz: 'voice',
      voice: 'voice',
      invitaciones: 'invites',
      invites: 'invites',
      inv: 'invites',
    };
    const mode = MODES[aliases[raw] || 'text'];

    await ctx.defer();

    const docs = await Member.find({ guildId: ctx.guild.id, ...mode.filter })
      .sort(mode.sort)
      .limit(10)
      .lean();

    if (docs.length === 0) {
      await ctx.reply({
        embeds: [
          require('../../utils/embeds').info(
            `Todavía no hay datos para el ranking de ${mode.label}.`
          ),
        ],
      });
      return;
    }

    const lines = [];
    for (const [index, doc] of docs.entries()) {
      // Se prefiere el nombre en el servidor; si el miembro se fue, el ID.
      const member = await ctx.guild.members.fetch(doc.userId).catch(() => null);
      const name = member ? member.displayName : `Usuario desconocido (${doc.userId})`;
      const medal = MEDALS[index] || `**${index + 1}.**`;
      lines.push(`${medal} **${name}**\n╰ ${mode.format(doc)}`);
    }

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.default)
      .setTitle(mode.title)
      .setDescription(lines.join('\n\n').slice(0, 4096))
      .setFooter({ text: ctx.guild.name, iconURL: ctx.guild.iconURL() ?? undefined })
      .setTimestamp();

    await ctx.reply({ embeds: [embed] });
  },
};

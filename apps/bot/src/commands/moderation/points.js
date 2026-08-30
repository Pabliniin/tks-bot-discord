'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Member, EMBED_COLORS } = require('@tkbot/shared');

const { createCase } = require('../../utils/moderation');
const { formatNumber } = require('../../utils/time');

module.exports = {
  name: 'points',
  category: 'moderation',
  aliases: ['puntos'],
  description: 'Un servidor basado en puntos que pueden ser dados por los moderadores.',
  usage: '<add|remove|view|top> [usuario] [cantidad]',
  examples: ['points add @Rogue 5', 'points view @Rogue', 'points top'],
  cooldown: 3,
  userPermissions: ['ModerateMembers'],

  data: new SlashCommandBuilder()
    .setName('points')
    .setDescription('Gestiona los puntos de los miembros.')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Da puntos a un miembro.')
        .addUserOption((option) =>
          option.setName('usuario').setDescription('A quién.').setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('cantidad')
            .setDescription('Cuántos puntos.')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10_000)
        )
        .addStringOption((option) =>
          option.setName('razon').setDescription('Motivo.').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Quita puntos a un miembro.')
        .addUserOption((option) =>
          option.setName('usuario').setDescription('A quién.').setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('cantidad')
            .setDescription('Cuántos puntos.')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10_000)
        )
        .addStringOption((option) =>
          option.setName('razon').setDescription('Motivo.').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('Consulta los puntos de un miembro.')
        .addUserOption((option) =>
          option.setName('usuario').setDescription('De quién.').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('top').setDescription('Muestra el ranking de puntos del servidor.')
    ),

  async execute(ctx) {
    const sub = ctx.options.getSubcommand();

    // ── Ranking ──────────────────────────────────────────────────
    if (sub === 'top') {
      const docs = await Member.find({ guildId: ctx.guild.id, points: { $ne: 0 } })
        .sort({ points: -1 })
        .limit(10)
        .lean();

      if (docs.length === 0) {
        await ctx.errorReply('Todavía no hay puntos repartidos en este servidor.');
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.default)
        .setTitle('🔢 Ranking de puntos')
        .setDescription(
          docs
            .map((d, i) => `**${i + 1}.** <@${d.userId}> — **${formatNumber(d.points)}** puntos`)
            .join('\n')
        )
        .setTimestamp();

      await ctx.reply({ embeds: [embed] });
      return;
    }

    // ── Consulta ─────────────────────────────────────────────────
    if (sub === 'view') {
      const target = ctx.options.getUser('usuario') || ctx.user;
      const doc = await Member.findOne({ guildId: ctx.guild.id, userId: target.id }).lean();

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.default)
        .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
        .setDescription(`Tiene **${formatNumber(doc?.points || 0)}** punto(s) en este servidor.`);

      await ctx.reply({ embeds: [embed] });
      return;
    }

    // ── Añadir o quitar ──────────────────────────────────────────
    const target = ctx.options.getUser('usuario', true);
    const amount = ctx.options.getInteger('cantidad', true);
    const reason = ctx.options.getString('razon') || 'Sin razón especificada';

    if (target.bot) {
      await ctx.errorReply('Los bots no acumulan puntos.');
      return;
    }

    const delta = sub === 'add' ? amount : -amount;

    const doc = await Member.findOneAndUpdate(
      { guildId: ctx.guild.id, userId: target.id },
      { $inc: { points: delta }, $setOnInsert: { guildId: ctx.guild.id, userId: target.id } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    await createCase(
      ctx.guild,
      {
        type: 'points',
        user: target,
        moderator: ctx.user,
        reason: `${delta > 0 ? '+' : ''}${delta} puntos · ${reason}`,
      },
      ctx.settings
    ).catch(() => {});

    await ctx.successReply(
      `${sub === 'add' ? 'Se han dado' : 'Se han quitado'} **${formatNumber(amount)}** punto(s) a **${target.tag}**.\nTotal: **${formatNumber(doc.points)}**\n**Razón:** ${reason}`
    );
  },
};

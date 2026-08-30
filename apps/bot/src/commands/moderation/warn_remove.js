'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { Case, Member } = require('@tkbot/shared');

module.exports = {
  name: 'warn_remove',
  category: 'moderation',
  aliases: ['delwarn', 'quitaradvertencia', 'unwarn'],
  description: 'Eliminar advertencias para el servidor o usuario.',
  usage: '<case|user|server> [valor]',
  examples: ['warn_remove case 12', 'warn_remove user @Rogue', 'warn_remove server'],
  cooldown: 3,
  userPermissions: ['ModerateMembers'],

  data: new SlashCommandBuilder()
    .setName('warn_remove')
    .setDescription('Eliminar advertencias para el servidor o usuario.')
    .addSubcommand((sub) =>
      sub
        .setName('case')
        .setDescription('Elimina una advertencia concreta por su número de caso.')
        .addIntegerOption((option) =>
          option
            .setName('numero')
            .setDescription('Número del caso.')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('user')
        .setDescription('Elimina todas las advertencias de un usuario.')
        .addUserOption((option) =>
          option.setName('usuario').setDescription('De quién.').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('server')
        .setDescription('Elimina todas las advertencias del servidor.')
    ),

  async execute(ctx) {
    const sub = ctx.options.getSubcommand();

    // ── Un caso concreto ─────────────────────────────────────────
    if (sub === 'case') {
      const number = ctx.options.getInteger('numero', true);

      const doc = await Case.findOne({
        guildId: ctx.guild.id,
        caseId: number,
        type: 'warn',
      });

      if (!doc) {
        await ctx.errorReply(`No existe la advertencia \`#${number}\` en este servidor.`);
        return;
      }
      if (!doc.active) {
        await ctx.errorReply(`La advertencia \`#${number}\` ya estaba retirada.`);
        return;
      }

      doc.active = false;
      await doc.save();

      // El contador nunca debe bajar de cero.
      await Member.updateOne(
        { guildId: ctx.guild.id, userId: doc.userId, warnCount: { $gt: 0 } },
        { $inc: { warnCount: -1 } }
      ).catch(() => {});

      await ctx.successReply(
        `Se ha retirado la advertencia \`#${number}\` de <@${doc.userId}>.`
      );
      return;
    }

    // ── Todas las de un usuario ──────────────────────────────────
    if (sub === 'user') {
      const target = ctx.options.getUser('usuario', true);

      const result = await Case.updateMany(
        { guildId: ctx.guild.id, userId: target.id, type: 'warn', active: true },
        { $set: { active: false } }
      );

      if (result.modifiedCount === 0) {
        await ctx.errorReply(`**${target.tag}** no tenía advertencias activas.`);
        return;
      }

      await Member.updateOne(
        { guildId: ctx.guild.id, userId: target.id },
        { $set: { warnCount: 0 } }
      ).catch(() => {});

      await ctx.successReply(
        `Se han retirado **${result.modifiedCount}** advertencia(s) de **${target.tag}**.`
      );
      return;
    }

    // ── Todas las del servidor ───────────────────────────────────
    const result = await Case.updateMany(
      { guildId: ctx.guild.id, type: 'warn', active: true },
      { $set: { active: false } }
    );

    if (result.modifiedCount === 0) {
      await ctx.errorReply('No había advertencias activas en este servidor.');
      return;
    }

    await Member.updateMany({ guildId: ctx.guild.id }, { $set: { warnCount: 0 } }).catch(() => {});

    await ctx.successReply(
      `Se han retirado **${result.modifiedCount}** advertencia(s) de todo el servidor.`
    );
  },
};

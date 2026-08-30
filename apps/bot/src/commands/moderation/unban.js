'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { Case } = require('@tkbot/shared');

const { createCase } = require('../../utils/moderation');
const { extractId } = require('../../utils/args');

module.exports = {
  name: 'unban',
  category: 'moderation',
  aliases: ['desbanear'],
  description: 'Desbanea a un miembro.',
  usage: '<id o nombre> [razón]',
  examples: ['unban 123456789012345678', 'unban Rogue perdón concedido'],
  cooldown: 3,
  userPermissions: ['BanMembers'],
  botPermissions: ['BanMembers'],

  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Desbanea a un miembro.')
    .addStringOption((option) =>
      option
        .setName('usuario')
        .setDescription('ID o nombre del usuario baneado.')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option.setName('razon').setDescription('Motivo del desbaneo.').setRequired(false)
    ),

  /** Sugiere usuarios de la lista de baneados. */
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    try {
      const bans = await interaction.guild.bans.fetch();
      const matches = bans
        .filter((ban) => ban.user.tag.toLowerCase().includes(focused) || ban.user.id.includes(focused))
        .map((ban) => ({ name: `${ban.user.tag} (${ban.user.id})`.slice(0, 100), value: ban.user.id }))
        .slice(0, 25);
      await interaction.respond(matches);
    } catch {
      await interaction.respond([]).catch(() => {});
    }
  },

  async execute(ctx) {
    const input = ctx.options.getString('usuario', true).trim();
    const reason = ctx.options.getString('razon') || 'Sin razón especificada';

    await ctx.defer();

    const bans = await ctx.guild.bans.fetch().catch(() => null);
    if (!bans) {
      await ctx.errorReply('No he podido leer la lista de baneados.');
      return;
    }

    // Se acepta un ID, una mención o el nombre de usuario.
    const id = extractId(input);
    const ban =
      (id && bans.get(id)) ||
      bans.find(
        (b) =>
          b.user.tag.toLowerCase() === input.toLowerCase() ||
          b.user.username.toLowerCase() === input.toLowerCase()
      );

    if (!ban) {
      await ctx.errorReply(`No he encontrado a \`${input}\` en la lista de baneados.`);
      return;
    }

    try {
      await ctx.guild.members.unban(ban.user.id, `${ctx.user.tag}: ${reason}`);
    } catch (err) {
      await ctx.errorReply(`No he podido desbanear a **${ban.user.tag}**: ${err.message}`);
      return;
    }

    // Cierra el baneo temporal si lo hubiera, para que no se reintente.
    await Case.updateMany(
      { guildId: ctx.guild.id, userId: ban.user.id, type: 'ban', active: true },
      { $set: { active: false } }
    ).catch(() => {});

    const doc = await createCase(
      ctx.guild,
      { type: 'unban', user: ban.user, moderator: ctx.user, reason },
      ctx.settings
    );

    await ctx.successReply(
      `**${ban.user.tag}** ha sido desbaneado. \`Caso #${doc.caseId}\`\n**Razón:** ${reason}`
    );
  },
};

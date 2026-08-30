'use strict';

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');
const { Member } = require('@tkbot/shared');

const embeds = require('../../utils/embeds');
const { formatNumber } = require('../../utils/time');

/** Qué campos pone a cero cada tipo de reinicio. */
const TARGETS = {
  text: { label: 'texto (XP y mensajes)', update: { xp: 0, level: 0, messages: 0 } },
  voice: { label: 'voz (minutos)', update: { voiceMinutes: 0 } },
  invites: {
    label: 'invitaciones',
    update: { 'invites.total': 0, 'invites.left': 0, 'invites.fake': 0, 'invites.bonus': 0 },
  },
  points: { label: 'puntos', update: { points: 0 } },
  all: {
    label: 'todo (XP, voz, invitaciones y puntos)',
    update: {
      xp: 0,
      level: 0,
      messages: 0,
      voiceMinutes: 0,
      'invites.total': 0,
      'invites.left': 0,
      'invites.fake': 0,
      'invites.bonus': 0,
      points: 0,
    },
  },
};

module.exports = {
  name: 'reset',
  category: 'moderation',
  aliases: ['reiniciar', 'restablecer'],
  description: 'Restablece texto/voz/invitaciones/puntos de XP para todos los miembros.',
  usage: '<text|voice|invites|points|all> [usuario]',
  examples: ['reset text', 'reset all @Rogue'],
  cooldown: 10,
  userPermissions: ['Administrator'],

  data: new SlashCommandBuilder()
    .setName('reset')
    .setDescription('Restablece las estadísticas de los miembros.')
    .addStringOption((option) =>
      option
        .setName('tipo')
        .setDescription('Qué quieres restablecer.')
        .setRequired(true)
        .addChoices(
          { name: 'Texto (XP y mensajes)', value: 'text' },
          { name: 'Voz', value: 'voice' },
          { name: 'Invitaciones', value: 'invites' },
          { name: 'Puntos', value: 'points' },
          { name: 'Todo', value: 'all' }
        )
    )
    .addUserOption((option) =>
      option
        .setName('usuario')
        .setDescription('Restablecer solo a esta persona. Vacío = todo el servidor.')
        .setRequired(false)
    ),

  async execute(ctx) {
    const type = ctx.options.getString('tipo', true).toLowerCase();
    const target = ctx.options.getUser('usuario');
    const config = TARGETS[type];

    if (!config) {
      await ctx.errorReply(
        `Tipo no válido. Usa uno de: ${Object.keys(TARGETS).map((t) => `\`${t}\``).join(', ')}`
      );
      return;
    }

    const filter = { guildId: ctx.guild.id };
    if (target) filter.userId = target.id;

    const affected = await Member.countDocuments(filter);
    if (affected === 0) {
      await ctx.errorReply('No hay datos que restablecer.');
      return;
    }

    const scope = target ? `**${target.tag}**` : `**${formatNumber(affected)}** miembros`;

    // Es una acción irreversible: se pide confirmación explícita.
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('reset:confirm')
        .setLabel('Confirmar')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('reset:cancel')
        .setLabel('Cancelar')
        .setStyle(ButtonStyle.Secondary)
    );

    await ctx.reply({
      embeds: [
        embeds.warning(
          `Vas a restablecer **${config.label}** de ${scope}.\n\n**Esta acción no se puede deshacer.**`
        ),
      ],
      components: [row],
    });

    const message = ctx.isInteraction
      ? await ctx.interaction.fetchReply().catch(() => null)
      : null;
    const anchor = message || (await ctx.channel.messages.fetch({ limit: 1 })).first();
    if (!anchor) return;

    let interaction;
    try {
      interaction = await anchor.awaitMessageComponent({
        componentType: ComponentType.Button,
        time: 30_000,
        filter: (i) => i.user.id === ctx.user.id,
      });
    } catch {
      await anchor
        .edit({ embeds: [embeds.error('Tiempo agotado. No se ha cambiado nada.')], components: [] })
        .catch(() => {});
      return;
    }

    if (interaction.customId === 'reset:cancel') {
      await interaction.update({
        embeds: [embeds.info('Operación cancelada.')],
        components: [],
      });
      return;
    }

    await interaction.deferUpdate();

    const result = await Member.updateMany(filter, { $set: config.update });

    await interaction.editReply({
      embeds: [
        embeds.success(
          `Se ha restablecido **${config.label}** en **${formatNumber(result.modifiedCount)}** registro(s).`
        ),
      ],
      components: [],
    });
  },
};

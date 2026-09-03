'use strict';

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const { COMMAND_CATEGORIES, BRAND, EMBED_COLORS, REQUIRED_PERMISSIONS } = require('@tkbot/shared');

const embeds = require('../../utils/embeds');

/** Enlaces públicos que aparecen bajo la ayuda. */
function linkRow(clientId) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const invite = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=${REQUIRED_PERMISSIONS}&scope=bot%20applications.commands`;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('Añadir a Discord').setStyle(ButtonStyle.Link).setURL(invite),
    new ButtonBuilder().setLabel('Panel de control').setStyle(ButtonStyle.Link).setURL(`${site}/dashboard`),
    new ButtonBuilder().setLabel('Comandos').setStyle(ButtonStyle.Link).setURL(`${site}/commands`)
  );

  const support = process.env.NEXT_PUBLIC_SUPPORT_INVITE;
  if (support && /^https?:\/\//.test(support)) {
    row.addComponents(
      new ButtonBuilder().setLabel('Soporte').setStyle(ButtonStyle.Link).setURL(support)
    );
  }
  return row;
}

/** Embed principal con el resumen de categorías. */
function overviewEmbed(client, prefix) {
  const counts = {};
  for (const command of client.commands.values()) {
    // Los comandos de administracion no se anuncian.
    if (command.hidden) continue;
    counts[command.category] = (counts[command.category] || 0) + 1;
  }

  const lines = Object.values(COMMAND_CATEGORIES).map(
    (category) => `${category.emoji} **${category.es}** — ${counts[category.id] || 0} comandos`
  );

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.default)
    .setAuthor({ name: `Ayuda de ${BRAND.name}`, iconURL: client.user.displayAvatarURL() })
    .setDescription(
      [
        BRAND.tagline,
        '',
        `El prefijo de este servidor es \`${prefix}\`. También puedes usar comandos de barra con \`/\`.`,
        '',
        '**Categorías**',
        ...lines,
        '',
        `Usa el menú de abajo para ver los comandos de cada categoría, o \`${prefix}help <comando>\` para el detalle de uno.`,
      ].join('\n')
    )
    .setFooter({ text: `${client.commands.filter((c) => !c.hidden).size} comandos disponibles` })
    .setTimestamp();
}

/** Embed con los comandos de una categoría. */
function categoryEmbed(client, categoryId, prefix) {
  const category = COMMAND_CATEGORIES[categoryId];
  const commands = client.commands.filter((c) => c.category === categoryId && !c.hidden);

  const description =
    commands.size === 0
      ? '*No hay comandos en esta categoría.*'
      : commands
          .map((c) => `\`${prefix}${c.name}\` — ${c.description || 'Sin descripción.'}`)
          .join('\n');

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.default)
    .setTitle(`${category?.emoji ?? '📁'} ${category?.es ?? categoryId}`)
    .setDescription(description.slice(0, 4096))
    .setFooter({ text: `${commands.size} comandos` });
}

/** Embed con el detalle de un comando concreto. */
function commandEmbed(command, prefix) {
  const category = COMMAND_CATEGORIES[command.category];

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.default)
    .setTitle(`${prefix}${command.name}`)
    .setDescription(command.description || 'Sin descripción.')
    .addFields({
      name: 'Categoría',
      value: `${category?.emoji ?? ''} ${category?.es ?? command.category}`,
      inline: true,
    });

  if (command.cooldown) {
    embed.addFields({ name: 'Espera', value: `${command.cooldown}s`, inline: true });
  }
  if (command.premium) {
    embed.addFields({ name: 'Plan', value: '💎 Premium', inline: true });
  }
  if (command.usage) {
    embed.addFields({ name: 'Uso', value: `\`${prefix}${command.name} ${command.usage}\`` });
  }
  if (command.aliases?.length) {
    embed.addFields({ name: 'Alias', value: command.aliases.map((a) => `\`${a}\``).join(', ') });
  }
  if (command.examples?.length) {
    embed.addFields({
      name: 'Ejemplos',
      value: command.examples.map((e) => `\`${prefix}${e}\``).join('\n'),
    });
  }
  if (command.userPermissions?.length) {
    const { translate } = require('../../utils/permissions');
    embed.addFields({
      name: 'Permisos necesarios',
      value: translate(command.userPermissions).join(', '),
    });
  }

  embed.setFooter({ text: '<obligatorio> · [opcional]' });
  return embed;
}

module.exports = {
  name: 'help',
  category: 'general',
  aliases: ['ayuda', 'comandos', 'h'],
  description: 'Muestra la lista de comandos y cómo usarlos.',
  usage: '[comando]',
  examples: ['help', 'help ban'],
  cooldown: 3,
  guildOnly: false,

  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Muestra la lista de comandos y cómo usarlos.')
    .addStringOption((option) =>
      option
        .setName('comando')
        .setDescription('Nombre del comando sobre el que quieres ayuda.')
        .setRequired(false)
        .setAutocomplete(true)
    ),

  /** Sugiere nombres de comandos al escribir. */
  async autocomplete(interaction, client) {
    const focused = interaction.options.getFocused().toLowerCase();
    const matches = client.commands
      .filter((c) => c.name.includes(focused) && !c.hidden)
      .map((c) => ({ name: `${c.name} — ${(c.description || '').slice(0, 60)}`, value: c.name }))
      .slice(0, 25);
    await interaction.respond(matches).catch(() => {});
  },

  async execute(ctx) {
    const prefix = ctx.prefix;
    const query = ctx.options.getString('comando');

    // ── Ayuda de un comando concreto ─────────────────────────────
    if (query) {
      const command = ctx.client.resolveCommand(query);
      if (!command) {
        await ctx.reply({
          embeds: [embeds.error(`No existe el comando \`${query}\`.`)],
        }, { ephemeral: true });
        return;
      }
      await ctx.reply({ embeds: [commandEmbed(command, prefix)] });
      return;
    }

    // ── Vista general con menú de categorías ─────────────────────
    const menu = new StringSelectMenuBuilder()
      .setCustomId('help:category')
      .setPlaceholder('Elige una categoría')
      .addOptions(
        Object.values(COMMAND_CATEGORIES).map((category) => ({
          label: category.es,
          value: category.id,
          emoji: category.emoji,
          description: `Comandos de ${category.es.toLowerCase()}`,
        }))
      );

    const message = await ctx.reply({
      embeds: [overviewEmbed(ctx.client, prefix)],
      components: [new ActionRowBuilder().addComponents(menu), linkRow(ctx.client.user.id)],
    });

    // El menú solo responde a quien pidió la ayuda, durante 2 minutos.
    const target = ctx.isInteraction ? await ctx.interaction.fetchReply().catch(() => null) : message;
    if (!target) return;

    const collector = target.createMessageComponentCollector({
      time: 120_000,
      filter: (i) => i.customId === 'help:category',
    });

    collector.on('collect', async (interaction) => {
      if (interaction.user.id !== ctx.user.id) {
        await interaction.reply({
          embeds: [embeds.error('Solo quien pidió la ayuda puede usar este menú.')],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.update({
        embeds: [categoryEmbed(ctx.client, interaction.values[0], prefix)],
      }).catch(() => {
        // El token de la interacción puede caducar entre el clic y aquí
        // (picos de latencia, reinicios); no hay nada que responder ya.
      });
    });

    collector.on('end', () => {
      // Se desactiva el menú al caducar para no dejar botones muertos.
      target.edit({ components: [linkRow(ctx.client.user.id)] }).catch(() => {});
    });
  },
};

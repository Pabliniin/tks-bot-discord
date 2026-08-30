'use strict';

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionsBitField,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
  MessageFlags,
  EmbedBuilder,
} = require('discord.js');
const { Ticket, EMBED_COLORS, parseVariables } = require('@tkbot/shared');

const embeds = require('../utils/embeds');
const logger = require('../utils/logger');

/**
 * Sistema de tickets.
 *
 * `customId` usados:
 *   ticket:open:<panelId>    botón del panel
 *   ticket:modal:<panelId>   envío del formulario
 *   ticket:close             cerrar el ticket
 *   ticket:claim             reclamar el ticket
 *   ticket:confirm           confirmar el cierre
 */

/** Botones que se colocan dentro de un ticket recién abierto. */
function ticketControls(claiming) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:close')
      .setLabel('Cerrar ticket')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger)
  );

  if (claiming) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('ticket:claim')
        .setLabel('Reclamar')
        .setEmoji('🙋')
        .setStyle(ButtonStyle.Secondary)
    );
  }
  return [row];
}

/** Permisos iniciales del canal del ticket. */
function buildPermissionOverwrites(guild, userId, supportRoles) {
  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionsBitField.Flags.ViewChannel],
    },
    {
      id: userId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.AttachFiles,
        PermissionsBitField.Flags.EmbedLinks,
      ],
    },
    {
      id: guild.members.me.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.ManageChannels,
        PermissionsBitField.Flags.ManageMessages,
        PermissionsBitField.Flags.AttachFiles,
        PermissionsBitField.Flags.EmbedLinks,
      ],
    },
  ];

  for (const roleId of supportRoles) {
    if (!guild.roles.cache.has(roleId)) continue;
    overwrites.push({
      id: roleId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.AttachFiles,
        PermissionsBitField.Flags.EmbedLinks,
      ],
    });
  }

  return overwrites;
}

/** Genera la transcripción en texto plano del canal. */
async function buildTranscript(channel) {
  const lines = [];
  let lastId = null;

  // Se recorre el historial en páginas de 100 hasta un máximo razonable.
  for (let page = 0; page < 10; page += 1) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;

    const batch = await channel.messages.fetch(options).catch(() => null);
    if (!batch || batch.size === 0) break;

    for (const [, message] of batch) {
      const time = new Date(message.createdTimestamp).toLocaleString('es-ES');
      const attachments = message.attachments.map((a) => a.url).join(' ');
      lines.push(
        `[${time}] ${message.author.tag}: ${message.content || ''}${attachments ? ` ${attachments}` : ''}`
      );
    }

    lastId = batch.last()?.id;
    if (batch.size < 100) break;
  }

  return lines.reverse().join('\n');
}

/** Crea el canal del ticket y publica el mensaje de apertura. */
async function openTicket(client, interaction, settings, panel, formAnswers = []) {
  const guild = interaction.guild;
  const user = interaction.user;
  const config = settings.tickets;

  const open = await Ticket.countDocuments({
    guildId: guild.id,
    userId: user.id,
    status: { $ne: 'closed' },
  });

  if (open >= (config.maxPerUser || 1)) {
    await interaction.editReply({
      embeds: [
        embeds.error(
          `Ya tienes **${open}** ticket(s) abierto(s). Cierra el anterior antes de abrir otro.`
        ),
      ],
    });
    return;
  }

  const categoryId = panel.categoryId || config.categoryId;
  const category = categoryId ? guild.channels.cache.get(categoryId) : null;
  const supportRoles = [...new Set([...(config.supportRoles || []), ...(panel.supportRoles || [])])];

  const number = (config.counter || 0) + 1;
  const name = parseVariables(config.nameTemplate || 'ticket-[userName]', {
    userName: user.username,
    user: user.username,
    number,
  })
    .toLowerCase()
    // Discord solo admite minúsculas, números y guiones en el nombre del canal.
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 90);

  let channel;
  try {
    channel = await guild.channels.create({
      name: name || `ticket-${number}`,
      type: ChannelType.GuildText,
      parent: category?.type === ChannelType.GuildCategory ? category.id : null,
      permissionOverwrites: buildPermissionOverwrites(guild, user.id, supportRoles),
      reason: `Ticket abierto por ${user.tag}`,
    });
  } catch (err) {
    logger.error('No se pudo crear el canal del ticket:', err.message);
    await interaction.editReply({
      embeds: [
        embeds.error(
          'No he podido crear el canal. Comprueba que tengo permiso de **Gestionar canales** y que la categoría configurada existe.'
        ),
      ],
    });
    return;
  }

  await Ticket.create({
    guildId: guild.id,
    channelId: channel.id,
    number,
    userId: user.id,
    userTag: user.tag,
    panelId: panel.id,
    status: 'open',
    formAnswers,
  });

  // El contador vive en la configuración para que el panel lo muestre.
  settings.tickets.counter = number;
  await settings.save().catch(() => {});

  const welcome = new EmbedBuilder()
    .setColor(EMBED_COLORS.default)
    .setTitle(`Ticket #${number} · ${panel.name || 'Soporte'}`)
    .setDescription(config.openMessage || 'El equipo te atenderá en breve.')
    .setTimestamp();

  if (formAnswers.length > 0) {
    welcome.addFields(
      formAnswers.map((answer) => ({
        name: answer.label.slice(0, 256),
        value: (answer.value || '*Sin respuesta*').slice(0, 1024),
      }))
    );
  }

  const mentions = [`<@${user.id}>`, ...supportRoles.map((r) => `<@&${r}>`)].join(' ');

  await channel
    .send({
      content: mentions,
      embeds: [welcome],
      components: ticketControls(config.claiming !== false),
      allowedMentions: { users: [user.id], roles: supportRoles },
    })
    .catch(() => {});

  await interaction.editReply({
    embeds: [embeds.success(`Tu ticket está listo: ${channel}`)],
  });
}

/** Cierra el ticket, guarda la transcripción y archiva o borra el canal. */
async function closeTicket(client, interaction, settings) {
  const channel = interaction.channel;
  const ticket = await Ticket.findOne({ guildId: interaction.guild.id, channelId: channel.id });

  if (!ticket || ticket.status === 'closed') {
    await interaction.editReply({ embeds: [embeds.error('Este canal no es un ticket abierto.')] });
    return;
  }

  const config = settings.tickets;
  let transcript = '';

  if (config.transcripts !== false) {
    transcript = await buildTranscript(channel).catch(() => '');
  }

  ticket.status = 'closed';
  ticket.closedBy = interaction.user.id;
  ticket.closedAt = new Date();
  ticket.transcript = transcript.slice(0, 900_000);
  await ticket.save();

  // Registro con la transcripción adjunta.
  if (config.logChannelId) {
    const logChannel = interaction.guild.channels.cache.get(config.logChannelId);
    if (logChannel?.isTextBased()) {
      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.error)
        .setTitle(`🎫 Ticket #${ticket.number} cerrado`)
        .addFields(
          { name: 'Abierto por', value: `<@${ticket.userId}>`, inline: true },
          { name: 'Cerrado por', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Canal', value: `\`${channel.name}\``, inline: true }
        )
        .setTimestamp();

      const files = [];
      if (transcript) {
        files.push(
          new AttachmentBuilder(Buffer.from(transcript, 'utf8'), {
            name: `ticket-${ticket.number}.txt`,
          })
        );
      }
      await logChannel.send({ embeds: [embed], files }).catch(() => {});
    }
  }

  await interaction.editReply({
    embeds: [embeds.success('Ticket cerrado. El canal se eliminará en 5 segundos.')],
  });

  setTimeout(async () => {
    const archive = config.archiveCategoryId
      ? interaction.guild.channels.cache.get(config.archiveCategoryId)
      : null;

    if (archive?.type === ChannelType.GuildCategory) {
      // Archivar: se mueve y se bloquea la escritura.
      await channel.setParent(archive.id, { lockPermissions: false }).catch(() => {});
      await channel.permissionOverwrites
        .edit(ticket.userId, { SendMessages: false, ViewChannel: false })
        .catch(() => {});
    } else {
      await channel.delete('Ticket cerrado').catch(() => {});
    }
  }, 5000).unref?.();
}

module.exports = {
  name: 'tickets',
  componentPrefixes: ['ticket'],

  buildTranscript,
  ticketControls,

  async handleComponent(client, interaction, settings) {
    if (!settings?.tickets?.enabled) {
      await interaction.reply({
        embeds: [embeds.error('El sistema de tickets está desactivado.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const [, action, panelId] = interaction.customId.split(':');

    // ── Abrir ticket desde el panel ──────────────────────────────
    if (action === 'open') {
      const panel = (settings.tickets.panels || []).find((p) => p.id === panelId);
      if (!panel) {
        await interaction.reply({
          embeds: [embeds.error('Este panel de tickets ya no existe.')],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Con formulario se abre un modal; sin él, se crea directamente.
      if ((panel.form || []).length > 0) {
        const modal = new ModalBuilder()
          .setCustomId(`ticket:modal:${panel.id}`)
          .setTitle((panel.name || 'Abrir ticket').slice(0, 45));

        for (const [index, field] of panel.form.slice(0, 5).entries()) {
          const input = new TextInputBuilder()
            .setCustomId(`field_${index}`)
            .setLabel(field.label.slice(0, 45))
            .setStyle(field.style === 2 ? TextInputStyle.Paragraph : TextInputStyle.Short)
            .setRequired(field.required !== false);
          if (field.placeholder) input.setPlaceholder(field.placeholder.slice(0, 100));
          modal.addComponents(new ActionRowBuilder().addComponents(input));
        }

        await interaction.showModal(modal);
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await openTicket(client, interaction, settings, panel);
      return;
    }

    // ── Envío del formulario ─────────────────────────────────────
    if (action === 'modal') {
      const panel = (settings.tickets.panels || []).find((p) => p.id === panelId);
      if (!panel) return;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const answers = (panel.form || []).slice(0, 5).map((field, index) => ({
        label: field.label,
        value: interaction.fields.getTextInputValue(`field_${index}`) || '',
      }));

      await openTicket(client, interaction, settings, panel, answers);
      return;
    }

    // ── Reclamar ─────────────────────────────────────────────────
    if (action === 'claim') {
      await interaction.deferReply();

      const ticket = await Ticket.findOne({
        guildId: interaction.guild.id,
        channelId: interaction.channel.id,
      });
      if (!ticket) {
        await interaction.editReply({ embeds: [embeds.error('Este canal no es un ticket.')] });
        return;
      }

      const supportRoles = settings.tickets.supportRoles || [];
      const isStaff =
        supportRoles.some((r) => interaction.member.roles.cache.has(r)) ||
        interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels);

      if (!isStaff) {
        await interaction.editReply({
          embeds: [embeds.error('Solo el equipo de soporte puede reclamar tickets.')],
        });
        return;
      }

      if (ticket.claimedBy) {
        await interaction.editReply({
          embeds: [embeds.warning(`Este ticket ya lo reclamó <@${ticket.claimedBy}>.`)],
        });
        return;
      }

      ticket.claimedBy = interaction.user.id;
      ticket.status = 'claimed';
      await ticket.save();

      await interaction.editReply({
        embeds: [embeds.success(`${interaction.user} se ha hecho cargo de este ticket.`)],
      });
      return;
    }

    // ── Cerrar: primero se pide confirmación ─────────────────────
    if (action === 'close') {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket:confirm')
          .setLabel('Confirmar cierre')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('ticket:cancel')
          .setLabel('Cancelar')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({
        embeds: [embeds.warning('¿Seguro que quieres cerrar este ticket?')],
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (action === 'cancel') {
      await interaction.update({
        embeds: [embeds.info('Cierre cancelado.')],
        components: [],
      });
      return;
    }

    if (action === 'confirm') {
      await interaction.deferUpdate();
      // `editReply` actúa sobre el mensaje efímero de confirmación.
      await interaction.editReply({ embeds: [embeds.info('Cerrando...')], components: [] });
      await closeTicket(client, interaction, settings);
    }
  },

  openTicket,
  closeTicket,
};

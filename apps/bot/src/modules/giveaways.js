'use strict';

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const { Giveaway, Member, EMBED_COLORS, elegirGanadores, puedeParticipar, describirRequisitos, progressFromXp } = require('@tkbot/shared');

const { discordTimestamp } = require('../utils/time');
const logger = require('../utils/logger');

/**
 * Sorteos.
 *
 * Se participa con un botón, no con una reacción. Es mejor por tres motivos:
 * el botón permite comprobar requisitos y contestar al momento por qué no
 * puedes entrar, no ensucia el mensaje, y nadie puede quitar la reacción de
 * otro para sacarlo del sorteo.
 *
 * Los sorteos viven en la base de datos porque duran días: tienen que
 * sobrevivir a un reinicio. Al arrancar se reprograman los pendientes.
 */

/** Identificador del botón de participar. */
const BOTON = 'giveaway:join';

/** Cada cuánto se buscan sorteos vencidos. */
const INTERVALO_REVISION = 30_000;

/**
 * Sorteos ya programados en memoria, para no duplicar temporizadores.
 * `messageId` → temporizador.
 */
const programados = new Map();

/** Construye el embed de un sorteo activo. */
function embedActivo(sorteo) {
  const requisitos = describirRequisitos(sorteo.requirements);

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.default)
    .setTitle(`🎉 ${sorteo.prize}`)
    .setDescription(
      [
        `Pulsa el botón para participar.`,
        '',
        `**Termina:** ${discordTimestamp(sorteo.endsAt, 'R')} (${discordTimestamp(sorteo.endsAt, 'f')})`,
        `**Ganadores:** ${sorteo.winnerCount}`,
        `**Organiza:** <@${sorteo.hostId}>`,
      ].join('\n')
    )
    .setFooter({ text: `${sorteo.entries.length} participante(s)` })
    .setTimestamp(sorteo.endsAt);

  if (requisitos.length > 0) {
    embed.addFields({ name: '📋 Requisitos', value: requisitos.map((r) => `· ${r}`).join('\n') });
  }

  return embed;
}

/** Botón de participar, con el número de participantes. */
function fila(sorteo, desactivado = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(BOTON)
      .setLabel(desactivado ? 'Sorteo terminado' : `Participar (${sorteo.entries.length})`)
      .setEmoji('🎉')
      .setStyle(desactivado ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(desactivado)
  );
}

/** Embed del resultado. */
function embedTerminado(sorteo) {
  const embed = new EmbedBuilder()
    .setColor(sorteo.winners.length > 0 ? EMBED_COLORS.success : EMBED_COLORS.neutral)
    .setTitle(`🎉 ${sorteo.prize}`)
    .setTimestamp();

  if (sorteo.winners.length === 0) {
    embed.setDescription(
      [
        '**Sorteo terminado**',
        '',
        sorteo.entries.length === 0
          ? 'No participó nadie.'
          : 'Nadie cumplía los requisitos al cerrar el sorteo.',
      ].join('\n')
    );
    return embed;
  }

  embed.setDescription(
    [
      '**Sorteo terminado**',
      '',
      `**Ganador${sorteo.winners.length > 1 ? 'es' : ''}:**`,
      sorteo.winners.map((id) => `🏆 <@${id}>`).join('\n'),
      '',
      `Entre ${sorteo.entries.length} participante(s).`,
    ].join('\n')
  );

  return embed;
}

/**
 * Comprueba los requisitos de un miembro contra un sorteo.
 * Necesita mirar el nivel en la base de datos, así que es asíncrono.
 */
async function comprobar(member, sorteo) {
  let level = 0;

  if (sorteo.requirements?.minLevel > 0) {
    const doc = await Member.findOne({ guildId: member.guild.id, userId: member.id })
      .select('xp')
      .lean()
      .catch(() => null);

    level = progressFromXp(doc?.xp || 0).level;
  }

  return puedeParticipar(
    {
      roleIds: [...member.roles.cache.keys()],
      joinedAt: member.joinedAt,
      level,
      esBot: member.user.bot,
    },
    sorteo.requirements || {}
  );
}

/**
 * Cierra un sorteo y anuncia los ganadores.
 *
 * @param {import('discord.js').Client} client
 * @param {string} messageId
 * @param {{ forzado?: boolean }} [options]
 * @returns {Promise<{ ok: boolean, motivo?: string, winners?: string[] }>}
 */
async function terminar(client, messageId, options = {}) {
  cancelarProgramado(messageId);

  const sorteo = await Giveaway.findOne({ messageId });
  if (!sorteo) return { ok: false, motivo: 'Ese sorteo ya no existe.' };
  if (sorteo.status !== 'activo') return { ok: false, motivo: 'Ese sorteo ya está cerrado.' };

  const guild = client.guilds.cache.get(sorteo.guildId);
  const canal = guild?.channels.cache.get(sorteo.channelId);

  /*
   * Se vuelven a comprobar los requisitos al cerrar. Alguien pudo participar
   * cumpliéndolos y perder el rol después: darle el premio igualmente sería
   * lo que provoca las discusiones en los sorteos.
   */
  let elegibles = sorteo.entries;

  if (guild && sorteo.entries.length > 0) {
    const validos = [];

    for (const userId of sorteo.entries) {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) continue; // Se fue del servidor.

      const check = await comprobar(member, sorteo);
      if (check.ok) validos.push(userId);
    }
    elegibles = validos;
  }

  sorteo.winners = elegirGanadores(elegibles, sorteo.winnerCount);
  sorteo.status = 'terminado';
  await sorteo.save();

  // Se edita el mensaje original para que quede el resultado a la vista.
  if (canal?.isTextBased()) {
    const mensaje = await canal.messages.fetch(messageId).catch(() => null);

    if (mensaje) {
      await mensaje
        .edit({ embeds: [embedTerminado(sorteo)], components: [fila(sorteo, true)] })
        .catch(() => {});
    }

    // Y se anuncia aparte, para que salte la notificación a los ganadores.
    const anuncio =
      sorteo.winners.length > 0
        ? `🎉 ¡Enhorabuena ${sorteo.winners.map((id) => `<@${id}>`).join(', ')}! Habéis ganado **${sorteo.prize}**.`
        : `El sorteo de **${sorteo.prize}** ha terminado sin participantes válidos.`;

    await canal
      .send({ content: anuncio, reply: { messageReference: messageId, failIfNotExists: false } })
      .catch(() => {});
  }

  logger.debug(
    `Sorteo cerrado en ${sorteo.guildId}: ${sorteo.winners.length} ganador(es)${options.forzado ? ' (forzado)' : ''}`
  );

  return { ok: true, winners: sorteo.winners };
}

/** Vuelve a sortear entre los mismos participantes. */
async function resortear(client, messageId) {
  const sorteo = await Giveaway.findOne({ messageId });
  if (!sorteo) return { ok: false, motivo: 'Ese sorteo ya no existe.' };
  if (sorteo.status !== 'terminado') {
    return { ok: false, motivo: 'Ese sorteo todavía no ha terminado.' };
  }
  if (sorteo.entries.length === 0) {
    return { ok: false, motivo: 'No hubo participantes.' };
  }

  // Se excluye a quien ya ganó: volver a sortear es para dar otra oportunidad,
  // no para que salga el mismo.
  const restantes = sorteo.entries.filter((id) => !sorteo.winners.includes(id));
  if (restantes.length === 0) {
    return { ok: false, motivo: 'Ya han ganado todos los participantes.' };
  }

  const nuevos = elegirGanadores(restantes, sorteo.winnerCount);
  sorteo.winners = [...sorteo.winners, ...nuevos];
  await sorteo.save();

  const canal = client.channels.cache.get(sorteo.channelId);
  if (canal?.isTextBased()) {
    await canal
      .send(
        `🎉 Nuevo sorteo de **${sorteo.prize}**: ¡enhorabuena ${nuevos.map((id) => `<@${id}>`).join(', ')}!`
      )
      .catch(() => {});
  }

  return { ok: true, winners: nuevos };
}

/** Programa el cierre de un sorteo. */
function programar(client, sorteo) {
  cancelarProgramado(sorteo.messageId);

  const espera = new Date(sorteo.endsAt).getTime() - Date.now();

  /*
   * `setTimeout` no admite más de 2.147.483.647 ms (unos 24,8 días): si se
   * pasa, se dispara al momento y el sorteo cerraría antes de tiempo. Los
   * sorteos más largos los recoge la revisión periódica.
   */
  const MAX_TIMEOUT = 2_147_483_000;
  if (espera > MAX_TIMEOUT) return;

  const temporizador = setTimeout(
    () => {
      terminar(client, sorteo.messageId).catch((err) => {
        logger.error('Error cerrando un sorteo:', err.message);
      });
    },
    Math.max(0, espera)
  );

  temporizador.unref?.();
  programados.set(sorteo.messageId, temporizador);
}

/** Cancela el temporizador de un sorteo. */
function cancelarProgramado(messageId) {
  const temporizador = programados.get(messageId);
  if (temporizador) {
    clearTimeout(temporizador);
    programados.delete(messageId);
  }
}

/** Cierra los sorteos que ya han vencido. */
async function revisarVencidos(client) {
  const vencidos = await Giveaway.find({ status: 'activo', endsAt: { $lte: new Date() } })
    .select('messageId')
    .lean()
    .catch(() => []);

  for (const sorteo of vencidos) {
    await terminar(client, sorteo.messageId).catch(() => {});
  }

  // Y se programan los que vencen pronto, para que cierren al segundo.
  const proximos = await Giveaway.find({
    status: 'activo',
    endsAt: { $gt: new Date(), $lte: new Date(Date.now() + 2 * INTERVALO_REVISION) },
  })
    .lean()
    .catch(() => []);

  for (const sorteo of proximos) {
    if (!programados.has(sorteo.messageId)) programar(client, sorteo);
  }
}

/**
 * Atiende el botón de participar.
 *
 * Sigue la convención de componentes del proyecto: el `customId` empieza por
 * `giveaway`, y `interactionCreate` lo reparte a este módulo por ese prefijo.
 */
async function handleComponent(client, interaction) {
  if (interaction.customId !== BOTON) return false;

  const sorteo = await Giveaway.findOne({ messageId: interaction.message.id });

  if (!sorteo || sorteo.status !== 'activo') {
    await interaction
      .reply({ content: 'Este sorteo ya ha terminado.', flags: MessageFlags.Ephemeral })
      .catch(() => {});
    return true;
  }

  // Volver a pulsar retira la participación: es lo que la gente espera.
  if (sorteo.entries.includes(interaction.user.id)) {
    sorteo.entries = sorteo.entries.filter((id) => id !== interaction.user.id);
    await sorteo.save();

    await interaction.message
      .edit({ embeds: [embedActivo(sorteo)], components: [fila(sorteo)] })
      .catch(() => {});

    await interaction
      .reply({ content: 'Has salido del sorteo.', flags: MessageFlags.Ephemeral })
      .catch(() => {});
    return true;
  }

  const check = await comprobar(interaction.member, sorteo);
  if (!check.ok) {
    await interaction
      .reply({ content: `No puedes participar: ${check.motivo}`, flags: MessageFlags.Ephemeral })
      .catch(() => {});
    return true;
  }

  sorteo.entries.push(interaction.user.id);
  await sorteo.save();

  await interaction.message
    .edit({ embeds: [embedActivo(sorteo)], components: [fila(sorteo)] })
    .catch(() => {});

  await interaction
    .reply({
      content: `¡Estás dentro! Sois ${sorteo.entries.length} participante(s).`,
      flags: MessageFlags.Ephemeral,
    })
    .catch(() => {});

  return true;
}

module.exports = {
  name: 'giveaways',
  BOTON,
  /** Prefijos de `customId` que atiende este módulo. */
  componentPrefixes: ['giveaway'],

  embedActivo,
  embedTerminado,
  fila,
  terminar,
  resortear,
  programar,
  revisarVencidos,
  handleComponent,
  comprobar,

  init(client) {
    // La revisión periódica es la red de seguridad: recoge lo que quedó
    // pendiente tras un reinicio y los sorteos demasiado largos para un
    // temporizador.
    const timer = setInterval(() => {
      revisarVencidos(client).catch((err) => {
        logger.debug(`No se pudieron revisar los sorteos: ${err.message}`);
      });
    }, INTERVALO_REVISION);

    timer.unref?.();
  },
};

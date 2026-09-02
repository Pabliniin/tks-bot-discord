'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { Giveaway } = require('@tkbot/shared');

const giveaways = require('../../modules/giveaways');
const { parseDuration, formatDuration, discordTimestamp } = require('../../utils/time');

/** Duración mínima y máxima de un sorteo. */
const MIN_DURACION = 60_000; // 1 minuto
const MAX_DURACION = 90 * 86_400_000; // 90 días

module.exports = {
  name: 'giveaway',
  category: 'giveaway',
  aliases: ['sorteo', 'gw'],
  description: 'Crea y gestiona sorteos.',
  usage: '<crear|terminar|resortear|cancelar|lista>',
  examples: [
    'giveaway crear 1d 1 Nitro de un mes',
    'giveaway terminar 123456789012345678',
    'giveaway lista',
  ],
  cooldown: 3,
  userPermissions: ['ManageGuild'],
  botPermissions: ['SendMessages', 'EmbedLinks'],

  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Crea y gestiona sorteos.')
    .addSubcommand((sub) =>
      sub
        .setName('crear')
        .setDescription('Empieza un sorteo nuevo.')
        .addStringOption((o) =>
          o
            .setName('duracion')
            .setDescription('Cuánto dura. Por ejemplo 1d, 12h, 30m.')
            .setRequired(true)
        )
        .addIntegerOption((o) =>
          o
            .setName('ganadores')
            .setDescription('Cuántos ganadores hay que sacar.')
            .setMinValue(1)
            .setMaxValue(20)
            .setRequired(true)
        )
        .addStringOption((o) =>
          o.setName('premio').setDescription('Qué se sortea.').setRequired(true)
        )
        .addChannelOption((o) =>
          o.setName('canal').setDescription('Dónde publicarlo. Por defecto, aquí.').setRequired(false)
        )
        .addRoleOption((o) =>
          o.setName('rol_necesario').setDescription('Rol obligatorio para participar.').setRequired(false)
        )
        .addIntegerOption((o) =>
          o
            .setName('dias_minimos')
            .setDescription('Días que hay que llevar en el servidor.')
            .setMinValue(0)
            .setMaxValue(3650)
            .setRequired(false)
        )
        .addIntegerOption((o) =>
          o
            .setName('nivel_minimo')
            .setDescription('Nivel mínimo para participar.')
            .setMinValue(0)
            .setMaxValue(1000)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('terminar')
        .setDescription('Cierra un sorteo antes de tiempo y sortea ya.')
        .addStringOption((o) =>
          o.setName('mensaje').setDescription('ID del mensaje del sorteo.').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('resortear')
        .setDescription('Saca otro ganador de un sorteo ya terminado.')
        .addStringOption((o) =>
          o.setName('mensaje').setDescription('ID del mensaje del sorteo.').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('cancelar')
        .setDescription('Cancela un sorteo sin sortear a nadie.')
        .addStringOption((o) =>
          o.setName('mensaje').setDescription('ID del mensaje del sorteo.').setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName('lista').setDescription('Enseña los sorteos activos.')),

  async execute(ctx) {
    const sub = ctx.options.getSubcommand();

    if (sub === 'crear') return crear(ctx);
    if (sub === 'lista') return lista(ctx);
    return gestionar(ctx, sub);
  },
};

/** Crea un sorteo y publica su mensaje. */
async function crear(ctx) {
  const duracion = parseDuration(ctx.options.getString('duracion', true));

  if (!duracion || duracion < MIN_DURACION) {
    await ctx.errorReply(
      'La duración no es válida o es muy corta. Usa formatos como `30m`, `12h` o `7d` (mínimo un minuto).'
    );
    return;
  }
  if (duracion > MAX_DURACION) {
    await ctx.errorReply('Un sorteo no puede durar más de 90 días.');
    return;
  }

  const premio = ctx.options.getString('premio', true).slice(0, 256);
  const ganadores = ctx.options.getInteger('ganadores', true);

  const canal = ctx.options.getChannel('canal') || ctx.channel;
  if (!canal.isTextBased()) {
    await ctx.errorReply('Ese canal no admite mensajes.');
    return;
  }

  const permisos = canal.permissionsFor(ctx.guild.members.me);
  if (!permisos?.has('SendMessages') || !permisos.has('EmbedLinks')) {
    await ctx.errorReply(`No tengo permiso para publicar en ${canal}.`);
    return;
  }

  await ctx.defer();

  const rolNecesario = ctx.options.getRole('rol_necesario');

  const sorteo = {
    guildId: ctx.guild.id,
    channelId: canal.id,
    prize: premio,
    winnerCount: ganadores,
    hostId: ctx.user.id,
    endsAt: new Date(Date.now() + duracion),
    entries: [],
    requirements: {
      requiredRoles: rolNecesario ? [rolNecesario.id] : [],
      blockedRoles: [],
      minAccountDays: ctx.options.getInteger('dias_minimos') || 0,
      minLevel: ctx.options.getInteger('nivel_minimo') || 0,
    },
  };

  // Se publica primero para tener el ID del mensaje, que es la clave del
  // sorteo: sin él no habría forma de asociar el botón con la base de datos.
  let mensaje;
  try {
    mensaje = await canal.send({
      embeds: [giveaways.embedActivo(sorteo)],
      components: [giveaways.fila(sorteo)],
    });
  } catch (err) {
    await ctx.errorReply(`No he podido publicar el sorteo: ${err.message}`);
    return;
  }

  try {
    const doc = await Giveaway.create({ ...sorteo, messageId: mensaje.id });
    giveaways.programar(ctx.client, doc);
  } catch (err) {
    // Si no se puede guardar, el mensaje se borra: dejar un sorteo que nadie
    // va a cerrar sería peor que no publicarlo.
    await mensaje.delete().catch(() => {});
    await ctx.errorReply(`No he podido guardar el sorteo: ${err.message}`);
    return;
  }

  await ctx.successReply(
    `🎉 Sorteo creado en ${canal}.\n**Premio:** ${premio}\n**Termina:** ${discordTimestamp(sorteo.endsAt, 'R')}\n**ID del mensaje:** \`${mensaje.id}\``
  );
}

/** Termina, resortea o cancela. */
async function gestionar(ctx, accion) {
  const messageId = ctx.options.getString('mensaje', true).trim();

  if (!/^\d{16,20}$/.test(messageId)) {
    await ctx.errorReply(
      'Ese no es un ID de mensaje válido. Actívate el modo desarrollador en Discord y copia el ID del mensaje del sorteo.'
    );
    return;
  }

  await ctx.defer();

  // Se acota por servidor: con el ID de un sorteo ajeno no se puede tocar nada.
  const sorteo = await Giveaway.findOne({ messageId, guildId: ctx.guild.id });
  if (!sorteo) {
    await ctx.errorReply('No encuentro ningún sorteo con ese ID en este servidor.');
    return;
  }

  if (accion === 'cancelar') {
    if (sorteo.status !== 'activo') {
      await ctx.errorReply('Ese sorteo ya está cerrado.');
      return;
    }

    sorteo.status = 'cancelado';
    await sorteo.save();

    const canal = ctx.guild.channels.cache.get(sorteo.channelId);
    const mensaje = await canal?.messages.fetch(messageId).catch(() => null);

    if (mensaje) {
      await mensaje
        .edit({
          embeds: [giveaways.embedTerminado({ ...sorteo.toObject(), winners: [] })],
          components: [giveaways.fila(sorteo, true)],
        })
        .catch(() => {});
    }

    await ctx.successReply(`Sorteo de **${sorteo.prize}** cancelado. No se ha sorteado a nadie.`);
    return;
  }

  const resultado =
    accion === 'terminar'
      ? await giveaways.terminar(ctx.client, messageId, { forzado: true })
      : await giveaways.resortear(ctx.client, messageId);

  if (!resultado.ok) {
    await ctx.errorReply(resultado.motivo);
    return;
  }

  await ctx.successReply(
    resultado.winners.length > 0
      ? `Sorteado. Ganador${resultado.winners.length > 1 ? 'es' : ''}: ${resultado.winners.map((id) => `<@${id}>`).join(', ')}`
      : 'El sorteo se ha cerrado, pero no había participantes válidos.'
  );
}

/** Lista los sorteos activos del servidor. */
async function lista(ctx) {
  await ctx.defer();

  const activos = await Giveaway.find({ guildId: ctx.guild.id, status: 'activo' })
    .sort({ endsAt: 1 })
    .limit(15)
    .lean();

  if (activos.length === 0) {
    await ctx.reply('No hay ningún sorteo activo. Crea uno con `giveaway crear`.');
    return;
  }

  const lineas = activos.map(
    (s) =>
      `🎉 **${s.prize}**\n` +
      `└ ${s.entries.length} participante(s) · ${s.winnerCount} ganador(es) · termina ${discordTimestamp(s.endsAt, 'R')}\n` +
      `└ \`${s.messageId}\` en <#${s.channelId}>`
  );

  await ctx.reply({
    embeds: [
      {
        title: `🎉 Sorteos activos (${activos.length})`,
        description: lineas.join('\n\n').slice(0, 4000),
        color: 5793266,
      },
    ],
  });
}

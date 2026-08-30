'use strict';

const { SlashCommandBuilder } = require('discord.js');

const { createCase } = require('../../utils/moderation');

/** Discord no permite borrar en bloque mensajes de más de 14 días. */
const MAX_AGE = 14 * 86_400_000;

module.exports = {
  name: 'clear',
  category: 'moderation',
  aliases: ['purge', 'limpiar', 'borrar'],
  description: 'Limpia los mensajes del canal.',
  usage: '<cantidad> [usuario]',
  examples: ['clear 50', 'clear 100 @Rogue'],
  cooldown: 5,
  userPermissions: ['ManageMessages'],
  botPermissions: ['ManageMessages'],

  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Limpia los mensajes del canal.')
    .addIntegerOption((option) =>
      option
        .setName('cantidad')
        .setDescription('Cuántos mensajes borrar (1-100).')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addUserOption((option) =>
      option
        .setName('usuario')
        .setDescription('Borrar solo los mensajes de esta persona.')
        .setRequired(false)
    ),

  async execute(ctx) {
    const amount = ctx.options.getInteger('cantidad', true);
    const target = ctx.options.getUser('usuario');

    await ctx.defer({ ephemeral: true });

    // Se piden más mensajes de los pedidos para poder filtrar por autor.
    const fetchLimit = target ? 100 : Math.min(amount + 1, 100);
    const messages = await ctx.channel.messages.fetch({ limit: fetchLimit }).catch(() => null);

    if (!messages) {
      await ctx.errorReply('No he podido leer los mensajes de este canal.');
      return;
    }

    const cutoff = Date.now() - MAX_AGE;
    const candidates = messages.filter((m) => {
      if (m.createdTimestamp < cutoff) return false;
      if (m.pinned) return false;
      // Al usar el comando por prefijo, no se cuenta el mensaje del comando.
      if (!ctx.isInteraction && m.id === ctx.message.id) return false;
      if (target && m.author.id !== target.id) return false;
      return true;
    });

    const toDelete = [...candidates.values()].slice(0, amount);

    if (toDelete.length === 0) {
      await ctx.errorReply(
        'No he encontrado mensajes que borrar. Recuerda que no se pueden eliminar mensajes de más de 14 días ni los fijados.'
      );
      return;
    }

    let deleted;
    try {
      deleted = await ctx.channel.bulkDelete(toDelete, true);
    } catch (err) {
      await ctx.errorReply(`No he podido borrar los mensajes: ${err.message}`);
      return;
    }

    // El comando por prefijo deja su propio mensaje: se limpia aparte.
    if (!ctx.isInteraction && ctx.message.deletable) {
      await ctx.message.delete().catch(() => {});
    }

    await createCase(
      ctx.guild,
      {
        type: 'clear',
        user: target || ctx.user,
        moderator: ctx.user,
        reason: `${deleted.size} mensaje(s) eliminados en #${ctx.channel.name}`,
      },
      ctx.settings
    ).catch(() => {});

    const suffix = target ? ` de **${target.tag}**` : '';
    const notice = await ctx.reply(
      { embeds: [require('../../utils/embeds').success(`Se han borrado **${deleted.size}** mensaje(s)${suffix}.`)] },
      { ephemeral: true }
    );

    // En prefijo el aviso se queda en el canal: se borra a los 5 segundos.
    if (!ctx.isInteraction && notice?.deletable) {
      setTimeout(() => notice.delete().catch(() => {}), 5000).unref?.();
    }
  },
};

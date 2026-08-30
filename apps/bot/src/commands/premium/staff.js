'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { EMBED_COLORS } = require('@tkbot/shared');

const botStaff = require('../../utils/botStaff');
const { discordTimestamp } = require('../../utils/time');
const logger = require('../../utils/logger');

/**
 * Gestión del personal del bot.
 *
 * Solo los dueños (`BOT_OWNERS` en la configuración) pueden usarlo. El personal
 * que nombren aquí podrá repartir premium con el comando `premium`, pero no
 * podrá tocar esta lista: así, aunque una cuenta del personal se vea
 * comprometida, no puede darse más permisos ni destituir al dueño.
 */
module.exports = {
  name: 'staff',
  category: 'premium',
  aliases: ['personal', 'equipo'],
  description: 'Gestiona quién puede repartir premium con el comando premium.',
  usage: '<add|remove|list> [usuario]',
  examples: ['staff add @Amigo', 'staff remove @Amigo', 'staff list'],
  cooldown: 3,
  // No aparece en la web publica ni en /help: es de administracion.
  hidden: true,
  guildOnly: false,
  // Solo los dueños del bot.
  ownerOnly: true,

  data: new SlashCommandBuilder()
    .setName('staff')
    .setDescription('Gestiona quién puede repartir premium.')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Permite a alguien repartir premium.')
        .addUserOption((option) =>
          option.setName('usuario').setDescription('A quién.').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Retira a alguien el permiso de repartir premium.')
        .addUserOption((option) =>
          option.setName('usuario').setDescription('A quién.').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('Muestra quién puede repartir premium.')
    ),

  async execute(ctx) {
    const sub = ctx.options.getSubcommand();

    // ── Ver la lista ─────────────────────────────────────────────
    if (sub === 'list') {
      await ctx.defer({ ephemeral: true });

      const duenos = botStaff.ownerIds();
      const personal = await botStaff.listStaff();

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.default)
        .setTitle('Personal de TK$ Bot')
        .setTimestamp();

      embed.addFields({
        name: `👑 Dueños (${duenos.length})`,
        value:
          duenos.length > 0
            ? duenos.map((id) => `<@${id}> · \`${id}\``).join('\n')
            : '*Ninguno. Pon tu ID en `BOT_OWNERS` y reinicia el bot.*',
      });

      if (personal.length === 0) {
        embed.addFields({
          name: '🛡️ Personal (0)',
          value: `*Nadie todavía. Usa \`${ctx.prefix}staff add @usuario\` para añadir a alguien.*`,
        });
      } else {
        // Se resuelve el nombre de cada uno; si la cuenta ya no existe, se
        // muestra igualmente el ID para poder retirarlo.
        const lineas = [];
        for (const doc of personal) {
          const usuario = await ctx.client.users.fetch(doc.userId).catch(() => null);
          const nombre = usuario ? usuario.tag : 'Usuario desconocido';
          const desde = doc.botStaff?.addedAt
            ? ` · desde ${discordTimestamp(doc.botStaff.addedAt, 'R')}`
            : '';
          lineas.push(`<@${doc.userId}> — ${nombre}${desde}`);
        }

        embed.addFields({
          name: `🛡️ Personal (${personal.length})`,
          value: lineas.join('\n').slice(0, 1024),
        });
      }

      embed.setFooter({
        text: 'Los dueños se cambian en BOT_OWNERS. El personal, con este comando.',
      });

      await ctx.reply({ embeds: [embed] }, { ephemeral: true });
      return;
    }

    // ── Añadir o retirar ─────────────────────────────────────────
    const objetivo = ctx.options.getUser('usuario', true);

    if (objetivo.bot) {
      await ctx.errorReply('Los bots no pueden formar parte del personal.');
      return;
    }

    await ctx.defer({ ephemeral: true });

    if (sub === 'add') {
      const resultado = await botStaff.addStaff(objetivo.id, ctx.user.id);

      if (!resultado.ok) {
        await ctx.errorReply(resultado.message);
        return;
      }

      logger.module('staff', `${ctx.user.tag} añadió a ${objetivo.tag} al personal`);

      await ctx.reply(
        {
          embeds: [
            require('../../utils/embeds').success(
              `${objetivo} ya forma parte del personal.\n\nAhora puede usar \`${ctx.prefix}premium\` para conceder y retirar suscripciones, pero **no** puede modificar esta lista.`
            ),
          ],
        },
        { ephemeral: true }
      );

      // Aviso por privado, si lo tiene abierto.
      await objetivo
        .send({
          embeds: [
            new EmbedBuilder()
              .setColor(EMBED_COLORS.success)
              .setTitle('Ahora eres parte del personal de TK$ Bot')
              .setDescription(
                'Ya puedes usar el comando `/premium` para conceder y retirar suscripciones premium a los servidores.\n\nUsa `/premium list` para ver los que ya tienen.'
              )
              .setTimestamp(),
          ],
        })
        .catch(() => {});
      return;
    }

    const resultado = await botStaff.removeStaff(objetivo.id);

    if (!resultado.ok) {
      await ctx.errorReply(resultado.message);
      return;
    }

    logger.module('staff', `${ctx.user.tag} retiró a ${objetivo.tag} del personal`);

    await ctx.reply(
      {
        embeds: [
          require('../../utils/embeds').success(
            `${objetivo} ya no forma parte del personal y no puede repartir premium.`
          ),
        ],
      },
      { ephemeral: true }
    );
  },
};

'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const {
  User,
  Guild,
  getGuildSettings,
  premiumStatus,
  userPremiumTier,
  maxGuildsFor,
  canApplyToGuild,
  EMBED_COLORS,
} = require('@tkbot/shared');

const { parseDuration, formatDuration, discordTimestamp } = require('../../utils/time');
const embeds = require('../../utils/embeds');
const logger = require('../../utils/logger');

/**
 * Premium de usuario.
 *
 * Es lo que alguien compra o recibe. Por sí solo no desbloquea nada: hay que
 * activarlo en un servidor con `activar`, y entonces se copia al premium de
 * ese servidor. Así una persona puede mover su premium de un sitio a otro.
 *
 * Repartirlo (`add` / `remove`) es cosa del personal del bot. Activarlo y
 * quitarlo de un servidor lo hace el propio dueño de la suscripción.
 */
module.exports = {
  name: 'premiumuser',
  category: 'premium',
  aliases: ['pu', 'premiumusuario'],
  description: 'Gestiona el premium personal de los usuarios.',
  usage: '<add|remove|info|activar|desactivar> [usuario] [nivel] [duración]',
  examples: [
    'premiumuser add @Rogue 2 365d',
    'premiumuser info',
    'premiumuser activar',
    'premiumuser desactivar',
  ],
  cooldown: 3,
  hidden: true,
  guildOnly: false,
  // El acceso cambia segun el subcomando, asi que se explica aparte en la guia.
  accessNote:
    '`add` y `remove`, solo el personal del bot. `info`, `activar` y `desactivar`, cualquiera sobre su propia suscripcion.',

  data: new SlashCommandBuilder()
    .setName('premiumuser')
    .setDescription('Gestiona el premium personal de los usuarios.')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('[Personal] Concede premium personal a alguien.')
        .addUserOption((option) =>
          option.setName('usuario').setDescription('A quién.').setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('nivel')
            .setDescription('Nivel de premium.')
            .setRequired(true)
            .addChoices({ name: 'Premium 1', value: 1 }, { name: 'Premium 2', value: 2 })
        )
        .addStringOption((option) =>
          option
            .setName('duracion')
            .setDescription('Cuánto dura: 30d, 1año… Vacío = para siempre.')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('[Personal] Retira el premium personal de alguien.')
        .addUserOption((option) =>
          option.setName('usuario').setDescription('A quién.').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('info')
        .setDescription('Consulta un premium personal.')
        .addUserOption((option) =>
          option
            .setName('usuario')
            .setDescription('De quién. Vacío = el tuyo.')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('activar')
        .setDescription('Activa tu premium personal en este servidor.')
    )
    .addSubcommand((sub) =>
      sub
        .setName('desactivar')
        .setDescription('Quita tu premium personal de este servidor.')
    ),

  async execute(ctx) {
    const sub = ctx.options.getSubcommand();
    const { isStaff } = require('../../utils/botStaff');

    // `add` y `remove` son de administración; el resto lo usa cualquiera
    // sobre su propia suscripción.
    if (['add', 'remove'].includes(sub) && !(await isStaff(ctx.user.id))) {
      await ctx.errorReply('Solo el personal de TK$ Bot puede repartir premium.');
      return;
    }

    await ctx.defer({ ephemeral: true });

    // ── Consultar ────────────────────────────────────────────────
    if (sub === 'info') {
      const objetivo = ctx.options.getUser('usuario') || ctx.user;

      // Solo el personal puede mirar el premium de otra persona.
      if (objetivo.id !== ctx.user.id && !(await isStaff(ctx.user.id))) {
        await ctx.errorReply('Solo puedes consultar tu propia suscripción.');
        return;
      }

      const doc = await User.findOne({ userId: objetivo.id }).lean();
      const estado = premiumStatus(doc?.premium);
      const aplicados = doc?.premium?.guilds || [];

      const embed = new EmbedBuilder()
        .setColor(estado.active ? EMBED_COLORS.warning : EMBED_COLORS.neutral)
        .setAuthor({ name: objetivo.tag, iconURL: objetivo.displayAvatarURL() })
        .setTitle(estado.active ? `💎 ${estado.name}` : 'Sin premium personal')
        .addFields({
          name: 'Estado',
          value: estado.active
            ? estado.permanent
              ? 'Activo, sin caducidad'
              : `Activo · caduca ${discordTimestamp(estado.until, 'R')}`
            : estado.expired
              ? `Caducado (tenía nivel ${estado.storedTier})`
              : 'No tiene ninguna suscripción',
          inline: false,
        })
        .setTimestamp();

      if (estado.active) {
        const max = maxGuildsFor(estado.tier);
        embed.addFields({
          name: `Servidores activados (${aplicados.length}/${max})`,
          value:
            aplicados.length > 0
              ? aplicados
                  .map((id) => {
                    const g = ctx.client.guilds.cache.get(id);
                    return `· ${g ? g.name : 'Servidor desconocido'} — \`${id}\``;
                  })
                  .join('\n')
              : '*Ninguno todavía. Usa `/premiumuser activar` en el servidor que quieras.*',
        });
      }

      await ctx.reply({ embeds: [embed] }, { ephemeral: true });
      return;
    }

    // ── Activar / desactivar en el servidor actual ───────────────
    if (sub === 'activar' || sub === 'desactivar') {
      if (!ctx.guild) {
        await ctx.errorReply('Este subcomando hay que usarlo dentro del servidor.');
        return;
      }

      const doc = await User.findOneAndUpdate(
        { userId: ctx.user.id },
        { $setOnInsert: { userId: ctx.user.id } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      if (sub === 'desactivar') {
        const aplicados = doc.premium?.guilds || [];
        if (!aplicados.includes(ctx.guild.id)) {
          await ctx.errorReply('No tienes tu premium activado en este servidor.');
          return;
        }

        await User.updateOne({ userId: ctx.user.id }, { $pull: { 'premium.guilds': ctx.guild.id } });

        const settings = await getGuildSettings(ctx.guild.id);
        // Solo se retira si el premium venía de esta persona.
        if (settings.premium?.grantedBy === ctx.user.id) {
          settings.set('premium', { tier: 0, until: null, grantedBy: null });
          await settings.save();
          ctx.client.settings.invalidate(ctx.guild.id);
        }

        await ctx.reply(
          {
            embeds: [
              embeds.success(
                `Has quitado tu premium de **${ctx.guild.name}**. Ya puedes activarlo en otro servidor.`
              ),
            ],
          },
          { ephemeral: true }
        );
        return;
      }

      const permiso = canApplyToGuild(doc, ctx.guild.id);
      if (!permiso.ok) {
        await ctx.errorReply(permiso.reason);
        return;
      }

      const estado = premiumStatus(doc.premium);
      const settings = await getGuildSettings(ctx.guild.id);

      // Si el servidor ya tiene un premium mejor, no se pisa.
      const actual = premiumStatus(settings.premium);
      if (actual.tier > estado.tier) {
        await ctx.errorReply(
          `Este servidor ya tiene **${actual.name}**, que es mejor que tu **${estado.name}**.`
        );
        return;
      }

      settings.set('premium', {
        tier: estado.tier,
        until: estado.until ? new Date(estado.until) : null,
        grantedBy: ctx.user.id,
      });
      await settings.save();
      ctx.client.settings.invalidate(ctx.guild.id);

      await User.updateOne(
        { userId: ctx.user.id },
        { $addToSet: { 'premium.guilds': ctx.guild.id } }
      );

      logger.module('prem', `${ctx.user.tag} activó su premium en ${ctx.guild.id}`);

      await ctx.reply(
        {
          embeds: [
            embeds.success(
              `**${ctx.guild.name}** ahora tiene **${estado.name}**, gracias a tu suscripción.\n\nUsas ${permiso.used + 1} de ${permiso.max} servidor(es).`
            ),
          ],
        },
        { ephemeral: true }
      );
      return;
    }

    // ── Repartir (solo personal) ─────────────────────────────────
    const objetivo = ctx.options.getUser('usuario', true);

    if (objetivo.bot) {
      await ctx.errorReply('Los bots no pueden tener premium.');
      return;
    }

    if (sub === 'remove') {
      const doc = await User.findOne({ userId: objetivo.id }).lean();
      if (!doc || (doc.premium?.tier || 0) === 0) {
        await ctx.errorReply(`**${objetivo.tag}** no tiene premium personal.`);
        return;
      }

      // Se retira también de los servidores donde lo tuviera activado.
      const aplicados = doc.premium?.guilds || [];
      for (const guildId of aplicados) {
        const settings = await getGuildSettings(guildId).catch(() => null);
        if (settings && settings.premium?.grantedBy === objetivo.id) {
          settings.set('premium', { tier: 0, until: null, grantedBy: null });
          await settings.save().catch(() => {});
          ctx.client.settings.invalidate(guildId);
        }
      }

      await User.updateOne(
        { userId: objetivo.id },
        { $set: { 'premium.tier': 0, 'premium.until': null, 'premium.guilds': [] } }
      );

      logger.module('prem', `${ctx.user.tag} retiró el premium personal de ${objetivo.tag}`);

      await ctx.reply(
        {
          embeds: [
            embeds.success(
              `Retirado el premium personal de **${objetivo.tag}**${aplicados.length ? ` y de ${aplicados.length} servidor(es) donde lo tenía activado` : ''}.`
            ),
          ],
        },
        { ephemeral: true }
      );
      return;
    }

    // add
    const nivel = ctx.options.getInteger('nivel', true);
    const duracionTexto = ctx.options.getString('duracion');

    let until = null;
    if (duracionTexto) {
      const ms = parseDuration(duracionTexto);
      if (ms === null) {
        await ctx.errorReply('Duración no válida. Usa `30d`, `6meses`, `1año`… o déjala vacía.');
        return;
      }
      until = new Date(Date.now() + ms);
    }

    await User.updateOne(
      { userId: objetivo.id },
      {
        $set: { 'premium.tier': nivel, 'premium.until': until },
        $setOnInsert: { userId: objetivo.id },
      },
      { upsert: true }
    );

    logger.module(
      'prem',
      `${ctx.user.tag} dio Premium ${nivel} personal a ${objetivo.tag}${until ? ` hasta ${until.toISOString()}` : ' (permanente)'}`
    );

    const max = maxGuildsFor(nivel);
    const site = process.env.NEXT_PUBLIC_SITE_URL || '';

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.success)
      .setTitle('💎 Premium personal concedido')
      .setDescription(`**${objetivo.tag}** ya tiene premium personal.`)
      .addFields(
        { name: 'Nivel', value: `Premium ${nivel}`, inline: true },
        {
          name: 'Duración',
          value: until
            ? `${formatDuration(until - Date.now())}\nHasta ${discordTimestamp(until, 'D')}`
            : 'Para siempre',
          inline: true,
        },
        { name: 'Servidores que puede activar', value: String(max), inline: true }
      )
      .setTimestamp();

    await ctx.reply({ embeds: [embed] }, { ephemeral: true });

    // Aviso por privado explicando cómo usarlo.
    await objetivo
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor(EMBED_COLORS.warning)
            .setTitle('💎 Has recibido TK$ Premium')
            .setDescription(
              [
                `Tienes **Premium ${nivel}**${until ? `, hasta el ${until.toLocaleDateString('es-ES')}` : ', sin caducidad'}.`,
                '',
                `Puedes activarlo en hasta **${max} servidor(es)**. Entra en el servidor que quieras y escribe:`,
                '```/premiumuser activar```',
                site ? `También puedes gestionarlo desde ${site}/premium` : '',
              ]
                .filter(Boolean)
                .join('\n')
            )
            .setTimestamp(),
        ],
      })
      .catch(() => {});
  },
};

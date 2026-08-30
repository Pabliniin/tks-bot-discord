'use strict';

const { Events, EmbedBuilder } = require('discord.js');
const { getGuildSettings, EMBED_COLORS, BRAND } = require('@tkbot/shared');

const logger = require('../utils/logger');

/** Entrada y salida del bot en servidores. */

module.exports = [
  {
    name: Events.GuildCreate,
    async execute(client, guild) {
      logger.module('guild', `Añadido a ${guild.name} (${guild.id}) · ${guild.memberCount} miembros`);

      // Crea la configuración por defecto para que el panel la encuentre.
      await getGuildSettings(guild.id).catch((err) => {
        logger.error(`No se pudo crear la configuración de ${guild.id}:`, err.message);
      });

      // Cachea las invitaciones para el seguimiento desde el primer momento.
      const invites = client.modules.get('invites');
      if (invites) await invites.refresh(guild).catch(() => {});

      // Mensaje de presentación en el primer canal donde se pueda escribir.
      const channel =
        guild.systemChannel ||
        guild.channels.cache.find(
          (c) => c.isTextBased() && c.permissionsFor(guild.members.me)?.has('SendMessages')
        );
      if (!channel) return;

      const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/dashboard/${guild.id}`;

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.default)
        .setTitle(`¡Gracias por añadir ${BRAND.name}!`)
        .setDescription(
          [
            'Ya está todo listo para empezar.',
            '',
            `· Usa \`-help\` o \`/help\` para ver todos los comandos.`,
            `· Configura los módulos desde el [panel de control](${dashboardUrl}).`,
            '· El prefijo por defecto es `-` y puedes cambiarlo en el panel.',
          ].join('\n')
        )
        .setFooter({ text: BRAND.tagline.slice(0, 2048) })
        .setTimestamp();

      await channel.send({ embeds: [embed] }).catch(() => {});
    },
  },

  {
    name: Events.GuildDelete,
    async execute(client, guild) {
      logger.module('guild', `Expulsado de ${guild.name || 'desconocido'} (${guild.id})`);
      // La configuración se conserva por si el bot vuelve a ser invitado.
      client.settings.invalidate(guild.id);
    },
  },
];

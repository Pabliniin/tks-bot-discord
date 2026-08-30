'use strict';

const { Events } = require('discord.js');
const logs = require('../modules/logs');
const logger = require('../utils/logger');

module.exports = {
  name: Events.VoiceStateUpdate,

  async execute(client, oldState, newState) {
    const guild = newState.guild || oldState.guild;
    if (!guild) return;

    let settings;
    try {
      settings = await client.settings.get(guild.id);
    } catch {
      return;
    }

    // ── Canales temporales ───────────────────────────────────────
    const temp = client.modules.get('tempchannels');
    if (temp) {
      await temp.handleVoiceState(client, oldState, newState, settings).catch((err) => {
        logger.error('Error en canales temporales:', err.message);
      });
    }

    // ── Seguimiento para el XP de voz ────────────────────────────
    const levels = client.modules.get('levels');
    if (levels?.handleVoiceState) levels.handleVoiceState(client, oldState, newState);

    // ── Registros ────────────────────────────────────────────────
    const member = newState.member || oldState.member;
    if (!member || logs.isIgnoredMember(settings, member)) return;

    const from = oldState.channel;
    const to = newState.channel;

    if (!from && to) {
      if (logs.isIgnoredChannel(settings, to)) return;
      const embed = logs
        .baseEmbed({ title: '🔊 Entró a voz', color: 'success', user: member.user })
        .addFields({ name: 'Canal', value: `${to}`, inline: true });
      await logs.send(guild, settings, 'voiceJoin', embed);
      return;
    }

    if (from && !to) {
      if (logs.isIgnoredChannel(settings, from)) return;
      const embed = logs
        .baseEmbed({ title: '🔇 Salió de voz', color: 'error', user: member.user })
        .addFields({ name: 'Canal', value: `${from}`, inline: true });
      await logs.send(guild, settings, 'voiceLeave', embed);
      return;
    }

    if (from && to && from.id !== to.id) {
      if (logs.isIgnoredChannel(settings, from) || logs.isIgnoredChannel(settings, to)) return;
      const embed = logs
        .baseEmbed({ title: '🔀 Cambió de canal de voz', color: 'warning', user: member.user })
        .addFields(
          { name: 'Desde', value: `${from}`, inline: true },
          { name: 'Hasta', value: `${to}`, inline: true }
        );
      await logs.send(guild, settings, 'voiceMove', embed);
    }
  },
};

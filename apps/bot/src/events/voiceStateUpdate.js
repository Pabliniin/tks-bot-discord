'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const logs = require('../modules/logs');
const logger = require('../utils/logger');

/**
 * Cambios en los canales de voz.
 *
 * Distingue lo que hace el propio miembro (entrar, salir, cambiarse) de lo que
 * le hace un moderador (moverlo, desconectarlo, silenciarlo), y en ese caso
 * indica quién ha sido.
 */
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

    // ── Silencio y ensordecimiento del servidor ──────────────────
    // `serverMute` lo aplica un moderador; `selfMute` lo hace el propio miembro.
    if (oldState.serverMute !== newState.serverMute || oldState.serverDeaf !== newState.serverDeaf) {
      const { executor, reason, unavailable } = await logs.findAuditEntry(
        guild,
        AuditLogEvent.MemberUpdate,
        member.id,
        {
          match: (entry) => entry.changes?.some((c) => c.key === 'mute' || c.key === 'deaf'),
        }
      );

      const acciones = [];
      if (oldState.serverMute !== newState.serverMute) {
        acciones.push(newState.serverMute ? 'silenciado' : 'sin silencio');
      }
      if (oldState.serverDeaf !== newState.serverDeaf) {
        acciones.push(newState.serverDeaf ? 'ensordecido' : 'sin ensordecer');
      }

      const activando = newState.serverMute || newState.serverDeaf;

      const embed = logs.actionEmbed({
        title: activando
          ? '🎙️ Ha silenciado a un miembro en voz'
          : '🎙️ Ha quitado el silencio de voz',
        color: activando ? 'warning' : 'success',
        executor,
        target: member.user,
        auditUnavailable: unavailable,
        fields: [
          { name: 'Estado', value: acciones.join(' · '), inline: true },
          { name: 'Canal', value: to ? `${to}` : '*fuera de voz*', inline: true },
          ...(reason ? [{ name: '📝 Razón', value: reason.slice(0, 1024) }] : []),
        ],
      });

      await logs.send(guild, settings, 'voiceMove', embed);
    }

    // ── Entrada ──────────────────────────────────────────────────
    if (!from && to) {
      if (logs.isIgnoredChannel(settings, to)) return;

      const embed = logs.actionEmbed({
        title: '🔊 Ha entrado a un canal de voz',
        color: 'success',
        executor: member.user,
        detail: `Se ha conectado a ${to}.`,
        fields: [{ name: 'Canal', value: `${to}`, inline: true }],
      });

      await logs.send(guild, settings, 'voiceJoin', embed);
      return;
    }

    // ── Salida (voluntaria o desconectado por un moderador) ──────
    if (from && !to) {
      if (logs.isIgnoredChannel(settings, from)) return;

      // `MemberDisconnect` no guarda a quién se desconectó, solo cuántos,
      // así que se busca sin filtrar por destinatario.
      const { executor, unavailable } = await logs.findAuditEntry(
        guild,
        AuditLogEvent.MemberDisconnect,
        null
      );

      // Si el autor es el propio miembro, se fue por su cuenta.
      const expulsado = executor && executor.id !== member.id;

      const embed = logs.actionEmbed({
        title: expulsado
          ? '🔇 Ha desconectado a un miembro de voz'
          : '🔇 Ha salido de un canal de voz',
        color: expulsado ? 'warning' : 'error',
        executor: expulsado ? executor : member.user,
        target: expulsado ? member.user : null,
        auditUnavailable: expulsado ? unavailable : false,
        detail: expulsado ? null : `Se ha desconectado de ${from}.`,
        fields: [{ name: 'Canal', value: `${from}`, inline: true }],
      });

      await logs.send(guild, settings, 'voiceLeave', embed);
      return;
    }

    // ── Cambio de canal (por su cuenta o movido por un moderador) ─
    if (from && to && from.id !== to.id) {
      if (logs.isIgnoredChannel(settings, from) || logs.isIgnoredChannel(settings, to)) return;

      const { executor, unavailable } = await logs.findAuditEntry(
        guild,
        AuditLogEvent.MemberMove,
        null,
        // La entrada guarda el canal de destino: sirve para confirmarla.
        { match: (entry) => !entry.extra?.channel || entry.extra.channel.id === to.id }
      );

      const movido = executor && executor.id !== member.id;

      const embed = logs.actionEmbed({
        title: movido ? '🔀 Ha movido a un miembro de canal' : '🔀 Ha cambiado de canal de voz',
        color: 'warning',
        executor: movido ? executor : member.user,
        target: movido ? member.user : null,
        auditUnavailable: movido ? unavailable : false,
        fields: [
          { name: 'Desde', value: `${from}`, inline: true },
          { name: 'Hasta', value: `${to}`, inline: true },
        ],
      });

      await logs.send(guild, settings, 'voiceMove', embed);
    }
  },
};

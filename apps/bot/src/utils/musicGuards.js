'use strict';

const music = require('../modules/music');

/**
 * Comprobaciones comunes de los comandos de música.
 *
 * Las trece órdenes repiten casi siempre las mismas preguntas: ¿hay servidor
 * de música?, ¿está el módulo activo?, ¿estás en un canal de voz?, ¿en el mío?
 * Tenerlas aquí evita repetirlas y, sobre todo, evita que una se olvide en un
 * comando y deje un hueco.
 *
 * Cada función devuelve `{ ok: true, ... }` o `{ ok: false, motivo }`, para que
 * el comando responda y salga.
 */

/**
 * El sistema de música está listo y activado en este servidor.
 * @param {import('../structures/CommandContext')} ctx
 */
function servicioListo(ctx) {
  if (ctx.settings?.music?.enabled === false) {
    return { ok: false, motivo: 'El módulo de música está desactivado en este servidor.' };
  }

  if (!music.disponible()) {
    return { ok: false, motivo: music.motivoNoDisponible() };
  }

  return { ok: true };
}

/**
 * Quien escribe está en un canal de voz, y el bot puede entrar.
 *
 * @param {import('../structures/CommandContext')} ctx
 * @returns {{ ok: true, canal: object } | { ok: false, motivo: string }}
 */
function enCanalDeVoz(ctx) {
  const canal = ctx.member?.voice?.channel;

  if (!canal) {
    return { ok: false, motivo: 'Tienes que estar en un canal de voz para usar esto.' };
  }

  // Lista blanca de canales, si el servidor la ha configurado.
  const permitidos = ctx.settings?.music?.allowedVoiceChannels || [];
  if (permitidos.length > 0 && !permitidos.includes(canal.id)) {
    return {
      ok: false,
      motivo: `La música solo se puede usar en: ${permitidos.map((c) => `<#${c}>`).join(', ')}`,
    };
  }

  const permisos = canal.permissionsFor(ctx.guild.members.me);
  if (!permisos?.has('Connect')) {
    return { ok: false, motivo: `No tengo permiso para entrar en ${canal}.` };
  }
  if (!permisos.has('Speak')) {
    return { ok: false, motivo: `No tengo permiso para hablar en ${canal}.` };
  }

  // Un canal lleno con límite de usuarios no admite a nadie más.
  if (canal.userLimit > 0 && canal.members.size >= canal.userLimit && !permisos.has('MoveMembers')) {
    return { ok: false, motivo: `${canal} está lleno y no puedo entrar.` };
  }

  return { ok: true, canal };
}

/**
 * Hay algo sonando y quien escribe está en el mismo canal que el bot.
 *
 * Es la comprobación de casi todos los comandos de control: dejar que alguien
 * pause la música desde otro canal, o desde el chat sin estar en voz, es la
 * forma más rápida de que la gente se pelee.
 *
 * @param {import('../structures/CommandContext')} ctx
 * @param {{ exigirCancion?: boolean }} [options]
 * @returns {{ ok: true, cola: object } | { ok: false, motivo: string }}
 */
function colaActiva(ctx, options = {}) {
  const listo = servicioListo(ctx);
  if (!listo.ok) return listo;

  const cola = music.getCola(ctx.guild.id);
  if (!cola) {
    return { ok: false, motivo: 'No estoy reproduciendo nada ahora mismo.' };
  }

  if (options.exigirCancion !== false && !cola.current) {
    return { ok: false, motivo: 'No hay ninguna canción sonando.' };
  }

  const canalUsuario = ctx.member?.voice?.channelId;
  if (canalUsuario !== cola.voiceChannelId) {
    return {
      ok: false,
      motivo: `Tienes que estar en <#${cola.voiceChannelId}> para controlar la música.`,
    };
  }

  return { ok: true, cola };
}

/**
 * Quien escribe tiene mando sobre la reproducción.
 *
 * Con `djOnly` activado hace falta el rol de DJ para cualquier control. Sin él,
 * cualquiera puede tocar la cola, que es lo razonable en un servidor pequeño.
 *
 * @param {import('../structures/CommandContext')} ctx
 * @param {object} [cola]
 * @returns {{ ok: true } | { ok: false, motivo: string }}
 */
function puedeControlar(ctx, cola = null) {
  if (!ctx.settings?.music?.djOnly) return { ok: true };

  if (music.esDj(ctx.member, ctx.settings, cola)) return { ok: true };

  const rol = ctx.settings.music.djRoleId;
  return {
    ok: false,
    motivo: rol
      ? `Solo quien tenga el rol <@&${rol}> puede controlar la música aquí.`
      : 'Solo quien pueda gestionar el servidor puede controlar la música aquí.',
  };
}

/**
 * Se puede pedir música desde este canal de texto.
 * @param {import('../structures/CommandContext')} ctx
 */
function canalPermitido(ctx) {
  const permitidos = ctx.settings?.music?.commandChannels || [];
  if (permitidos.length === 0) return { ok: true };

  if (permitidos.includes(ctx.channel?.id)) return { ok: true };

  return {
    ok: false,
    motivo: `Los comandos de música solo funcionan en: ${permitidos.map((c) => `<#${c}>`).join(', ')}`,
  };
}

module.exports = { servicioListo, enCanalDeVoz, colaActiva, puedeControlar, canalPermitido };

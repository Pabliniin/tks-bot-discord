'use strict';

const { SlashCommandBuilder } = require('discord.js');

const guards = require('../../utils/musicGuards');

module.exports = {
  name: 'clearqueue',
  category: 'music',
  // No se llama `clear` porque ese nombre ya lo usa el borrado de mensajes.
  aliases: ['cq', 'vaciarcola', 'vaciar'],
  description: 'Vacía la cola sin parar lo que está sonando.',
  usage: '',
  examples: ['clearqueue'],
  cooldown: 3,

  data: new SlashCommandBuilder()
    .setName('clearqueue')
    .setDescription('Vacía la cola sin parar lo que está sonando.'),

  async execute(ctx) {
    const activa = guards.colaActiva(ctx, { exigirCancion: false });
    if (!activa.ok) {
      await ctx.errorReply(activa.motivo);
      return;
    }

    const control = guards.puedeControlar(ctx, activa.cola);
    if (!control.ok) {
      await ctx.errorReply(control.motivo);
      return;
    }

    const { cola } = activa;

    if (cola.tracks.length === 0) {
      await ctx.errorReply('La cola ya estaba vacía.');
      return;
    }

    const total = cola.tracks.length;
    cola.tracks = [];

    await ctx.successReply(
      `🗑️ Cola vaciada: ${total} canción(es) descartadas.\nLo que suena ahora sigue sonando.`
    );
  },
};

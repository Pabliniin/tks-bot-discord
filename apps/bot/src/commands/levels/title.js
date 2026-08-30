'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { User } = require('@tkbot/shared');

const MAX_LENGTH = 60;

module.exports = {
  name: 'title',
  category: 'levels',
  aliases: ['titulo', 'título'],
  description: 'Cambia el título de tu perfil.',
  usage: '<texto>',
  examples: ['title Fundador de TK$', 'title quitar'],
  cooldown: 10,
  guildOnly: false,

  data: new SlashCommandBuilder()
    .setName('title')
    .setDescription('Cambia el título de tu perfil.')
    .addStringOption((option) =>
      option
        .setName('texto')
        .setDescription(`Tu nuevo título (máx. ${MAX_LENGTH} caracteres). Escribe "quitar" para borrarlo.`)
        .setRequired(true)
        .setMaxLength(MAX_LENGTH)
    ),

  async execute(ctx) {
    const input = ctx.options.getString('texto', true).trim();

    if (['quitar', 'remove', 'none', 'ninguno', 'borrar'].includes(input.toLowerCase())) {
      await User.updateOne(
        { userId: ctx.user.id },
        { $set: { 'profile.title': '' }, $setOnInsert: { userId: ctx.user.id } },
        { upsert: true }
      );
      await ctx.successReply('Se ha borrado el título de tu perfil.');
      return;
    }

    if (input.length > MAX_LENGTH) {
      await ctx.errorReply(`El título no puede superar los ${MAX_LENGTH} caracteres.`);
      return;
    }

    // Evita que se cuelen menciones dentro de la tarjeta de perfil.
    const clean = input.replace(/<@[!&]?\d+>/g, '').replace(/@(everyone|here)/g, '').trim();
    if (clean.length === 0) {
      await ctx.errorReply('El título no puede contener solo menciones.');
      return;
    }

    await User.updateOne(
      { userId: ctx.user.id },
      { $set: { 'profile.title': clean }, $setOnInsert: { userId: ctx.user.id } },
      { upsert: true }
    );

    await ctx.successReply(`Tu título ahora es: **${clean}**`);
  },
};

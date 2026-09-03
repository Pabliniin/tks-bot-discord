'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const logs = require('../../modules/logs');

/** Registros relacionados con mensajes. */

/** Recorta el contenido para que quepa en un campo de embed. */
function preview(content, fallback = '*Sin texto*') {
  const text = String(content || '').trim();
  if (text.length === 0) return fallback;
  return text.length > 1000 ? `${text.slice(0, 1000)}…` : text;
}

/** Carga la configuración y descarta los casos que no deben registrarse. */
async function prepare(client, guild, channel, author) {
  if (!guild) return null;
  let settings;
  try {
    settings = await client.settings.get(guild.id);
  } catch {
    return null;
  }
  if (logs.isIgnoredChannel(settings, channel)) return null;
  if (author?.bot && settings.logs?.ignoreBots !== false) return null;
  return settings;
}

module.exports = [
  {
    name: Events.MessageDelete,
    async execute(client, message) {
      if (!message.guild) return;
      // Los mensajes parciales no traen contenido: solo se registra lo que hay.
      const settings = await prepare(client, message.guild, message.channel, message.author);
      if (!settings) return;

      const { executor, reason, unavailable } = await logs.findAuditEntry(
        message.guild,
        AuditLogEvent.MessageDelete,
        message.author?.id
      );

      /*
       * Discord solo registra en la auditoría los borrados hechos por OTRA
       * persona. Si no hay entrada, el mensaje lo borró su propio autor.
       */
      const borradoPorOtro = Boolean(executor && executor.id !== message.author?.id);

      const fields = [
        { name: 'Canal', value: `${message.channel}`, inline: true },
        {
          name: 'Enviado',
          value: message.createdAt
            ? `<t:${Math.floor(message.createdTimestamp / 1000)}:R>`
            : 'Desconocido',
          inline: true,
        },
        { name: '💬 Contenido', value: preview(message.content) },
      ];

      if (message.attachments?.size > 0) {
        fields.push({
          name: `📎 Adjuntos (${message.attachments.size})`,
          value: message.attachments.map((a) => a.name).join(', ').slice(0, 1024),
        });
      }
      if (reason) fields.push({ name: '📝 Razón', value: reason.slice(0, 1024) });

      const embed = logs.actionEmbed({
        title: borradoPorOtro
          ? '🗑️ Ha borrado el mensaje de otra persona'
          : '🗑️ Mensaje eliminado',
        color: 'error',
        // Si lo borró un moderador, él es el autor de la acción.
        executor: borradoPorOtro ? executor : message.author,
        // Y el afectado es siempre quien escribió el mensaje.
        target: borradoPorOtro ? message.author : null,
        auditUnavailable: unavailable && Boolean(message.author),
        detail: borradoPorOtro ? null : 'Lo ha borrado su propio autor, o fue el AutoMod.',
        fields,
      });

      await logs.send(message.guild, settings, 'messageDelete', embed);
    },
  },

  {
    name: Events.MessageUpdate,
    async execute(client, oldMessage, newMessage) {
      if (!newMessage.guild) return;
      // Discord emite este evento también al generar la vista previa de un enlace.
      if (oldMessage.content === newMessage.content) return;

      const settings = await prepare(client, newMessage.guild, newMessage.channel, newMessage.author);
      if (!settings) return;

      // Un mensaje solo lo puede editar quien lo escribió.
      const embed = logs.actionEmbed({
        title: '✏️ Ha editado su mensaje',
        color: 'warning',
        executor: newMessage.author,
        fields: [
          { name: 'Canal', value: `${newMessage.channel}`, inline: true },
          { name: 'Enlace', value: `[Ir al mensaje](${newMessage.url})`, inline: true },
          { name: 'Antes', value: preview(oldMessage.content, '*Desconocido*') },
          { name: 'Después', value: preview(newMessage.content) },
        ],
      });

      await logs.send(newMessage.guild, settings, 'messageUpdate', embed);
    },
  },

  {
    name: Events.MessageBulkDelete,
    async execute(client, messages) {
      const first = messages.first();
      if (!first?.guild) return;

      const settings = await prepare(client, first.guild, first.channel, null);
      if (!settings) return;

      const { executor, reason, unavailable } = await logs.findAuditEntry(
        first.guild,
        AuditLogEvent.MessageBulkDelete,
        first.channel.id
      );

      const fields = [
        { name: 'Canal', value: `${first.channel}`, inline: true },
        { name: 'Mensajes borrados', value: String(messages.size), inline: true },
      ];

      // Quiénes escribieron los mensajes eliminados.
      const autores = [...new Set(messages.map((m) => m.author?.id).filter(Boolean))];
      if (autores.length > 0) {
        fields.push({
          name: `🎯 Afectados (${autores.length})`,
          value: autores.slice(0, 15).map((id) => `<@${id}>`).join(' ').slice(0, 1024),
        });
      }

      const sample = messages
        .filter((m) => m.content)
        .first(5)
        .map((m) => `**${m.author?.tag ?? 'Desconocido'}:** ${m.content.slice(0, 80)}`)
        .join('\n');

      if (sample) fields.push({ name: 'Muestra', value: sample.slice(0, 1024) });
      if (reason) fields.push({ name: '📝 Razón', value: reason.slice(0, 1024) });

      const embed = logs.actionEmbed({
        title: '🧹 Ha borrado mensajes en bloque',
        color: 'error',
        executor,
        auditUnavailable: unavailable,
        fields,
      });

      await logs.send(first.guild, settings, 'messageBulkDelete', embed);
    },
  },
];

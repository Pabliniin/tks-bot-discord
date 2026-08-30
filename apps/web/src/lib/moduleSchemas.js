/**
 * Descripción de los formularios del panel.
 *
 * Cada módulo declara sus secciones y campos, y `<ModuleForm>` los dibuja.
 * Para añadir un ajuste nuevo basta con añadirlo aquí y en el esquema de
 * mongoose (`packages/shared/src/models/Guild.js`): no hace falta tocar la UI.
 *
 * Tipos de campo disponibles:
 *   toggle | text | textarea | number | select | color | emoji
 *   channel | channels | role | roles | tags | embed | list
 *
 * `key` es la ruta dentro del documento de configuración del servidor.
 * `showIf` oculta el campo mientras otra opción esté desactivada.
 */

/** Tipos de canal de Discord, para filtrar los selectores. */
export const CHANNEL_TYPES = {
  text: [0, 5],
  voice: [2, 13],
  category: [4],
  textAndCategory: [0, 5, 4],
  all: [0, 2, 4, 5, 13, 15],
};

/** Opciones de castigo compartidas por AutoMod. */
const PUNISHMENT_OPTIONS = [
  { value: 'delete', label: 'Solo eliminar el mensaje' },
  { value: 'warn', label: 'Advertir' },
  { value: 'timeout', label: 'Aislar' },
  { value: 'kick', label: 'Expulsar' },
  { value: 'ban', label: 'Banear' },
  { value: 'none', label: 'No hacer nada (solo registrar)' },
];

/** Campos comunes a todos los filtros de AutoMod. */
function automodFilter(id, label, description, extraFields = []) {
  const base = `automod.filters.${id}`;
  return {
    title: label,
    description,
    collapsible: true,
    fields: [
      { key: `${base}.enabled`, type: 'toggle', label: `Activar ${label}` },
      ...extraFields,
      {
        key: `${base}.action`,
        type: 'select',
        label: 'Acción',
        options: PUNISHMENT_OPTIONS,
        showIf: `${base}.enabled`,
      },
      {
        key: `${base}.deleteMessage`,
        type: 'toggle',
        label: 'Eliminar el mensaje infractor',
        showIf: `${base}.enabled`,
      },
      {
        key: `${base}.threshold`,
        type: 'number',
        label: 'Infracciones antes de castigar',
        min: 1,
        max: 20,
        help: 'Se cuentan durante 5 minutos. Con 1, castiga a la primera.',
        showIf: `${base}.enabled`,
      },
      {
        key: `${base}.duration`,
        type: 'number',
        label: 'Duración del castigo (minutos)',
        min: 1,
        max: 40320,
        showIf: `${base}.enabled`,
      },
      {
        key: `${base}.warnMessage`,
        type: 'text',
        label: 'Aviso en el canal',
        placeholder: 'no publiques enlaces aquí.',
        help: 'Se envía mencionando al usuario y se borra a los 8 segundos. Déjalo vacío para no avisar.',
        showIf: `${base}.enabled`,
      },
      {
        key: `${base}.ignoredRoles`,
        type: 'roles',
        label: 'Roles exentos de este filtro',
        showIf: `${base}.enabled`,
      },
      {
        key: `${base}.ignoredChannels`,
        type: 'channels',
        label: 'Canales exentos de este filtro',
        channelTypes: CHANNEL_TYPES.textAndCategory,
        showIf: `${base}.enabled`,
      },
    ],
  };
}

/** Campos del diseño de una tarjeta de imagen (bienvenida/despedida). */
function cardFields(base) {
  return [
    { key: `${base}.enabled`, type: 'toggle', label: 'Generar imagen' },
    {
      key: `${base}.background`,
      type: 'text',
      label: 'URL de la imagen de fondo',
      placeholder: 'https://…/fondo.png',
      help: 'Recomendado 1000×350 px. Si lo dejas vacío se usa un degradado.',
      showIf: `${base}.enabled`,
    },
    {
      key: `${base}.titleText`,
      type: 'text',
      label: 'Título',
      variables: 'welcome',
      showIf: `${base}.enabled`,
    },
    {
      key: `${base}.subtitleText`,
      type: 'text',
      label: 'Subtítulo',
      variables: 'welcome',
      showIf: `${base}.enabled`,
    },
    {
      key: `${base}.footerText`,
      type: 'text',
      label: 'Texto inferior',
      variables: 'welcome',
      showIf: `${base}.enabled`,
    },
    { key: `${base}.textColor`, type: 'color', label: 'Color del texto', showIf: `${base}.enabled` },
    { key: `${base}.accentColor`, type: 'color', label: 'Color de acento', showIf: `${base}.enabled` },
    {
      key: `${base}.avatarShape`,
      type: 'select',
      label: 'Forma del avatar',
      options: [
        { value: 'circle', label: 'Círculo' },
        { value: 'rounded', label: 'Redondeado' },
        { value: 'square', label: 'Cuadrado' },
      ],
      showIf: `${base}.enabled`,
    },
    {
      key: `${base}.overlayOpacity`,
      type: 'number',
      label: 'Oscurecer el fondo (0 a 1)',
      min: 0,
      max: 1,
      step: 0.05,
      showIf: `${base}.enabled`,
    },
  ];
}

export const MODULE_SCHEMAS = {
  // ── Bienvenida y Despedida ───────────────────────────────────
  welcome: {
    title: 'Bienvenida y Despedida',
    description:
      'Da la bienvenida a los nuevos miembros con un mensaje, un embed o una imagen personalizada, y despídete de quien se va.',
    sections: [
      {
        title: 'Mensaje de bienvenida',
        fields: [
          { key: 'welcome.enabled', type: 'toggle', label: 'Activar bienvenidas' },
          {
            key: 'welcome.channelId',
            type: 'channel',
            label: 'Canal de bienvenida',
            channelTypes: CHANNEL_TYPES.text,
            showIf: 'welcome.enabled',
          },
          {
            key: 'welcome.message',
            type: 'textarea',
            label: 'Mensaje',
            variables: 'welcome',
            showIf: 'welcome.enabled',
          },
          {
            key: 'welcome.deleteAfter',
            type: 'number',
            label: 'Borrar el mensaje pasados N segundos',
            min: 0,
            max: 3600,
            help: '0 = no borrarlo nunca.',
            showIf: 'welcome.enabled',
          },
        ],
      },
      {
        title: 'Embed de bienvenida',
        collapsible: true,
        fields: [{ key: 'welcome.embed', type: 'embed', label: 'Diseño del embed', variables: 'welcome' }],
      },
      {
        title: 'Imagen de bienvenida',
        collapsible: true,
        fields: cardFields('welcome.card'),
      },
      {
        title: 'Mensaje privado al entrar',
        collapsible: true,
        fields: [
          { key: 'welcome.dm.enabled', type: 'toggle', label: 'Enviar mensaje privado' },
          {
            key: 'welcome.dm.message',
            type: 'textarea',
            label: 'Mensaje privado',
            variables: 'welcome',
            showIf: 'welcome.dm.enabled',
          },
        ],
      },
      {
        title: 'Mensaje de despedida',
        collapsible: true,
        fields: [
          { key: 'goodbye.enabled', type: 'toggle', label: 'Activar despedidas' },
          {
            key: 'goodbye.channelId',
            type: 'channel',
            label: 'Canal de despedida',
            channelTypes: CHANNEL_TYPES.text,
            showIf: 'goodbye.enabled',
          },
          {
            key: 'goodbye.message',
            type: 'textarea',
            label: 'Mensaje',
            variables: 'welcome',
            showIf: 'goodbye.enabled',
          },
        ],
      },
      {
        title: 'Imagen de despedida',
        collapsible: true,
        fields: cardFields('goodbye.card'),
      },
    ],
  },

  // ── Respuesta Automática ─────────────────────────────────────
  autoresponder: {
    title: 'Respuesta Automática',
    description:
      'Haz que el bot responda automáticamente cuando alguien escriba una palabra o frase concreta.',
    sections: [
      {
        title: 'General',
        fields: [{ key: 'autoresponder.enabled', type: 'toggle', label: 'Activar respuestas automáticas' }],
      },
      {
        title: 'Respuestas',
        fields: [
          {
            key: 'autoresponder.responses',
            type: 'list',
            label: 'Respuestas configuradas',
            itemLabel: 'trigger',
            addLabel: 'Añadir respuesta',
            limitKey: 'maxAutoresponders',
            itemFields: [
              { key: 'trigger', type: 'text', label: 'Desencadenante', required: true },
              {
                key: 'matchType',
                type: 'select',
                label: 'Cómo se compara',
                options: [
                  { value: 'contains', label: 'Contiene el texto' },
                  { value: 'exact', label: 'Coincide exactamente' },
                  { value: 'startsWith', label: 'Empieza por' },
                  { value: 'endsWith', label: 'Termina en' },
                  { value: 'regex', label: 'Expresión regular' },
                ],
              },
              { key: 'response', type: 'textarea', label: 'Respuesta', variables: 'autoresponder' },
              { key: 'caseSensitive', type: 'toggle', label: 'Distinguir mayúsculas' },
              { key: 'deleteTrigger', type: 'toggle', label: 'Borrar el mensaje del usuario' },
              { key: 'cooldown', type: 'number', label: 'Espera por usuario (segundos)', min: 0, max: 3600 },
              {
                key: 'channels',
                type: 'channels',
                label: 'Solo en estos canales',
                channelTypes: CHANNEL_TYPES.textAndCategory,
              },
              { key: 'roles', type: 'roles', label: 'Solo para estos roles' },
              { key: 'enabled', type: 'toggle', label: 'Activa' },
            ],
          },
        ],
      },
    ],
  },

  // ── Mensajes Embed ───────────────────────────────────────────
  embeds: {
    title: 'Mensajes Embed',
    description:
      'Diseña embeds y publícalos en cualquier canal. Puedes volver a editarlos y el mensaje se actualiza solo.',
    sections: [
      {
        title: 'Embeds guardados',
        fields: [
          {
            key: 'embeds',
            type: 'list',
            label: 'Tus embeds',
            itemLabel: 'name',
            addLabel: 'Crear embed',
            limitKey: 'maxEmbeds',
            publishAction: 'embed',
            itemFields: [
              { key: 'name', type: 'text', label: 'Nombre interno', required: true },
              {
                key: 'channelId',
                type: 'channel',
                label: 'Canal donde publicar',
                channelTypes: CHANNEL_TYPES.text,
              },
              { key: 'content', type: 'textarea', label: 'Texto fuera del embed' },
              { key: 'embed', type: 'embed', label: 'Diseño del embed' },
            ],
          },
        ],
      },
    ],
  },

  // ── Sistema de niveles ───────────────────────────────────────
  levels: {
    title: 'Sistema de niveles',
    description:
      'Premia a los miembros activos con experiencia, roles de nivel y una tarjeta de rango personalizada.',
    sections: [
      {
        title: 'General',
        fields: [
          { key: 'levels.enabled', type: 'toggle', label: 'Activar el sistema de niveles' },
          {
            key: 'levels.announceMode',
            type: 'select',
            label: 'Dónde anunciar las subidas de nivel',
            options: [
              { value: 'current', label: 'En el canal donde escribió' },
              { value: 'channel', label: 'En un canal concreto' },
              { value: 'dm', label: 'Por mensaje privado' },
              { value: 'none', label: 'No anunciar' },
            ],
            showIf: 'levels.enabled',
          },
          {
            key: 'levels.announceChannelId',
            type: 'channel',
            label: 'Canal de anuncios',
            channelTypes: CHANNEL_TYPES.text,
            showIf: 'levels.enabled',
          },
          {
            key: 'levels.message',
            type: 'textarea',
            label: 'Mensaje al subir de nivel',
            variables: 'levels',
            showIf: 'levels.enabled',
          },
          {
            key: 'levels.deleteAfter',
            type: 'number',
            label: 'Borrar el anuncio pasados N segundos',
            min: 0,
            max: 3600,
            showIf: 'levels.enabled',
          },
        ],
      },
      {
        title: 'Ganancia de experiencia',
        collapsible: true,
        fields: [
          { key: 'levels.xpPerMessage', type: 'number', label: 'XP por mensaje', min: 1, max: 500 },
          {
            key: 'levels.xpCooldown',
            type: 'number',
            label: 'Espera entre ganancias (segundos)',
            min: 0,
            max: 3600,
            help: 'Evita que se gane XP haciendo spam. ProBot usa 60 segundos.',
          },
          {
            key: 'levels.voiceXpPerMinute',
            type: 'number',
            label: 'XP por minuto en voz',
            min: 0,
            max: 200,
            help: '0 lo desactiva. Solo cuenta si hay al menos dos personas sin silenciar.',
          },
          { key: 'levels.xpRate', type: 'number', label: 'Multiplicador global', min: 0.1, max: 10, step: 0.1 },
          { key: 'levels.stackRoles', type: 'toggle', label: 'Acumular los roles de nivel' },
        ],
      },
      {
        title: 'Roles por nivel',
        collapsible: true,
        fields: [
          {
            key: 'levels.roles',
            type: 'list',
            label: 'Recompensas',
            itemLabel: 'level',
            itemLabelPrefix: 'Nivel ',
            addLabel: 'Añadir recompensa',
            itemFields: [
              { key: 'level', type: 'number', label: 'Nivel', min: 1, max: 500, required: true },
              { key: 'roleId', type: 'role', label: 'Rol a otorgar', required: true },
            ],
          },
        ],
      },
      {
        title: 'Multiplicadores por rol',
        collapsible: true,
        fields: [
          {
            key: 'levels.multipliers',
            type: 'list',
            label: 'Multiplicadores',
            itemLabel: 'roleId',
            addLabel: 'Añadir multiplicador',
            itemFields: [
              { key: 'roleId', type: 'role', label: 'Rol', required: true },
              { key: 'multiplier', type: 'number', label: 'Multiplicador', min: 0, max: 10, step: 0.1 },
            ],
          },
        ],
      },
      {
        title: 'Exclusiones',
        collapsible: true,
        fields: [
          {
            key: 'levels.ignoredChannels',
            type: 'channels',
            label: 'Canales sin XP',
            channelTypes: CHANNEL_TYPES.all,
          },
          { key: 'levels.ignoredRoles', type: 'roles', label: 'Roles sin XP' },
        ],
      },
      {
        title: 'Tarjeta de rango',
        collapsible: true,
        fields: [
          { key: 'levels.card.background', type: 'text', label: 'URL del fondo', placeholder: 'https://…' },
          { key: 'levels.card.accentColor', type: 'color', label: 'Color de acento' },
          { key: 'levels.card.textColor', type: 'color', label: 'Color del texto' },
        ],
      },
    ],
  },

  // ── Auto-Roles ───────────────────────────────────────────────
  autoroles: {
    title: 'Auto-Roles',
    description: 'Asigna roles automáticamente a quienes entran en el servidor.',
    sections: [
      {
        title: 'Configuración',
        fields: [
          { key: 'autoroles.enabled', type: 'toggle', label: 'Activar auto-roles' },
          { key: 'autoroles.humans', type: 'roles', label: 'Roles para personas', showIf: 'autoroles.enabled' },
          { key: 'autoroles.bots', type: 'roles', label: 'Roles para bots', showIf: 'autoroles.enabled' },
          {
            key: 'autoroles.delay',
            type: 'number',
            label: 'Esperar N segundos antes de asignar',
            min: 0,
            max: 86400,
            help: 'Útil contra raids: los bots de raid suelen irse antes.',
            showIf: 'autoroles.enabled',
          },
          {
            key: 'autoroles.restoreOnRejoin',
            type: 'toggle',
            label: 'Devolver sus roles a quien vuelva',
            showIf: 'autoroles.enabled',
          },
        ],
      },
    ],
  },

  // ── Logs ─────────────────────────────────────────────────────
  logs: {
    title: 'Logs',
    description: 'Registra todo lo que pasa en el servidor: mensajes borrados, roles, canales, sanciones…',
    sections: [
      {
        title: 'General',
        fields: [
          { key: 'logs.enabled', type: 'toggle', label: 'Activar registros' },
          {
            key: 'logs.defaultChannelId',
            type: 'channel',
            label: 'Canal por defecto',
            channelTypes: CHANNEL_TYPES.text,
            help: 'Se usa para los eventos que no tengan un canal propio.',
            showIf: 'logs.enabled',
          },
          { key: 'logs.ignoreBots', type: 'toggle', label: 'Ignorar a los bots', showIf: 'logs.enabled' },
          {
            key: 'logs.ignoredChannels',
            type: 'channels',
            label: 'Canales que no se registran',
            channelTypes: CHANNEL_TYPES.all,
            showIf: 'logs.enabled',
          },
          { key: 'logs.ignoredRoles', type: 'roles', label: 'Roles que no se registran', showIf: 'logs.enabled' },
        ],
      },
      {
        title: 'Eventos',
        description: 'Activa cada evento y, si quieres, envíalo a un canal distinto.',
        fields: [{ key: 'logs.events', type: 'logEvents', label: 'Eventos registrados' }],
      },
    ],
  },

  // ── Colores ──────────────────────────────────────────────────
  colors: {
    title: 'Colores',
    description: 'Deja que tus miembros elijan un color con el comando `color`. Los roles se crean solos.',
    sections: [
      {
        title: 'General',
        fields: [
          { key: 'colors.enabled', type: 'toggle', label: 'Activar el módulo de colores' },
          { key: 'colors.title', type: 'text', label: 'Título de la lista', showIf: 'colors.enabled' },
          {
            key: 'colors.exclusive',
            type: 'toggle',
            label: 'Solo un color a la vez',
            showIf: 'colors.enabled',
          },
          {
            key: 'colors.requiredRoles',
            type: 'roles',
            label: 'Roles que pueden cambiar de color',
            help: 'Déjalo vacío para permitirlo a todo el mundo.',
            showIf: 'colors.enabled',
          },
        ],
      },
      {
        title: 'Colores disponibles',
        fields: [
          {
            key: 'colors.list',
            type: 'list',
            label: 'Lista de colores',
            itemLabel: 'name',
            addLabel: 'Añadir color',
            itemFields: [
              { key: 'name', type: 'text', label: 'Nombre', required: true },
              { key: 'hex', type: 'color', label: 'Color', required: true },
              { key: 'roleId', type: 'role', label: 'Rol existente (opcional)' },
            ],
          },
        ],
      },
    ],
  },

  // ── Roles AutoAsignables ─────────────────────────────────────
  selfroles: {
    title: 'Roles AutoAsignables',
    description:
      'Crea paneles con botones, menús o reacciones para que los miembros elijan sus propios roles.',
    sections: [
      {
        title: 'General',
        fields: [{ key: 'selfroles.enabled', type: 'toggle', label: 'Activar roles autoasignables' }],
      },
      {
        title: 'Paneles',
        fields: [
          {
            key: 'selfroles.panels',
            type: 'list',
            label: 'Paneles',
            itemLabel: 'name',
            addLabel: 'Crear panel',
            limitKey: 'maxSelfroles',
            publishAction: 'selfrole',
            itemFields: [
              { key: 'name', type: 'text', label: 'Nombre del panel', required: true },
              {
                key: 'channelId',
                type: 'channel',
                label: 'Canal donde publicarlo',
                channelTypes: CHANNEL_TYPES.text,
              },
              {
                key: 'type',
                type: 'select',
                label: 'Tipo',
                options: [
                  { value: 'button', label: 'Botones' },
                  { value: 'select', label: 'Menú desplegable' },
                  { value: 'reaction', label: 'Reacciones' },
                ],
              },
              {
                key: 'mode',
                type: 'select',
                label: 'Modo',
                options: [
                  { value: 'normal', label: 'Normal (se puede quitar)' },
                  { value: 'unique', label: 'Exclusivo (solo un rol del panel)' },
                  { value: 'verify', label: 'Verificación (no se puede quitar)' },
                ],
              },
              { key: 'content', type: 'textarea', label: 'Texto del mensaje' },
              { key: 'embed', type: 'embed', label: 'Embed del panel' },
              { key: 'placeholder', type: 'text', label: 'Texto del menú desplegable' },
              { key: 'requiredRoles', type: 'roles', label: 'Roles necesarios para usarlo' },
              {
                key: 'options',
                type: 'list',
                label: 'Roles del panel',
                itemLabel: 'label',
                addLabel: 'Añadir rol',
                itemFields: [
                  { key: 'roleId', type: 'role', label: 'Rol', required: true },
                  { key: 'label', type: 'text', label: 'Etiqueta' },
                  { key: 'description', type: 'text', label: 'Descripción (solo menús)' },
                  { key: 'emoji', type: 'emoji', label: 'Emoji' },
                  {
                    key: 'style',
                    type: 'select',
                    label: 'Estilo del botón',
                    options: [
                      { value: 1, label: 'Azul' },
                      { value: 2, label: 'Gris' },
                      { value: 3, label: 'Verde' },
                      { value: 4, label: 'Rojo' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  // ── Canales Temporales ───────────────────────────────────────
  tempchannels: {
    title: 'Canales Temporales',
    description:
      'Al entrar en un canal de voz concreto, el bot crea un canal propio para ese miembro y lo borra al quedarse vacío.',
    sections: [
      {
        title: 'Configuración',
        fields: [
          { key: 'tempchannels.enabled', type: 'toggle', label: 'Activar canales temporales' },
          {
            key: 'tempchannels.hubChannelId',
            type: 'channel',
            label: 'Canal creador',
            channelTypes: CHANNEL_TYPES.voice,
            help: 'Quien entre aquí tendrá su propio canal.',
            showIf: 'tempchannels.enabled',
          },
          {
            key: 'tempchannels.categoryId',
            type: 'channel',
            label: 'Categoría donde crearlos',
            channelTypes: CHANNEL_TYPES.category,
            showIf: 'tempchannels.enabled',
          },
          {
            key: 'tempchannels.nameTemplate',
            type: 'text',
            label: 'Nombre del canal',
            variables: 'welcome',
            showIf: 'tempchannels.enabled',
          },
          {
            key: 'tempchannels.userLimit',
            type: 'number',
            label: 'Límite de usuarios (0 = sin límite)',
            min: 0,
            max: 99,
            showIf: 'tempchannels.enabled',
          },
          {
            key: 'tempchannels.bitrate',
            type: 'number',
            label: 'Calidad de audio (kbps)',
            min: 8,
            max: 384,
            showIf: 'tempchannels.enabled',
          },
          {
            key: 'tempchannels.allowOwnerControls',
            type: 'toggle',
            label: 'El creador puede gestionar su canal',
            showIf: 'tempchannels.enabled',
          },
          {
            key: 'tempchannels.deleteDelay',
            type: 'number',
            label: 'Borrarlo tras N segundos vacío',
            min: 0,
            max: 3600,
            showIf: 'tempchannels.enabled',
          },
        ],
      },
    ],
  },

  // ── Enlaces Temporales ───────────────────────────────────────
  templinks: {
    title: 'Enlaces Temporales',
    description: 'Permite que tus miembros generen invitaciones de un solo uso para traer a sus amigos.',
    sections: [
      {
        title: 'Configuración',
        fields: [
          { key: 'templinks.enabled', type: 'toggle', label: 'Activar enlaces temporales' },
          {
            key: 'templinks.channelId',
            type: 'channel',
            label: 'Canal al que apunta la invitación',
            channelTypes: CHANNEL_TYPES.text,
            showIf: 'templinks.enabled',
          },
          {
            key: 'templinks.maxUses',
            type: 'number',
            label: 'Usos máximos (0 = ilimitados)',
            min: 0,
            max: 100,
            showIf: 'templinks.enabled',
          },
          {
            key: 'templinks.maxAge',
            type: 'number',
            label: 'Caducidad en segundos (0 = nunca)',
            min: 0,
            max: 604800,
            showIf: 'templinks.enabled',
          },
          {
            key: 'templinks.requiredRoles',
            type: 'roles',
            label: 'Roles que pueden generarlos',
            showIf: 'templinks.enabled',
          },
          {
            key: 'templinks.cooldown',
            type: 'number',
            label: 'Espera por usuario (segundos)',
            min: 0,
            max: 86400,
            showIf: 'templinks.enabled',
          },
        ],
      },
    ],
  },

  // ── Anti-Raid ────────────────────────────────────────────────
  antiraid: {
    title: 'Anti-Raid',
    description:
      'Detecta entradas masivas y actúa automáticamente. Es una función premium.',
    premium: true,
    sections: [
      {
        title: 'Detección',
        fields: [
          { key: 'antiraid.enabled', type: 'toggle', label: 'Activar Anti-Raid' },
          {
            key: 'antiraid.joinThreshold',
            type: 'number',
            label: 'Entradas que disparan la alarma',
            min: 2,
            max: 100,
            showIf: 'antiraid.enabled',
          },
          {
            key: 'antiraid.joinWindow',
            type: 'number',
            label: 'En cuántos segundos',
            min: 1,
            max: 300,
            showIf: 'antiraid.enabled',
          },
          {
            key: 'antiraid.minAccountAge',
            type: 'number',
            label: 'Rechazar cuentas de menos de N días',
            min: 0,
            max: 365,
            help: '0 lo desactiva.',
            showIf: 'antiraid.enabled',
          },
        ],
      },
      {
        title: 'Respuesta',
        fields: [
          {
            key: 'antiraid.action',
            type: 'select',
            label: 'Qué hacer con los sospechosos',
            options: [
              { value: 'kick', label: 'Expulsar' },
              { value: 'ban', label: 'Banear' },
              { value: 'timeout', label: 'Aislar 1 hora' },
              { value: 'none', label: 'Solo avisar' },
            ],
            showIf: 'antiraid.enabled',
          },
          {
            key: 'antiraid.lockdown',
            type: 'toggle',
            label: 'Subir la verificación del servidor durante el raid',
            showIf: 'antiraid.enabled',
          },
          {
            key: 'antiraid.lockdownDuration',
            type: 'number',
            label: 'Duración del bloqueo (segundos)',
            min: 60,
            max: 86400,
            showIf: 'antiraid.enabled',
          },
          {
            key: 'antiraid.alertChannelId',
            type: 'channel',
            label: 'Canal de alertas',
            channelTypes: CHANNEL_TYPES.text,
            showIf: 'antiraid.enabled',
          },
          {
            key: 'antiraid.whitelistRoles',
            type: 'roles',
            label: 'Roles exentos',
            showIf: 'antiraid.enabled',
          },
        ],
      },
    ],
  },

  // ── Protección VIP ───────────────────────────────────────────
  vipProtection: {
    title: 'Protección VIP',
    description:
      'Limita cuántas acciones destructivas puede hacer un moderador por minuto. Protege el servidor incluso si una cuenta con permisos se ve comprometida.',
    premium: true,
    sections: [
      {
        title: 'General',
        fields: [
          { key: 'vipProtection.enabled', type: 'toggle', label: 'Activar Protección VIP' },
          {
            key: 'vipProtection.punishment',
            type: 'select',
            label: 'Qué hacer con quien supere un límite',
            options: [
              { value: 'removeRoles', label: 'Quitarle todos los roles' },
              { value: 'kick', label: 'Expulsarlo' },
              { value: 'ban', label: 'Banearlo' },
              { value: 'none', label: 'Solo avisar' },
            ],
            showIf: 'vipProtection.enabled',
          },
          {
            key: 'vipProtection.alertChannelId',
            type: 'channel',
            label: 'Canal de alertas',
            channelTypes: CHANNEL_TYPES.text,
            showIf: 'vipProtection.enabled',
          },
          {
            key: 'vipProtection.whitelistRoles',
            type: 'roles',
            label: 'Roles de confianza (exentos)',
            showIf: 'vipProtection.enabled',
          },
          {
            key: 'vipProtection.blockDangerousRoles',
            type: 'toggle',
            label: 'Impedir que se repartan roles con permisos peligrosos',
            showIf: 'vipProtection.enabled',
          },
          {
            key: 'vipProtection.blockBots',
            type: 'toggle',
            label: 'Expulsar bots que entren sin autorización',
            showIf: 'vipProtection.enabled',
          },
        ],
      },
      {
        title: 'Límites por minuto',
        description: 'Un 0 desactiva esa comprobación.',
        collapsible: true,
        fields: [
          { key: 'vipProtection.limits.banLimit', type: 'number', label: 'Baneos', min: 0, max: 100 },
          { key: 'vipProtection.limits.kickLimit', type: 'number', label: 'Expulsiones', min: 0, max: 100 },
          {
            key: 'vipProtection.limits.roleDeleteLimit',
            type: 'number',
            label: 'Roles eliminados',
            min: 0,
            max: 100,
          },
          {
            key: 'vipProtection.limits.channelDeleteLimit',
            type: 'number',
            label: 'Canales eliminados',
            min: 0,
            max: 100,
          },
          {
            key: 'vipProtection.limits.roleCreateLimit',
            type: 'number',
            label: 'Roles creados',
            min: 0,
            max: 100,
          },
          {
            key: 'vipProtection.limits.channelCreateLimit',
            type: 'number',
            label: 'Canales creados',
            min: 0,
            max: 100,
          },
          {
            key: 'vipProtection.limits.webhookLimit',
            type: 'number',
            label: 'Webhooks creados',
            min: 0,
            max: 100,
          },
        ],
      },
    ],
  },

  // ── Starboard ────────────────────────────────────────────────
  starboard: {
    title: 'Starboard',
    description: 'Los mensajes que reciban suficientes reacciones se destacan en un canal especial.',
    sections: [
      {
        title: 'Configuración',
        fields: [
          { key: 'starboard.enabled', type: 'toggle', label: 'Activar starboard' },
          {
            key: 'starboard.channelId',
            type: 'channel',
            label: 'Canal del starboard',
            channelTypes: CHANNEL_TYPES.text,
            showIf: 'starboard.enabled',
          },
          { key: 'starboard.emoji', type: 'emoji', label: 'Emoji', showIf: 'starboard.enabled' },
          {
            key: 'starboard.threshold',
            type: 'number',
            label: 'Reacciones necesarias',
            min: 1,
            max: 100,
            showIf: 'starboard.enabled',
          },
          { key: 'starboard.color', type: 'color', label: 'Color del embed', showIf: 'starboard.enabled' },
          {
            key: 'starboard.selfStar',
            type: 'toggle',
            label: 'El autor puede destacarse a sí mismo',
            showIf: 'starboard.enabled',
          },
          {
            key: 'starboard.allowBots',
            type: 'toggle',
            label: 'Permitir mensajes de bots',
            showIf: 'starboard.enabled',
          },
          {
            key: 'starboard.allowNsfw',
            type: 'toggle',
            label: 'Permitir canales NSFW',
            showIf: 'starboard.enabled',
          },
          {
            key: 'starboard.ignoredChannels',
            type: 'channels',
            label: 'Canales excluidos',
            channelTypes: CHANNEL_TYPES.textAndCategory,
            showIf: 'starboard.enabled',
          },
        ],
      },
    ],
  },

  // ── AutoMod ──────────────────────────────────────────────────
  automod: {
    title: 'AutoMod',
    description:
      'Modera automáticamente el chat: enlaces, invitaciones, spam, mayúsculas, palabras prohibidas y más.',
    sections: [
      {
        title: 'General',
        fields: [
          { key: 'automod.enabled', type: 'toggle', label: 'Activar AutoMod' },
          {
            key: 'automod.exemptModerators',
            type: 'toggle',
            label: 'Los moderadores quedan exentos',
            showIf: 'automod.enabled',
          },
          {
            key: 'automod.logChannelId',
            type: 'channel',
            label: 'Canal de registros del AutoMod',
            channelTypes: CHANNEL_TYPES.text,
            showIf: 'automod.enabled',
          },
          {
            key: 'automod.ignoredRoles',
            type: 'roles',
            label: 'Roles exentos de todo el AutoMod',
            showIf: 'automod.enabled',
          },
          {
            key: 'automod.ignoredChannels',
            type: 'channels',
            label: 'Canales exentos de todo el AutoMod',
            channelTypes: CHANNEL_TYPES.textAndCategory,
            showIf: 'automod.enabled',
          },
        ],
      },
      automodFilter('invites', 'Anti-Invitaciones', 'Bloquea enlaces de invitación a otros servidores.', [
        {
          key: 'automod.options.allowOwnInvites',
          type: 'toggle',
          label: 'Permitir invitaciones a este mismo servidor',
          showIf: 'automod.filters.invites.enabled',
        },
      ]),
      automodFilter('links', 'Anti-Enlaces', 'Bloquea cualquier enlace externo.', [
        {
          key: 'automod.options.allowedLinks',
          type: 'tags',
          label: 'Dominios permitidos',
          placeholder: 'youtube.com',
          showIf: 'automod.filters.links.enabled',
        },
      ]),
      automodFilter('words', 'Palabras Prohibidas', 'Bloquea mensajes que contengan palabras de tu lista.', [
        {
          key: 'automod.options.bannedWords',
          type: 'tags',
          label: 'Palabras prohibidas',
          placeholder: 'palabra o *fragmento*',
          help: 'Usa *texto* para que coincida dentro de otras palabras.',
          showIf: 'automod.filters.words.enabled',
        },
      ]),
      automodFilter('caps', 'Anti-Mayúsculas', 'Bloquea mensajes con exceso de mayúsculas.', [
        {
          key: 'automod.options.capsPercentage',
          type: 'number',
          label: 'Porcentaje de mayúsculas permitido',
          min: 10,
          max: 100,
          showIf: 'automod.filters.caps.enabled',
        },
        {
          key: 'automod.options.capsMinLength',
          type: 'number',
          label: 'Longitud mínima del mensaje',
          min: 1,
          max: 500,
          showIf: 'automod.filters.caps.enabled',
        },
      ]),
      automodFilter('spam', 'Anti-Spam', 'Bloquea el envío rápido de muchos mensajes.', [
        {
          key: 'automod.options.spamMessages',
          type: 'number',
          label: 'Mensajes permitidos',
          min: 2,
          max: 30,
          showIf: 'automod.filters.spam.enabled',
        },
        {
          key: 'automod.options.spamInterval',
          type: 'number',
          label: 'En cuántos segundos',
          min: 1,
          max: 60,
          showIf: 'automod.filters.spam.enabled',
        },
      ]),
      automodFilter('mentions', 'Anti-Menciones', 'Bloquea mensajes con demasiadas menciones.', [
        {
          key: 'automod.options.maxMentions',
          type: 'number',
          label: 'Menciones permitidas',
          min: 1,
          max: 50,
          showIf: 'automod.filters.mentions.enabled',
        },
      ]),
      automodFilter('emojis', 'Anti-Emojis', 'Bloquea mensajes con demasiados emojis.', [
        {
          key: 'automod.options.maxEmojis',
          type: 'number',
          label: 'Emojis permitidos',
          min: 1,
          max: 100,
          showIf: 'automod.filters.emojis.enabled',
        },
      ]),
      automodFilter('newlines', 'Anti-Saltos de línea', 'Bloquea mensajes con demasiados saltos de línea.', [
        {
          key: 'automod.options.maxNewlines',
          type: 'number',
          label: 'Saltos permitidos',
          min: 1,
          max: 200,
          showIf: 'automod.filters.newlines.enabled',
        },
      ]),
      automodFilter('zalgo', 'Anti-Zalgo', 'Bloquea texto deformado o ilegible.'),
      automodFilter('attachments', 'Anti-Archivos', 'Bloquea el envío de archivos adjuntos.'),
      automodFilter('duplicates', 'Anti-Duplicados', 'Bloquea mensajes repetidos consecutivos.'),
    ],
  },

  // ── Tickets ──────────────────────────────────────────────────
  tickets: {
    title: 'Tickets',
    description:
      'Sistema de soporte con paneles, formularios, transcripciones y reclamación por parte del staff.',
    sections: [
      {
        title: 'General',
        fields: [
          { key: 'tickets.enabled', type: 'toggle', label: 'Activar tickets' },
          {
            key: 'tickets.categoryId',
            type: 'channel',
            label: 'Categoría donde se crean',
            channelTypes: CHANNEL_TYPES.category,
            showIf: 'tickets.enabled',
          },
          {
            key: 'tickets.archiveCategoryId',
            type: 'channel',
            label: 'Categoría de archivo',
            channelTypes: CHANNEL_TYPES.category,
            help: 'Si la dejas vacía, el canal se borra al cerrar el ticket.',
            showIf: 'tickets.enabled',
          },
          {
            key: 'tickets.supportRoles',
            type: 'roles',
            label: 'Roles de soporte',
            showIf: 'tickets.enabled',
          },
          {
            key: 'tickets.logChannelId',
            type: 'channel',
            label: 'Canal de registros',
            channelTypes: CHANNEL_TYPES.text,
            showIf: 'tickets.enabled',
          },
          {
            key: 'tickets.maxPerUser',
            type: 'number',
            label: 'Tickets abiertos por usuario',
            min: 1,
            max: 25,
            showIf: 'tickets.enabled',
          },
          {
            key: 'tickets.nameTemplate',
            type: 'text',
            label: 'Nombre del canal',
            variables: 'welcome',
            showIf: 'tickets.enabled',
          },
          {
            key: 'tickets.transcripts',
            type: 'toggle',
            label: 'Guardar transcripción al cerrar',
            showIf: 'tickets.enabled',
          },
          {
            key: 'tickets.claiming',
            type: 'toggle',
            label: 'Permitir reclamar tickets',
            showIf: 'tickets.enabled',
          },
          {
            key: 'tickets.openMessage',
            type: 'textarea',
            label: 'Mensaje al abrir',
            showIf: 'tickets.enabled',
          },
        ],
      },
      {
        title: 'Paneles',
        fields: [
          {
            key: 'tickets.panels',
            type: 'list',
            label: 'Paneles de tickets',
            itemLabel: 'name',
            addLabel: 'Crear panel',
            limitKey: 'maxTicketPanels',
            publishAction: 'ticket',
            itemFields: [
              { key: 'name', type: 'text', label: 'Nombre', required: true },
              {
                key: 'channelId',
                type: 'channel',
                label: 'Canal donde publicarlo',
                channelTypes: CHANNEL_TYPES.text,
              },
              { key: 'buttonLabel', type: 'text', label: 'Texto del botón' },
              { key: 'buttonEmoji', type: 'emoji', label: 'Emoji del botón' },
              {
                key: 'buttonStyle',
                type: 'select',
                label: 'Estilo del botón',
                options: [
                  { value: 1, label: 'Azul' },
                  { value: 2, label: 'Gris' },
                  { value: 3, label: 'Verde' },
                  { value: 4, label: 'Rojo' },
                ],
              },
              {
                key: 'categoryId',
                type: 'channel',
                label: 'Categoría propia (opcional)',
                channelTypes: CHANNEL_TYPES.category,
              },
              { key: 'supportRoles', type: 'roles', label: 'Roles de soporte propios' },
              { key: 'embed', type: 'embed', label: 'Embed del panel' },
              {
                key: 'form',
                type: 'list',
                label: 'Formulario al abrir (máx. 5 campos)',
                itemLabel: 'label',
                addLabel: 'Añadir pregunta',
                max: 5,
                itemFields: [
                  { key: 'label', type: 'text', label: 'Pregunta', required: true },
                  { key: 'placeholder', type: 'text', label: 'Texto de ayuda' },
                  { key: 'required', type: 'toggle', label: 'Obligatoria' },
                  {
                    key: 'style',
                    type: 'select',
                    label: 'Tipo de respuesta',
                    options: [
                      { value: 1, label: 'Una línea' },
                      { value: 2, label: 'Párrafo' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

/** Ajustes generales del servidor, fuera de los módulos. */
export const GENERAL_SCHEMA = {
  title: 'Ajustes generales',
  description: 'Prefijo, idioma, permisos y comandos del servidor.',
  sections: [
    {
      title: 'Bot',
      fields: [
        { key: 'prefix', type: 'text', label: 'Prefijo de comandos', maxLength: 8 },
        {
          key: 'locale',
          type: 'select',
          label: 'Idioma',
          options: [
            { value: 'es', label: 'Español' },
            { value: 'en', label: 'English' },
          ],
        },
        {
          key: 'deleteCommandMessages',
          type: 'toggle',
          label: 'Borrar el mensaje del usuario tras ejecutar un comando',
        },
        {
          key: 'ignoredChannels',
          type: 'channels',
          label: 'Canales donde se ignoran los comandos',
          channelTypes: CHANNEL_TYPES.textAndCategory,
        },
      ],
    },
    {
      title: 'Permisos',
      fields: [
        {
          key: 'modRoles',
          type: 'roles',
          label: 'Roles de moderador',
          help: 'Podrán usar los comandos de moderación aunque no tengan los permisos de Discord.',
        },
        { key: 'adminRoles', type: 'roles', label: 'Roles de administrador' },
      ],
    },
    {
      title: 'Comandos',
      fields: [{ key: 'disabledCommands', type: 'commands', label: 'Comandos desactivados' }],
    },
  ],
};

/** Devuelve el esquema de un módulo, o `null` si no existe. */
export function getSchema(moduleId) {
  if (moduleId === 'general') return GENERAL_SCHEMA;
  return MODULE_SCHEMAS[moduleId] || null;
}

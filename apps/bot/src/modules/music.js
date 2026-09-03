'use strict';

const { Shoukaku, Connectors, LoadType } = require('shoukaku');
const { EmbedBuilder } = require('discord.js');
const { EMBED_COLORS } = require('@tkbot/shared');

const logger = require('../utils/logger');

/**
 * Sistema de música.
 *
 * El audio no lo procesa el bot: lo hace **Lavalink**, un servicio aparte al
 * que el bot solo le da órdenes. Es como funcionan todos los bots de música
 * serios, y por dos razones que importan:
 *
 *   · **No consume CPU del bot.** Decodificar y transmitir audio es carísimo.
 *     Con veinte servidores sonando a la vez, un bot que procese el audio él
 *     mismo se queda sin recursos y empieza a fallar en todo lo demás.
 *
 *   · **No se rompe cada dos por tres.** YouTube cambia sus defensas a menudo
 *     y las librerías de Node que extraen audio se rompen con cada cambio.
 *     Lavalink se actualiza solo por su cuenta: se cambia la imagen de Docker
 *     y vuelve a funcionar, sin tocar el bot.
 *
 * Si no hay Lavalink configurado, el módulo se queda inactivo y los comandos
 * lo explican. El resto del bot funciona con normalidad.
 */

/** Modos de repetición. */
const BUCLES = { off: 'Desactivado', track: 'Canción', queue: 'Cola' };

/** Cuánto se espera antes de salir del canal al quedarse solo o sin cola. */
const ESPERA_INACTIVO = 2 * 60_000;

/** Tope de canciones en cola, para no llenar la memoria con una lista enorme. */
const MAX_COLA = 500;

/** Filtros de audio disponibles, con su configuración de Lavalink. */
const FILTROS = {
  ninguno: { nombre: 'Ninguno', config: null },
  bassboost: {
    nombre: 'Más graves',
    config: {
      equalizer: [
        { band: 0, gain: 0.6 },
        { band: 1, gain: 0.5 },
        { band: 2, gain: 0.35 },
        { band: 3, gain: 0.2 },
      ],
    },
  },
  nightcore: { nombre: 'Nightcore', config: { timescale: { speed: 1.2, pitch: 1.2, rate: 1 } } },
  vaporwave: { nombre: 'Vaporwave', config: { timescale: { speed: 0.8, pitch: 0.8, rate: 1 } } },
  karaoke: { nombre: 'Karaoke', config: { karaoke: { level: 1, monoLevel: 1, filterBand: 220, filterWidth: 100 } } },
  ochodimensional: { nombre: '8D', config: { rotation: { rotationHz: 0.2 } } },
};

/** Instancia de Shoukaku, o `null` si no hay Lavalink configurado. */
let shoukaku = null;

/**
 * Si se llegó a conectar alguna vez.
 * Sirve para gritar los fallos del principio (configuración mal puesta) y
 * limitarse a anotar los de después (un corte de red pasajero).
 */
let conectadoAlgunaVez = false;

/** Cuántos fallos de conexión se han avisado, para no llenar los registros. */
let avisosDeFallo = 0;

/** `guildId` → cola de reproducción. */
const colas = new Map();

/**
 * Cola de un servidor.
 *
 * Vive en memoria a propósito: guardar cada canción en la base de datos sería
 * una escritura por canción para algo que no tiene sentido conservar tras un
 * reinicio (el bot ya no está en el canal de voz).
 */
class Cola {
  constructor(guildId, player, textChannelId, voiceChannelId) {
    this.guildId = guildId;
    this.player = player;
    this.textChannelId = textChannelId;
    this.voiceChannelId = voiceChannelId;

    /** @type {object[]} Canciones pendientes. */
    this.tracks = [];
    /** @type {object|null} Lo que suena ahora. */
    this.current = null;
    /** @type {object[]} Historial para el comando «anterior». */
    this.previous = [];

    this.loop = 'off';
    this.volume = 100;
    /** Quién ha votado para saltar la canción actual. */
    this.votos = new Set();
    /** Temporizador de salida por inactividad. */
    this.temporizador = null;
    /** Filtro de audio aplicado. */
    this.filtro = 'ninguno';
  }

  /** Duración total de lo que queda por sonar, en milisegundos. */
  get duracionRestante() {
    const enCola = this.tracks.reduce((total, t) => total + (t.info.length || 0), 0);
    const actual = this.current ? Math.max(0, (this.current.info.length || 0) - this.player.position) : 0;
    return enCola + actual;
  }

  /** ¿Hay alguna emisión en directo en la cola? La duración total no valdría. */
  get tieneDirectos() {
    return this.tracks.some((t) => t.info.isStream) || Boolean(this.current?.info.isStream);
  }
}

/** Lee la configuración de Lavalink de las variables de entorno. */
function leerConfiguracion() {
  const host = process.env.LAVALINK_HOST;
  const password = process.env.LAVALINK_PASSWORD;

  if (!host || !password) return null;

  /*
   * Se acepta cualquier forma razonable de escribirlo: `servidor:2333`,
   * `http://servidor:2333`, con barra al final o sin puerto. Copiar la
   * dirección de un panel y que falle por una barra sobrante es un mal rato
   * evitable.
   */
  const limpio = host
    .trim()
    .replace(/^\w+:\/\//, '')
    .replace(/\/+$/, '');

  const secure = String(process.env.LAVALINK_SECURE || '').toLowerCase() === 'true';

  return {
    name: process.env.LAVALINK_NAME || 'principal',
    // Sin puerto se asume el 2333, que es el de Lavalink por defecto.
    url: limpio.includes(':') ? limpio : `${limpio}:2333`,
    auth: password,
    secure,
  };
}

/** ¿Está el sistema de música listo para usarse? */
function disponible() {
  if (!shoukaku) return false;
  return shoukaku.nodes.size > 0 && Boolean(shoukaku.getIdealNode());
}

/**
 * Explica por qué no está disponible, para que el usuario sepa qué hacer.
 * @returns {string}
 */
function motivoNoDisponible() {
  const configuracion = leerConfiguracion();

  if (!configuracion) {
    return [
      'El sistema de música no está configurado en este bot.',
      '',
      'Hace falta un servidor **Lavalink**, que es quien procesa el audio.',
      'Quien administre el bot tiene las instrucciones en `MUSICA.md`.',
    ].join('\n');
  }

  /*
   * Con configuración pero sin conexión, se dice a dónde está intentando ir.
   * Casi siempre el fallo es un puerto o una contraseña que no coinciden, y
   * ver la dirección exacta ahorra media hora de búsqueda a ciegas.
   */
  return [
    'El servidor de música no responde ahora mismo.',
    '',
    `Estoy intentando conectar con \`${configuracion.url}\`.`,
    '',
    'Si acaba de arrancar, dale un minuto. Si sigue igual, quien administre el bot',
    'debe comprobar que ese **puerto** sea el mismo en el que escucha Lavalink',
    '(sale en su registro como «Undertow started on port …») y que la **contraseña**',
    'coincida con la del servicio.',
  ].join('\n');
}

/** Cola de un servidor, si existe. */
function getCola(guildId) {
  return colas.get(guildId) || null;
}

/**
 * Busca canciones.
 *
 * @param {string} consulta Texto de búsqueda o URL.
 * @param {string} [fuente] `ytsearch`, `ytmsearch`, `scsearch` o `spsearch`.
 * @returns {Promise<{ tipo: string, tracks: object[], playlist: string|null, error: string|null }>}
 */
async function buscar(consulta, fuente = 'ytsearch') {
  const node = shoukaku?.getIdealNode();
  if (!node) return { tipo: 'error', tracks: [], playlist: null, error: 'Sin servidor de música.' };

  // Una URL se pasa tal cual; un texto se convierte en búsqueda.
  const esUrl = /^https?:\/\//i.test(consulta.trim());
  const identificador = esUrl ? consulta.trim() : `${fuente}:${consulta.trim()}`;

  let resultado;
  try {
    resultado = await node.rest.resolve(identificador);
  } catch (err) {
    logger.debug(`Búsqueda de música fallida: ${err.message}`);
    return { tipo: 'error', tracks: [], playlist: null, error: 'No se pudo buscar.' };
  }

  if (!resultado) {
    return { tipo: 'error', tracks: [], playlist: null, error: 'El servidor de música no respondió.' };
  }

  switch (resultado.loadType) {
    case LoadType.TRACK:
      return { tipo: 'track', tracks: [resultado.data], playlist: null, error: null };

    case LoadType.PLAYLIST:
      return {
        tipo: 'playlist',
        tracks: resultado.data.tracks,
        playlist: resultado.data.info.name,
        error: null,
      };

    case LoadType.SEARCH:
      return { tipo: 'search', tracks: resultado.data, playlist: null, error: null };

    case LoadType.EMPTY:
      return { tipo: 'empty', tracks: [], playlist: null, error: null };

    default:
      return {
        tipo: 'error',
        tracks: [],
        playlist: null,
        error: resultado.data?.message || 'La búsqueda falló.',
      };
  }
}

/**
 * Entra al canal de voz y crea la cola.
 *
 * @param {import('discord.js').Guild} guild
 * @param {string} voiceChannelId
 * @param {string} textChannelId
 * @param {number} [volumen]
 * @returns {Promise<Cola>}
 */
async function conectar(guild, voiceChannelId, textChannelId, volumen = 100) {
  const existente = colas.get(guild.id);
  if (existente) return existente;

  const player = await shoukaku.joinVoiceChannel({
    guildId: guild.id,
    channelId: voiceChannelId,
    shardId: guild.shardId ?? 0,
    // Ensordecerse ahorra ancho de banda: el bot no necesita oír nada.
    deaf: true,
  });

  const cola = new Cola(guild.id, player, textChannelId, voiceChannelId);
  cola.volume = volumen;
  colas.set(guild.id, cola);

  await player.setGlobalVolume(volumen).catch(() => {});
  registrarEventos(guild.client, cola);

  return cola;
}

/** Engancha los eventos del reproductor a la lógica de la cola. */
function registrarEventos(client, cola) {
  const { player } = cola;

  player.on('start', () => {
    cola.votos.clear();
    cancelarInactividad(cola);
    anunciarCancion(client, cola).catch(() => {});
  });

  player.on('end', (data) => {
    // `replaced` significa que hemos puesto otra a propósito: no avanzar.
    if (data.reason === 'replaced') return;
    siguiente(client, cola.guildId).catch((err) => {
      logger.error('Error al pasar a la siguiente canción:', err.message);
    });
  });

  player.on('exception', (data) => {
    logger.debug(`Fallo reproduciendo en ${cola.guildId}: ${data.exception?.message}`);
    avisar(client, cola, `No se pudo reproducir **${cola.current?.info.title || 'la canción'}**. Paso a la siguiente.`);
    siguiente(client, cola.guildId).catch(() => {});
  });

  player.on('stuck', () => {
    avisar(client, cola, 'La canción se ha quedado atascada. Paso a la siguiente.');
    siguiente(client, cola.guildId).catch(() => {});
  });

  player.on('closed', () => {
    // La conexión de voz se ha cerrado (nos han echado, o se cayó la red).
    destruir(cola.guildId).catch(() => {});
  });
}

/**
 * Reproduce la siguiente canción de la cola.
 * @returns {Promise<boolean>} `false` si ya no queda nada.
 */
async function siguiente(client, guildId) {
  const cola = colas.get(guildId);
  if (!cola) return false;

  const anterior = cola.current;

  // Repetición de una sola canción: se vuelve a poner la misma.
  if (cola.loop === 'track' && anterior) {
    await cola.player.playTrack({ track: { encoded: anterior.encoded } });
    return true;
  }

  if (anterior) {
    cola.previous.unshift(anterior);
    // El historial no crece sin fin: veinte canciones es de sobra.
    if (cola.previous.length > 20) cola.previous.pop();

    // Repetición de la cola: lo que acaba vuelve al final.
    if (cola.loop === 'queue') cola.tracks.push(anterior);
  }

  const siguienteTrack = cola.tracks.shift();

  if (!siguienteTrack) {
    cola.current = null;
    programarInactividad(client, cola, 'Se acabó la cola.');
    return false;
  }

  cola.current = siguienteTrack;
  await cola.player.playTrack({ track: { encoded: siguienteTrack.encoded } });
  return true;
}

/** Sale del canal y olvida la cola. */
async function destruir(guildId) {
  const cola = colas.get(guildId);
  if (!cola) return;

  cancelarInactividad(cola);
  colas.delete(guildId);

  await shoukaku.leaveVoiceChannel(guildId).catch(() => {});
}

/** Programa la salida por inactividad. */
function programarInactividad(client, cola, motivo) {
  cancelarInactividad(cola);

  cola.temporizador = setTimeout(async () => {
    // Quedarse en un canal vacío gasta recursos y molesta en la lista.
    avisar(client, cola, `${motivo} Me salgo del canal de voz.`);
    await destruir(cola.guildId).catch(() => {});
  }, ESPERA_INACTIVO);

  cola.temporizador.unref?.();
}

/** Cancela la salida por inactividad. */
function cancelarInactividad(cola) {
  if (cola.temporizador) {
    clearTimeout(cola.temporizador);
    cola.temporizador = null;
  }
}

/** Envía un aviso al canal de texto desde el que se pidió la música. */
function avisar(client, cola, texto) {
  const canal = client.channels.cache.get(cola.textChannelId);
  if (!canal?.isTextBased()) return;

  canal
    .send({ embeds: [new EmbedBuilder().setColor(EMBED_COLORS.neutral).setDescription(texto)] })
    .catch(() => {});
}

/** Anuncia en el canal la canción que empieza a sonar. */
async function anunciarCancion(client, cola) {
  const canal = client.channels.cache.get(cola.textChannelId);
  if (!canal?.isTextBased() || !cola.current) return;

  const { info } = cola.current;

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.default)
    .setAuthor({ name: '🎵 Sonando ahora' })
    .setTitle(info.title.slice(0, 256))
    .addFields(
      { name: 'Artista', value: info.author || 'Desconocido', inline: true },
      {
        name: 'Duración',
        value: info.isStream ? '🔴 En directo' : formatearDuracion(info.length),
        inline: true,
      },
      { name: 'En cola', value: `${cola.tracks.length} canción(es)`, inline: true }
    );

  if (info.uri) embed.setURL(info.uri);
  if (info.artworkUrl) embed.setThumbnail(info.artworkUrl);
  if (cola.current.pedidaPor) {
    embed.setFooter({ text: `Pedida por ${cola.current.pedidaPor.tag}` });
  }

  await canal.send({ embeds: [embed] }).catch(() => {});
}

/** Milisegundos a `3:45` o `1:02:30`. */
function formatearDuracion(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0:00';

  const total = Math.floor(ms / 1000);
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;

  const dosDigitos = (n) => String(n).padStart(2, '0');

  return horas > 0
    ? `${horas}:${dosDigitos(minutos)}:${dosDigitos(segundos)}`
    : `${minutos}:${dosDigitos(segundos)}`;
}

/**
 * Convierte `1:30`, `90`, `2m30s` en milisegundos.
 * @returns {number|null} `null` si no se entiende.
 */
function parsearTiempo(texto) {
  const limpio = String(texto || '').trim().toLowerCase();
  if (limpio.length === 0) return null;

  // Formato `1:30` o `1:02:30`.
  if (limpio.includes(':')) {
    const partes = limpio.split(':').map((p) => Number(p));
    if (partes.some((p) => !Number.isFinite(p) || p < 0)) return null;

    if (partes.length === 2) return (partes[0] * 60 + partes[1]) * 1000;
    if (partes.length === 3) return (partes[0] * 3600 + partes[1] * 60 + partes[2]) * 1000;
    return null;
  }

  // Formato `2m30s` o `90s`.
  const conUnidades = limpio.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (conUnidades && conUnidades.slice(1).some(Boolean)) {
    const [, h, m, s] = conUnidades;
    return ((Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0)) * 1000;
  }

  // Solo un número: segundos.
  const segundos = Number(limpio);
  return Number.isFinite(segundos) && segundos >= 0 ? segundos * 1000 : null;
}

/**
 * Barra de progreso de la canción actual.
 * @param {number} posicion Milisegundos transcurridos.
 * @param {number} total Duración total.
 * @param {number} [largo] Caracteres de la barra.
 */
function barraProgreso(posicion, total, largo = 20) {
  if (!Number.isFinite(total) || total <= 0) return '─'.repeat(largo);

  const proporcion = Math.min(1, Math.max(0, posicion / total));
  const indice = Math.min(largo - 1, Math.floor(proporcion * largo));

  return `${'─'.repeat(indice)}🔘${'─'.repeat(largo - indice - 1)}`;
}

/**
 * ¿Puede esta persona saltarse la votación?
 *
 * Manda quien tiene el rol de DJ, quien puede gestionar el servidor, y quien
 * pidió la canción: si estás solo escuchando lo que has puesto tú, no tiene
 * sentido pedirle permiso a nadie.
 */
function esDj(member, settings, cola = null) {
  if (!member) return false;

  const rolDj = settings?.music?.djRoleId;
  if (rolDj && member.roles.cache.has(rolDj)) return true;

  if (member.permissions.has('ManageGuild')) return true;

  // Quien la pidió puede saltarse su propia canción.
  if (cola?.current?.pedidaPor?.id === member.id) return true;

  return false;
}

/** Cuántos oyentes humanos hay en el canal de voz. */
function contarOyentes(guild, cola) {
  const canal = guild.channels.cache.get(cola.voiceChannelId);
  if (!canal) return 0;

  return canal.members.filter((m) => !m.user.bot).size;
}

module.exports = {
  name: 'music',

  // Constantes que usan los comandos.
  BUCLES,
  FILTROS,
  MAX_COLA,

  // Estado.
  colas,
  getCola,
  disponible,
  motivoNoDisponible,

  // Operaciones.
  buscar,
  conectar,
  siguiente,
  destruir,
  programarInactividad,
  cancelarInactividad,
  avisar,

  // Utilidades compartidas con los comandos y las pruebas.
  formatearDuracion,
  parsearTiempo,
  barraProgreso,
  esDj,
  contarOyentes,

  /** Arranca la conexión con Lavalink, si está configurado. */
  init(client) {
    const configuracion = leerConfiguracion();

    if (!configuracion) {
      logger.module(
        'music',
        'Sin configurar (falta LAVALINK_HOST). Los comandos de música lo explicarán.'
      );
      return;
    }

    shoukaku = new Shoukaku(new Connectors.DiscordJS(client), [configuracion], {
      // Si Lavalink se reinicia, se recuperan los reproductores en vez de
      // dejar a media docena de servidores con el bot mudo en el canal.
      resume: true,
      resumeTimeout: 30,
      resumeByLibrary: true,
      reconnectTries: 10,
      reconnectInterval: 5,
      restTimeout: 15_000,
    });

    shoukaku.on('ready', (nombre, reanudado) => {
      conectadoAlgunaVez = true;
      logger.module('music', `Lavalink «${nombre}» conectado${reanudado ? ' (reanudado)' : ''}.`);
    });

    /*
     * Los fallos de conexión se avisan alto la primera vez. Antes iban a
     * `debug`, que no se ve en producción, así que un puerto o una contraseña
     * mal puestos dejaban la música muerta sin ninguna pista en los registros.
     */
    shoukaku.on('error', (nombre, error) => {
      if (conectadoAlgunaVez) {
        logger.debug(`Lavalink «${nombre}»: ${error.message}`);
        return;
      }

      avisosDeFallo += 1;
      if (avisosDeFallo <= 3) {
        logger.error(`No se puede conectar con Lavalink en ${configuracion.url}: ${error.message}`);

        if (avisosDeFallo === 1) {
          logger.error(
            'Comprueba tres cosas: que el servicio de Lavalink esté encendido, que el PUERTO ' +
              'de LAVALINK_HOST sea el mismo en el que arranca Lavalink (mira su registro ' +
              '«Undertow started on port …»), y que LAVALINK_PASSWORD sea idéntica a ' +
              'LAVALINK_SERVER_PASSWORD.'
          );
        }
      }
    });

    shoukaku.on('close', (nombre, codigo) => {
      // 4001 y 4004 son «credenciales incorrectas» en el protocolo de Lavalink.
      if (!conectadoAlgunaVez && (codigo === 4001 || codigo === 4004)) {
        logger.error(
          `Lavalink ha rechazado la conexión (código ${codigo}): la contraseña no coincide. ` +
            'LAVALINK_PASSWORD del bot debe ser igual que LAVALINK_SERVER_PASSWORD del servicio.'
        );
        return;
      }
      logger.debug(`Lavalink «${nombre}» desconectado (código ${codigo}).`);
    });

    shoukaku.on('disconnect', (nombre) => {
      logger.error(`Lavalink «${nombre}» se ha desconectado. La música dejará de funcionar.`);
      // Las colas dejan de tener sentido: el reproductor remoto ya no existe.
      for (const guildId of [...colas.keys()]) {
        const cola = colas.get(guildId);
        if (cola) cancelarInactividad(cola);
        colas.delete(guildId);
      }
    });

    /*
     * NO hay que reenviarle los paquetes de la pasarela a mano.
     *
     * El conector `Connectors.DiscordJS` se engancha él solo a los eventos
     * `raw` y `clientReady` del cliente (lo hace `listen()`, que llama el
     * propio constructor de Shoukaku). Añadir aquí otro `client.on('raw', …)`
     * duplicaba el trabajo y, además, llamaba a un método que no existe.
     */

    logger.module('music', `Conectando con Lavalink en ${configuracion.url}…`);
  },

  /** Sale de todos los canales de voz al apagar el bot. */
  async onShutdown() {
    for (const guildId of [...colas.keys()]) {
      await destruir(guildId).catch(() => {});
    }
  },
};

// Se importa el módulo CommonJS y no el JSON: este archivo se ejecuta solo en
// el servidor y así funciona tanto con Next como con `node --test`, que exige
// un atributo especial para importar JSON.
import constantes from '@tkbot/shared/src/constants.js';

const { PREMIUM_TIERS } = constantes;

/**
 * Validación de lo que envía el panel, en el servidor.
 *
 * El navegador ya impide pasarse de los límites, pero eso es solo comodidad:
 * cualquiera puede llamar a la API directamente. Aquí se comprueba de verdad,
 * que es lo único que cuenta cuando el bot se vende.
 */

/** Listas cuyo tamaño depende del plan contratado. */
const LIMITES_PREMIUM = [
  { ruta: 'embeds', limite: 'maxEmbeds', nombre: 'embeds guardados' },
  { ruta: 'autoresponder.responses', limite: 'maxAutoresponders', nombre: 'respuestas automáticas' },
  { ruta: 'selfroles.panels', limite: 'maxSelfroles', nombre: 'paneles de roles' },
  { ruta: 'tickets.panels', limite: 'maxTicketPanels', nombre: 'paneles de tickets' },
];

/**
 * Topes que se aplican siempre, tenga el plan que tenga.
 * Evitan que alguien llene la base de datos o construya una configuración
 * que Discord rechazaría.
 */
const TOPES_ABSOLUTOS = [
  { ruta: 'levels.roles', max: 200, nombre: 'roles por nivel' },
  { ruta: 'levels.multipliers', max: 100, nombre: 'multiplicadores' },
  { ruta: 'levels.ignoredChannels', max: 500, nombre: 'canales sin XP' },
  { ruta: 'levels.ignoredRoles', max: 200, nombre: 'roles sin XP' },
  { ruta: 'colors.list', max: 100, nombre: 'colores' },
  { ruta: 'automod.options.bannedWords', max: 2000, nombre: 'palabras prohibidas' },
  { ruta: 'automod.options.allowedLinks', max: 500, nombre: 'dominios permitidos' },
  { ruta: 'automod.ignoredChannels', max: 500, nombre: 'canales exentos' },
  { ruta: 'automod.ignoredRoles', max: 200, nombre: 'roles exentos' },
  { ruta: 'logs.ignoredChannels', max: 500, nombre: 'canales sin registro' },
  { ruta: 'logs.ignoredRoles', max: 200, nombre: 'roles sin registro' },
  { ruta: 'autoroles.humans', max: 50, nombre: 'auto-roles para personas' },
  { ruta: 'autoroles.bots', max: 50, nombre: 'auto-roles para bots' },
  { ruta: 'disabledCommands', max: 200, nombre: 'comandos desactivados' },
  { ruta: 'ignoredChannels', max: 500, nombre: 'canales ignorados' },
  { ruta: 'modRoles', max: 100, nombre: 'roles de moderador' },
  { ruta: 'adminRoles', max: 100, nombre: 'roles de administrador' },
  { ruta: 'tickets.supportRoles', max: 100, nombre: 'roles de soporte' },
];

/** Longitud máxima de cada campo de texto largo. */
const TOPES_TEXTO = [
  { ruta: 'welcome.message', max: 2000 },
  { ruta: 'goodbye.message', max: 2000 },
  { ruta: 'welcome.dm.message', max: 2000 },
  { ruta: 'levels.message', max: 2000 },
  { ruta: 'tickets.openMessage', max: 2000 },
  { ruta: 'tickets.closeMessage', max: 2000 },
  { ruta: 'prefix', max: 8 },
];

/** Protocolos aceptados en los campos de imagen. */
const PROTOCOLOS_VALIDOS = ['http:', 'https:'];

/** Lee un valor por su ruta de puntos. */
function leer(objeto, ruta) {
  return ruta.split('.').reduce((actual, clave) => actual?.[clave], objeto);
}

/**
 * ¿Es una URL de imagen aceptable?
 * Se rechazan `javascript:` y `data:`, que no pintan nada en un embed y son
 * la vía habitual de intentar colar algo.
 */
function urlValida(valor) {
  if (typeof valor !== 'string' || valor.trim() === '') return true; // vacío es válido
  try {
    return PROTOCOLOS_VALIDOS.includes(new URL(valor).protocol);
  } catch {
    return false;
  }
}

/** Recorre un diseño de embed buscando URLs no válidas. */
function urlsDeEmbed(embed, prefijo, errores) {
  if (!embed || typeof embed !== 'object') return;

  const campos = [
    ['thumbnail', embed.thumbnail],
    ['image', embed.image],
    ['url', embed.url],
    ['author.icon', embed.author?.icon],
    ['author.url', embed.author?.url],
    ['footer.icon', embed.footer?.icon],
  ];

  for (const [nombre, valor] of campos) {
    if (!urlValida(valor)) {
      errores.push(`${prefijo}.${nombre}: solo se admiten direcciones http:// o https://`);
    }
  }
}

/** Busca embeds en cualquier parte de los cambios y valida sus URLs. */
function validarEmbedsAnidados(cambios, errores) {
  const revisar = (valor, ruta, profundidad = 0) => {
    if (profundidad > 6 || !valor || typeof valor !== 'object') return;

    if (Array.isArray(valor)) {
      valor.forEach((item, i) => revisar(item, `${ruta}[${i}]`, profundidad + 1));
      return;
    }

    // Un objeto con estos campos es un diseño de embed.
    if ('color' in valor || 'fields' in valor || 'thumbnail' in valor) {
      urlsDeEmbed(valor, ruta, errores);
    }

    for (const [clave, hijo] of Object.entries(valor)) {
      revisar(hijo, ruta ? `${ruta}.${clave}` : clave, profundidad + 1);
    }
  };

  revisar(cambios, '');
}

/**
 * Valida los cambios contra el plan del servidor.
 *
 * @param {object} cambios Datos ya filtrados por `sanitizePayload`.
 * @param {object} settingsActuales Configuración guardada, para conocer el plan.
 * @param {number} tier Nivel premium efectivo del servidor.
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateSettings(cambios, settingsActuales, tier) {
  const errores = [];
  const limites = PREMIUM_TIERS[tier] || PREMIUM_TIERS[0];

  // ── Límites que dependen del plan ───────────────────────────
  for (const { ruta, limite, nombre } of LIMITES_PREMIUM) {
    const lista = leer(cambios, ruta);
    if (!Array.isArray(lista)) continue;

    const max = limites[limite];
    if (lista.length > max) {
      errores.push(
        `Tu plan (${limites.name}) permite ${max} ${nombre} y estás enviando ${lista.length}.`
      );
    }
  }

  // ── Topes que se aplican siempre ────────────────────────────
  for (const { ruta, max, nombre } of TOPES_ABSOLUTOS) {
    const lista = leer(cambios, ruta);
    if (Array.isArray(lista) && lista.length > max) {
      errores.push(`Demasiados ${nombre}: el máximo es ${max}.`);
    }
  }

  // ── Longitud de los textos ──────────────────────────────────
  for (const { ruta, max } of TOPES_TEXTO) {
    const texto = leer(cambios, ruta);
    if (typeof texto === 'string' && texto.length > max) {
      errores.push(`El campo "${ruta}" supera los ${max} caracteres.`);
    }
  }

  // ── URLs de las imágenes ────────────────────────────────────
  validarEmbedsAnidados(cambios, errores);

  for (const ruta of ['welcome.card.background', 'goodbye.card.background', 'levels.card.background']) {
    if (!urlValida(leer(cambios, ruta))) {
      errores.push(`La imagen de fondo debe ser una dirección http:// o https:// (${ruta}).`);
    }
  }

  // ── Prefijo utilizable ──────────────────────────────────────
  const prefijo = leer(cambios, 'prefix');
  if (typeof prefijo === 'string') {
    if (prefijo.trim().length === 0) {
      errores.push('El prefijo no puede estar vacío.');
    } else if (/\s/.test(prefijo)) {
      errores.push('El prefijo no puede contener espacios.');
    }
  }

  return { ok: errores.length === 0, errors: errores };
}

export { LIMITES_PREMIUM, TOPES_ABSOLUTOS, urlValida };

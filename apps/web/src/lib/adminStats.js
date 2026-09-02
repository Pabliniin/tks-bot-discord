import {
  Guild,
  User,
  Case,
  GuildStats,
  connect,
  premiumStatus,
  maxGuildsFor,
  PLANES,
} from '@tkbot/shared';

import { getStats, getBotGuildIds } from './botApi';

/**
 * Cifras del negocio para el panel de administración.
 *
 * Es lo que contesta a «¿cómo va esto?»: cuántos servidores, cuántos pagan,
 * cuánto entra al mes. Sin esta pantalla se vuela a ciegas.
 */

/** Ingresos mensuales que aporta cada nivel, en céntimos. */
function ingresoMensualDe(tier) {
  const plan = PLANES.find((p) => p.tier === tier && p.periodo === 'mensual');
  return plan?.precioCentimos || 0;
}

/**
 * Resumen general.
 * @returns {Promise<object>}
 */
export async function resumenGlobal() {
  await connect();

  const ahora = new Date();
  const hace30 = new Date(ahora.getTime() - 30 * 86_400_000);

  const [
    totalServidores,
    totalUsuarios,
    conPremium,
    premiumPorNivel,
    suscripciones,
    nuevosServidores,
    sancionesRecientes,
    botStats,
    idsDelBot,
  ] = await Promise.all([
    Guild.countDocuments({}),
    User.countDocuments({}),

    // Servidores con premium en vigor: nivel > 0 y fecha futura (o sin fecha).
    Guild.countDocuments({
      'premium.tier': { $gt: 0 },
      $or: [{ 'premium.until': null }, { 'premium.until': { $gt: ahora } }],
    }),

    Guild.aggregate([
      {
        $match: {
          'premium.tier': { $gt: 0 },
          $or: [{ 'premium.until': null }, { 'premium.until': { $gt: ahora } }],
        },
      },
      { $group: { _id: '$premium.tier', total: { $sum: 1 } } },
    ]),

    // Suscripciones de pago, por estado.
    User.aggregate([
      { $match: { 'billing.subscriptionId': { $ne: null } } },
      { $group: { _id: '$billing.status', total: { $sum: 1 } } },
    ]),

    Guild.countDocuments({ createdAt: { $gte: hace30 } }),
    Case.countDocuments({ createdAt: { $gte: hace30 } }),

    getStats(),
    getBotGuildIds(),
  ]);

  const porNivel = Object.fromEntries(premiumPorNivel.map((p) => [p._id, p.total]));
  const porEstado = Object.fromEntries(suscripciones.map((s) => [s._id || 'desconocido', s.total]));

  /*
   * Ingresos recurrentes mensuales, contando solo lo que está cobrándose de
   * verdad. Un premium regalado no entra, que si no la cifra miente.
   */
  const dePago = await User.aggregate([
    { $match: { 'billing.status': { $in: ['active', 'trialing', 'past_due'] } } },
    { $group: { _id: '$premium.tier', total: { $sum: 1 } } },
  ]);

  const ingresoMensualCentimos = dePago.reduce(
    (total, fila) => total + ingresoMensualDe(fila._id) * fila.total,
    0
  );

  return {
    servidores: {
      enBaseDeDatos: totalServidores,
      // El bot puede estar en menos servidores de los que hay guardados: los
      // que lo echaron siguen en la base de datos con su configuración.
      activos: idsDelBot.size || botStats?.guilds || 0,
      nuevos30d: nuevosServidores,
    },
    usuarios: {
      total: totalUsuarios,
      alcance: botStats?.users || 0,
    },
    premium: {
      servidoresConPremium: conPremium,
      tier1: porNivel[1] || 0,
      tier2: porNivel[2] || 0,
      // Qué porcentaje de servidores paga. Es la cifra que decide si el
      // negocio funciona.
      conversion: totalServidores > 0 ? Math.round((conPremium / totalServidores) * 1000) / 10 : 0,
    },
    suscripciones: {
      activas: porEstado.active || 0,
      prueba: porEstado.trialing || 0,
      impagadas: porEstado.past_due || 0,
      canceladas: porEstado.canceled || 0,
      ingresoMensualCentimos,
    },
    actividad: {
      sanciones30d: sancionesRecientes,
      comandos: botStats?.comandos ?? botStats?.commands ?? 0,
      ping: botStats?.ping ?? null,
      instancias: botStats?.instances ?? 1,
      offline: Boolean(botStats?.offline),
    },
  };
}

/**
 * Servidores, ordenados por lo que interese.
 *
 * @param {object} [options]
 * @param {'miembros'|'premium'|'recientes'} [options.orden]
 * @param {string} [options.busqueda]
 * @param {number} [options.limite]
 */
export async function listarServidores({ orden = 'recientes', busqueda = '', limite = 50 } = {}) {
  await connect();

  const filtro = {};

  if (busqueda.trim()) {
    const texto = busqueda.trim();
    // Por identificador exacto, o por nombre si lo tenemos guardado.
    filtro.$or = /^\d{16,20}$/.test(texto)
      ? [{ guildId: texto }]
      : [{ guildId: new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }];
  }

  const orden_ = {
    recientes: { createdAt: -1 },
    miembros: { 'stats.memberCount': -1 },
    premium: { 'premium.tier': -1, createdAt: -1 },
  }[orden] || { createdAt: -1 };

  const servidores = await Guild.find(filtro)
    .sort(orden_)
    .limit(Math.min(200, Math.max(1, limite)))
    .select('guildId premium stats createdAt prefix')
    .lean();

  return servidores.map((g) => ({
    guildId: g.guildId,
    prefix: g.prefix,
    miembros: g.stats?.memberCount || 0,
    comandos: g.stats?.commandsUsed || 0,
    ultimaVez: g.stats?.lastSeen || null,
    creado: g.createdAt,
    premium: premiumStatus(g.premium),
  }));
}

/**
 * Clientes de pago, con el estado de su suscripción.
 * @param {number} [limite]
 */
export async function listarClientes(limite = 100) {
  await connect();

  const usuarios = await User.find({ 'billing.subscriptionId': { $ne: null } })
    .sort({ 'billing.currentPeriodEnd': -1 })
    .limit(Math.min(500, Math.max(1, limite)))
    .select('userId premium billing')
    .lean();

  return usuarios.map((u) => {
    const estado = premiumStatus(u.premium);

    return {
      userId: u.userId,
      premium: estado,
      servidoresAplicados: u.premium?.guilds?.length || 0,
      // Cuántos le permite su plan: sirve para ver de un vistazo quién tiene
      // sitio de sobra y quién lo tiene todo ocupado.
      servidoresMaximos: maxGuildsFor(estado.tier),
      billing: {
        status: u.billing?.status || null,
        renuevaEl: u.billing?.currentPeriodEnd || null,
        cancelaAlFinal: Boolean(u.billing?.cancelAtPeriodEnd),
        stripeCustomerId: u.billing?.stripeCustomerId || null,
      },
    };
  });
}

/**
 * Crecimiento agregado de todos los servidores, para la gráfica.
 * @param {number} [dias]
 */
export async function crecimientoGlobal(dias = 30) {
  await connect();

  const desde = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);

  const filas = await GuildStats.aggregate([
    { $match: { date: { $gte: desde } } },
    {
      $group: {
        _id: '$date',
        joins: { $sum: '$joins' },
        leaves: { $sum: '$leaves' },
        messages: { $sum: '$messages' },
        commands: { $sum: '$commands' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return filas.map((f) => ({
    date: f._id,
    joins: f.joins,
    leaves: f.leaves,
    messages: f.messages,
    commands: f.commands,
  }));
}

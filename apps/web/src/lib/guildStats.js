/**
 * Preparación de las series para las gráficas del panel.
 *
 * Va en su propio módulo, sin dependencias de Next.js ni de mongoose, para
 * poder probarlo de forma aislada (`apps/web/tests/guildStats.test.mjs`).
 */

/** Días que se pueden pedir. */
export const RANGOS = [7, 30, 90];

/**
 * Lista de días en formato `AAAA-MM-DD`, del más antiguo al más reciente.
 *
 * @param {number} dias
 * @param {Date} [hasta] Último día incluido (por defecto, hoy).
 * @returns {string[]}
 */
export function rangoDeDias(dias, hasta = new Date()) {
  const total = Math.max(1, Math.min(365, Math.floor(dias)));
  const fechas = [];

  // Se trabaja en UTC porque el bot guarda los días en UTC: mezclarlo con la
  // hora local del navegador desplazaría toda la gráfica un día.
  const fin = Date.UTC(hasta.getUTCFullYear(), hasta.getUTCMonth(), hasta.getUTCDate());

  for (let i = total - 1; i >= 0; i -= 1) {
    fechas.push(new Date(fin - i * 86_400_000).toISOString().slice(0, 10));
  }
  return fechas;
}

/**
 * Rellena los días sin datos con ceros.
 *
 * Es imprescindible: sin esto, un servidor tranquilo tendría una gráfica con
 * huecos que parecería rota, en vez de una línea plana que es la verdad.
 *
 * @param {Array<object>} documentos Documentos de `GuildStats`.
 * @param {string[]} dias Días que debe cubrir la serie.
 * @returns {Array<object>}
 */
export function rellenarDias(documentos, dias) {
  const porFecha = new Map((documentos || []).map((d) => [d.date, d]));

  // El recuento de miembros no se reinicia cada día: si un día no hay dato,
  // lo correcto es arrastrar el último conocido, no pintar un cero.
  let ultimosMiembros = 0;

  return dias.map((date) => {
    const d = porFecha.get(date);
    if (d?.memberCount > 0) ultimosMiembros = d.memberCount;

    return {
      date,
      joins: d?.joins || 0,
      leaves: d?.leaves || 0,
      neto: (d?.joins || 0) - (d?.leaves || 0),
      messages: d?.messages || 0,
      commands: d?.commands || 0,
      voiceMinutes: d?.voiceMinutes || 0,
      moderationActions: d?.moderationActions || 0,
      automodActions: d?.automodActions || 0,
      memberCount: ultimosMiembros,
    };
  });
}

/**
 * Totales y comparación con el periodo anterior.
 *
 * La comparación es lo que convierte un número en información: «1.200
 * mensajes» no dice nada; «1.200, un 30 % menos que la semana pasada» sí.
 *
 * @param {Array<object>} serie Periodo actual, ya relleno.
 * @param {Array<object>} anterior Mismo número de días, justo antes.
 */
export function resumir(serie, anterior = []) {
  const sumar = (lista, campo) => lista.reduce((total, d) => total + (d[campo] || 0), 0);

  const campos = ['joins', 'leaves', 'messages', 'commands', 'voiceMinutes', 'moderationActions'];
  const totales = {};

  for (const campo of campos) {
    const actual = sumar(serie, campo);
    const previo = sumar(anterior, campo);

    totales[campo] = {
      valor: actual,
      anterior: previo,
      // Sin periodo anterior con el que comparar no se inventa un porcentaje.
      variacion: previo > 0 ? Math.round(((actual - previo) / previo) * 100) : null,
    };
  }

  const miembrosInicio = serie[0]?.memberCount || 0;
  const miembrosFin = serie[serie.length - 1]?.memberCount || 0;

  return {
    ...totales,
    crecimiento: {
      valor: miembrosFin - miembrosInicio,
      inicio: miembrosInicio,
      fin: miembrosFin,
    },
    // Retención: de cada 100 que entran, cuántos no se han ido.
    retencion:
      totales.joins.valor > 0
        ? Math.max(
            0,
            Math.round(((totales.joins.valor - totales.leaves.valor) / totales.joins.valor) * 100)
          )
        : null,
  };
}

/**
 * Trazado SVG de una serie: la línea y el área bajo ella.
 *
 * Vive aquí, y no en el componente, para poder probarlo: un `NaN` suelto en un
 * atributo `d` no rompe nada visible en la consola, simplemente no se pinta la
 * gráfica, y es el fallo más fácil de no ver hasta que lo ve un cliente.
 *
 * @param {Array<object>} serie
 * @param {string} campo
 * @param {{ ancho?: number, alto?: number, margen?: number }} [medidas]
 * @returns {{ linea: string, area: string, maximo: number, minimo: number }}
 */
export function trazarSerie(serie, campo, medidas = {}) {
  const ancho = medidas.ancho ?? 700;
  const alto = medidas.alto ?? 180;
  const margen = medidas.margen ?? 4;

  const lista = Array.isArray(serie) && serie.length > 0 ? serie : [{ [campo]: 0 }];
  const valores = lista.map((d) => Number(d?.[campo]) || 0);

  const maximo = Math.max(...valores);
  // El recuento de miembros no empieza en cero: si lo forzáramos, la curva de
  // un servidor de 5.000 miembros sería una raya plana arriba del todo.
  const minimo = campo === 'memberCount' ? Math.min(...valores) : 0;

  // Sin rango (todos los valores iguales) se divide entre 1 para no dar NaN.
  const rango = maximo - minimo || 1;

  // Con un solo punto no hay línea que trazar: se centra.
  const paso = lista.length > 1 ? (ancho - margen * 2) / (lista.length - 1) : 0;

  const puntos = valores.map((valor, i) => {
    const x = lista.length > 1 ? margen + i * paso : ancho / 2;
    const y = alto - margen - ((valor - minimo) / rango) * (alto - margen * 2);
    return [Number(x.toFixed(2)), Number(y.toFixed(2))];
  });

  const linea = puntos.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');

  const primero = puntos[0];
  const ultimo = puntos[puntos.length - 1];
  const area = `${linea} L${ultimo[0]},${alto} L${primero[0]},${alto} Z`;

  return { linea, area, maximo, minimo };
}

/**
 * Canales más activos, sumando todos los días del periodo.
 *
 * @param {Array<object>} documentos
 * @param {number} [tope]
 * @returns {Array<{ channelId: string, mensajes: number }>}
 */
export function canalesMasActivos(documentos, tope = 10) {
  const totales = new Map();

  for (const doc of documentos || []) {
    const mapa = doc.channelMessages;
    if (!mapa) continue;

    // Puede llegar como Map (mongoose) o como objeto plano (`lean()`).
    const entradas = typeof mapa.entries === 'function' ? [...mapa.entries()] : Object.entries(mapa);

    for (const [canal, cantidad] of entradas) {
      totales.set(canal, (totales.get(canal) || 0) + (Number(cantidad) || 0));
    }
  }

  return [...totales.entries()]
    .map(([channelId, mensajes]) => ({ channelId, mensajes }))
    .sort((a, b) => b.mensajes - a.mensajes)
    .slice(0, tope);
}

/**
 * Limitador de peticiones para las rutas de API del panel.
 *
 * Sin esto, cualquiera con una sesión válida podría lanzar miles de guardados
 * por segundo y tumbar la base de datos. Es imprescindible en cuanto el bot
 * deja de ser solo para amigos.
 *
 * Guarda el recuento en memoria: suficiente para un único proceso, que es como
 * se despliega ahora. Si algún día escalas a varias réplicas del panel, cambia
 * este módulo por Redis (ver el apartado de mejoras del README).
 */

/** @type {Map<string, { count: number, resetAt: number }>} */
const contadores = new Map();

/** Limpieza periódica para que el mapa no crezca sin control. */
let limpiador = null;
function iniciarLimpieza() {
  if (limpiador) return;
  limpiador = setInterval(() => {
    const ahora = Date.now();
    for (const [clave, dato] of contadores) {
      if (ahora > dato.resetAt) contadores.delete(clave);
    }
  }, 60_000);
  limpiador.unref?.();
}

/** Reglas por tipo de operación. */
export const REGLAS = {
  /** Guardar configuración: costoso, escribe en base de datos. */
  guardar: { max: 20, ventanaMs: 60_000 },
  /** Leer configuración: barato pero no gratis. */
  leer: { max: 60, ventanaMs: 60_000 },
  /** Publicar en Discord: consume cuota de la API de Discord. */
  publicar: { max: 10, ventanaMs: 60_000 },
  /** Inicio de sesión: frena los intentos automatizados. */
  auth: { max: 15, ventanaMs: 300_000 },
  /** Simulador de AutoMod: se teclea seguido, y no escribe nada. */
  simular: { max: 60, ventanaMs: 60_000 },
  /**
   * Enviar una apelación. Es público (lo usa gente baneada, sin sesión), así
   * que se limita por IP y con mano dura: es el punto más expuesto del panel.
   */
  apelar: { max: 3, ventanaMs: 3_600_000 },
  /** Consultar una clasificación pública: cacheada, pero no ilimitada. */
  publico: { max: 120, ventanaMs: 60_000 },
};

/**
 * Comprueba y consume una petición.
 *
 * @param {string} identificador Normalmente el ID del usuario, o su IP.
 * @param {keyof REGLAS} tipo
 * @returns {{ ok: boolean, restantes: number, resetEnSegundos: number }}
 */
export function checkRateLimit(identificador, tipo = 'leer') {
  iniciarLimpieza();

  const regla = REGLAS[tipo] || REGLAS.leer;
  const clave = `${tipo}:${identificador}`;
  const ahora = Date.now();

  const dato = contadores.get(clave);

  if (!dato || ahora > dato.resetAt) {
    contadores.set(clave, { count: 1, resetAt: ahora + regla.ventanaMs });
    return { ok: true, restantes: regla.max - 1, resetEnSegundos: Math.ceil(regla.ventanaMs / 1000) };
  }

  dato.count += 1;
  const resetEnSegundos = Math.max(1, Math.ceil((dato.resetAt - ahora) / 1000));

  if (dato.count > regla.max) {
    return { ok: false, restantes: 0, resetEnSegundos };
  }

  return { ok: true, restantes: regla.max - dato.count, resetEnSegundos };
}

/**
 * Cabeceras estándar para que el navegador sepa cuánta cuota le queda.
 * @param {{ restantes: number, resetEnSegundos: number }} resultado
 */
export function rateLimitHeaders(resultado, tipo = 'leer') {
  const regla = REGLAS[tipo] || REGLAS.leer;
  return {
    'X-RateLimit-Limit': String(regla.max),
    'X-RateLimit-Remaining': String(Math.max(0, resultado.restantes)),
    'X-RateLimit-Reset': String(resultado.resetEnSegundos),
  };
}

/**
 * IP de quien llama, para limitar las rutas públicas (sin sesión que usar).
 *
 * Se toma el ÚLTIMO valor de `x-forwarded-for`, no el primero. El primero lo
 * puede escribir el propio cliente en su petición (cualquiera puede mandar
 * `X-Forwarded-For: 1.2.3.4` falso) -- el proxy que sí está bajo control
 * (Caddy en el mini PC, o el de Easypanel) AÑADE la IP real al final de la
 * cadena, no la reemplaza. Fiarse del primer valor deja el límite de la
 * página de apelaciones (pública, sin sesión) trivial de saltarse mandando
 * una IP distinta en cada intento.
 *
 * @param {Request} request
 * @returns {string}
 */
export function clientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const partes = forwarded.split(',').map((p) => p.trim());
    return partes[partes.length - 1] || 'desconocida';
  }

  return request.headers.get('x-real-ip') || 'desconocida';
}

/** Vacía los contadores. Solo se usa en las pruebas. */
export function resetRateLimits() {
  contadores.clear();
}

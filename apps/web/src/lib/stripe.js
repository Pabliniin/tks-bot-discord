import Stripe from 'stripe';

/**
 * Cliente de Stripe.
 *
 * Solo el cliente: la traducción entre precios y planes vive en
 * `stripePlans.js`, que no importa el SDK y por eso se puede probar suelto.
 *
 * Todo lo de este archivo se ejecuta en el servidor. La clave secreta no llega
 * jamás al navegador.
 */

/** Instancia reutilizada entre peticiones. */
let cliente = null;

/**
 * Cliente de Stripe, o `null` si no está configurado.
 *
 * Devolver `null` en vez de lanzar es a propósito: el sitio tiene que seguir
 * funcionando sin pasarela, igual que funciona sin Lavalink. Quien llama
 * decide qué enseñar.
 */
export function getStripe() {
  if (cliente) return cliente;

  const clave = process.env.STRIPE_SECRET_KEY;
  if (!clave) return null;

  cliente = new Stripe(clave, {
    // Fijar la versión evita que un cambio en la API de Stripe rompa los
    // cobros sin que hayamos tocado nada.
    apiVersion: '2025-01-27.acacia',
    appInfo: { name: 'TK$ Bot', version: '1.0.0' },
  });

  return cliente;
}

// Se reexporta para no tener que cambiar los `import` que ya existen.
export {
  pagosDisponibles,
  precioDe,
  nivelDePrecio,
  planesALaVenta,
  ESTADOS_CON_ACCESO,
} from './stripePlans';

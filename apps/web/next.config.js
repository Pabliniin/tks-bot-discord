/** @type {import('next').NextConfig} */

/**
 * Política de contenido.
 *
 * Limita de dónde puede cargar cosas la página. Es la defensa de fondo contra
 * la inyección de scripts: aunque alguien lograra colar HTML, el navegador se
 * negaría a ejecutar código de otro origen.
 *
 * `unsafe-inline` y `unsafe-eval` en los scripts son necesarios para Next.js
 * en desarrollo; en producción solo se mantiene `unsafe-inline`, que Next
 * necesita para su hidratación.
 */
function contentSecurityPolicy(esProduccion) {
  const scriptSrc = esProduccion
    ? "'self' 'unsafe-inline'"
    : "'self' 'unsafe-inline' 'unsafe-eval'";

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // Tailwind inyecta estilos en línea y las fuentes vienen de Google.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    // Avatares e iconos de Discord, más las imágenes que ponga el usuario.
    "img-src 'self' data: blob: https:",
    // El navegador solo habla con el propio panel; a Discord va el servidor.
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    esProduccion ? 'upgrade-insecure-requests' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

const esProduccion = process.env.NODE_ENV === 'production';

const nextConfig = {
  reactStrictMode: true,

  // No revelar que el sitio corre sobre Next.js.
  poweredByHeader: false,

  // Comprimir las respuestas.
  compress: true,

  // mongoose nunca se empaqueta: se usa solo en el servidor.
  serverExternalPackages: ['mongoose'],

  // El paquete compartido es CommonJS del monorepo. Hay que transpilarlo para
  // que los componentes de cliente puedan importar sus constantes; sin esto,
  // Fast Refresh falla en desarrollo con "Cannot use 'import.meta'".
  // Los componentes de cliente importan de `@tkbot/shared/src/constants.json`,
  // que no depende de mongoose, así que la base de datos no llega al navegador.
  transpilePackages: ['@tkbot/shared'],

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.discordapp.com' },
      { protocol: 'https', hostname: 'media.discordapp.net' },
    ],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Impide que el navegador adivine el tipo de un archivo.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Nadie puede meter el panel dentro de un iframe (clickjacking).
          { key: 'X-Frame-Options', value: 'DENY' },
          // No filtrar la URL completa al salir del sitio.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Desactivar APIs del navegador que el sitio no usa.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          { key: 'Content-Security-Policy', value: contentSecurityPolicy(esProduccion) },
          // Solo en producción: obliga a HTTPS durante un año.
          ...(esProduccion
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=31536000; includeSubDomains',
                },
              ]
            : []),
        ],
      },
      {
        // Las rutas de API nunca deben cachearse.
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

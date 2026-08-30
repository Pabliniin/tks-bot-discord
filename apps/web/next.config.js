/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // mongoose nunca se empaqueta: se usa solo en el servidor.
  serverExternalPackages: ['mongoose'],

  // El paquete compartido es CommonJS del monorepo. Hay que transpilarlo para
  // que los componentes de cliente puedan importar sus constantes; sin esto,
  // Fast Refresh falla en desarrollo con "Cannot use 'import.meta'".
  // Los componentes de cliente importan de `@tkbot/shared/src/constants`,
  // que no depende de mongoose, así que la base de datos no llega al navegador.
  transpilePackages: ['@tkbot/shared'],

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.discordapp.com' },
      { protocol: 'https', hostname: 'media.discordapp.net' },
    ],
  },

  // Cabeceras de seguridad básicas.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

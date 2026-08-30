/**
 * robots.txt generado por Next.js.
 *
 * El panel y las rutas de API se excluyen del indexado: no aportan nada en
 * buscadores y no queremos que se rastreen páginas que exigen sesión.
 */
export default function robots() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/api/'],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
  };
}

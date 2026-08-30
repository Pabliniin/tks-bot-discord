/**
 * Mapa del sitio para los buscadores.
 * Solo incluye las páginas públicas: el panel exige iniciar sesión.
 */
export default function sitemap() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const ahora = new Date();

  const paginas = [
    { ruta: '', prioridad: 1, frecuencia: 'weekly' },
    { ruta: '/commands', prioridad: 0.9, frecuencia: 'weekly' },
    { ruta: '/premium', prioridad: 0.9, frecuencia: 'monthly' },
    { ruta: '/docs', prioridad: 0.8, frecuencia: 'monthly' },
    { ruta: '/legal/terms', prioridad: 0.3, frecuencia: 'yearly' },
    { ruta: '/legal/privacy', prioridad: 0.3, frecuencia: 'yearly' },
    { ruta: '/legal/refund', prioridad: 0.3, frecuencia: 'yearly' },
    { ruta: '/legal/rules', prioridad: 0.3, frecuencia: 'yearly' },
  ];

  return paginas.map((pagina) => ({
    url: `${site}${pagina.ruta}`,
    lastModified: ahora,
    changeFrequency: pagina.frecuencia,
    priority: pagina.prioridad,
  }));
}

import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const botName = process.env.NEXT_PUBLIC_BOT_NAME || 'TK$ Bot';

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${botName} — Bot para Discord`,
    template: `%s — ${botName}`,
  },
  description:
    'Un bot multipropósito muy personalizable para imagen de bienvenida, registros en profundidad, comandos sociales, moderación y muchos más.',
  keywords: ['discord', 'bot', 'moderación', 'niveles', 'bienvenida', 'tickets', 'automod'],
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    url: siteUrl,
    siteName: botName,
    title: `${botName} — Bot para Discord`,
    description:
      'Crea un servidor profesional de Discord: bienvenidas, niveles, moderación automática, tickets y mucho más.',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${botName} — Bot para Discord`,
    description: 'Crea un servidor profesional de Discord con un solo bot.',
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  themeColor: '#5865F2',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        {/* La fuente se carga con `display=swap` para no bloquear el pintado. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}

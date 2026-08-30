import Navbar from './Navbar';
import Footer from './Footer';

/**
 * Marco común de las páginas legales.
 *
 * El texto es una plantilla de partida: revísalo (o que lo revise alguien con
 * criterio legal) antes de publicar el sitio de cara al público.
 */
export default function LegalLayout({ title, updated, children }) {
  return (
    <>
      <Navbar />

      <main className="container-page min-h-[70vh] py-16">
        <article className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-black text-white sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-ink-400">Última actualización: {updated}</p>

          <div className="mt-6 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
            <strong>Plantilla.</strong> Este texto es un punto de partida genérico. Adáptalo a tu
            caso y revísalo antes de abrir el servicio al público.
          </div>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink-200 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-white [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
            {children}
          </div>
        </article>
      </main>

      <Footer />
    </>
  );
}

import Link from 'next/link';
import { Compass, Home, LayoutDashboard, Terminal } from 'lucide-react';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = { title: 'Página no encontrada' };

/** Pantalla 404 con enlaces útiles en lugar de un callejón sin salida. */
export default function NotFound() {
  return (
    <>
      <Navbar />

      <main className="container-page flex min-h-[70vh] flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ink-800">
          <Compass size={30} className="text-ink-300" />
        </div>

        <p className="mt-6 text-6xl font-black text-gradient sm:text-7xl">404</p>
        <h1 className="mt-2 text-2xl font-bold text-white">Esta página no existe</h1>

        <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-300">
          Puede que el enlace esté mal escrito o que la página ya no esté disponible.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Link href="/" className="btn-primary">
            <Home size={15} />
            Inicio
          </Link>
          <Link href="/dashboard" className="btn-secondary">
            <LayoutDashboard size={15} />
            Panel de control
          </Link>
          <Link href="/commands" className="btn-secondary">
            <Terminal size={15} />
            Comandos
          </Link>
        </div>
      </main>

      <Footer />
    </>
  );
}

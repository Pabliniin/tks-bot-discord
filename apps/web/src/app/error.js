'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

/**
 * Pantalla que se muestra cuando algo falla en una página.
 *
 * Sin este archivo, Next.js enseña una pantalla en blanco con un mensaje
 * genérico en inglés, que en un producto de pago queda muy mal.
 */
export default function Error({ error, reset }) {
  useEffect(() => {
    // Queda registrado en el servidor para poder investigarlo después.
    console.error('Error en la página:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-lg p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger/15">
          <AlertTriangle size={26} className="text-danger" />
        </div>

        <h1 className="mt-5 text-2xl font-black text-white">Algo ha salido mal</h1>

        <p className="mt-3 text-sm leading-relaxed text-ink-300">
          Ha ocurrido un error inesperado al cargar esta página. Puedes intentarlo de nuevo; si se
          repite, avísanos en el servidor de soporte.
        </p>

        {/* El identificador ayuda a localizar el fallo en los registros. */}
        {error?.digest && (
          <p className="mt-4 rounded-lg bg-ink-900 px-3 py-2 font-mono text-xs text-ink-400">
            Referencia: {error.digest}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button type="button" onClick={reset} className="btn-primary">
            <RotateCcw size={15} />
            Intentar de nuevo
          </button>
          <Link href="/" className="btn-secondary">
            <Home size={15} />
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

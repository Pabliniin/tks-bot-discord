'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';

/**
 * Enlace público con botón de copiar.
 *
 * Se usa para la clasificación y para las apelaciones: en ambos casos el
 * enlace hay que dárselo a otra gente, así que copiarlo tiene que ser
 * inmediato. Sin esto tocaría construirlo a mano con el ID del servidor.
 */
export default function CopyLink({ ruta, descripcion }) {
  const [copiado, setCopiado] = useState(false);

  /*
   * La URL se compone en el navegador y no desde una variable de entorno: así
   * es siempre la del dominio por el que se ha entrado, aunque el despliegue
   * tenga varios (dominio propio y el que da el panel de hosting).
   */
  const url = typeof window === 'undefined' ? ruta : `${window.location.origin}${ruta}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles (o sin HTTPS) queda el enlace a la vista
      // para seleccionarlo a mano.
    }
  }

  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900/50 p-3">
      {descripcion && <p className="mb-2 text-xs text-ink-300">{descripcion}</p>}

      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-ink-950 px-2.5 py-1.5 font-mono text-xs text-brand-300">
          {url}
        </code>

        <button
          type="button"
          onClick={copiar}
          className="btn-secondary shrink-0 px-2.5 py-1.5 text-xs"
          aria-label="Copiar el enlace"
        >
          {copiado ? <Check size={13} className="text-success" /> : <Copy size={13} />}
          {copiado ? 'Copiado' : 'Copiar'}
        </button>

        <a
          href={ruta}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost shrink-0 px-2.5 py-1.5 text-xs"
          aria-label="Abrir en una pestaña nueva"
        >
          <ExternalLink size={13} />
        </a>
      </div>
    </div>
  );
}

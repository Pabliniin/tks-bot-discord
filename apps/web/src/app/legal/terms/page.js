import LegalLayout from '@/components/LegalLayout';

export const metadata = { title: 'Términos y condiciones de uso' };

export default function TermsPage() {
  const botName = process.env.NEXT_PUBLIC_BOT_NAME || 'TK$ Bot';

  return (
    <LegalLayout title="Términos y condiciones de uso" updated="30 de agosto de 2026">
      <p>
        Al invitar {botName} a un servidor de Discord o al usar este sitio web, aceptas estos
        términos. Si no estás de acuerdo, no uses el servicio.
      </p>

      <h2>1. Uso del servicio</h2>
      <ul>
        <li>Debes cumplir los Términos de Servicio y las Normas de la Comunidad de Discord.</li>
        <li>
          No puedes usar el bot para acosar, enviar spam, distribuir contenido ilegal ni para
          eludir las medidas de seguridad de Discord.
        </li>
        <li>
          Eres responsable de cómo se configura el bot en tu servidor y de las acciones que ejecute
          siguiendo esa configuración.
        </li>
      </ul>

      <h2>2. Disponibilidad</h2>
      <p>
        El servicio se ofrece «tal cual». Puede haber interrupciones por mantenimiento, fallos o
        cambios en la API de Discord. No garantizamos disponibilidad continua ni ausencia de errores.
      </p>

      <h2>3. Limitación de responsabilidad</h2>
      <p>
        No nos hacemos responsables de pérdidas de datos, sanciones aplicadas por una configuración
        incorrecta ni de daños derivados del uso del bot. Haz copias de seguridad de la configuración
        importante de tu servidor.
      </p>

      <h2>4. Cuentas y acceso</h2>
      <p>
        Podemos retirar el acceso al servicio, total o parcialmente, a cualquier usuario o servidor
        que incumpla estos términos, sin aviso previo.
      </p>

      <h2>5. Cambios</h2>
      <p>
        Estos términos pueden actualizarse. Los cambios se publican en esta página con su fecha. Si
        sigues usando el servicio tras un cambio, se entiende que lo aceptas.
      </p>

      <h2>6. Contacto</h2>
      <p>
        Para cualquier duda sobre estos términos, escríbenos por el servidor de soporte enlazado en
        el pie de página.
      </p>
    </LegalLayout>
  );
}

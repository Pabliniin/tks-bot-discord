import LegalLayout from '@/components/LegalLayout';

export const metadata = { title: 'Política de privacidad' };

export default function PrivacyPage() {
  const botName = process.env.NEXT_PUBLIC_BOT_NAME || 'TK$ Bot';

  return (
    <LegalLayout title="Política de privacidad" updated="30 de agosto de 2026">
      <p>
        Esta página explica qué datos guarda {botName}, para qué los usa y cómo pedir que se borren.
      </p>

      <h2>1. Qué datos guardamos</h2>
      <ul>
        <li>
          <strong>Del servidor:</strong> su identificador y la configuración que introduces en el
          panel (canales, roles, mensajes y ajustes de cada módulo).
        </li>
        <li>
          <strong>De los miembros:</strong> identificador de usuario, experiencia, nivel, número de
          mensajes, minutos en voz, invitaciones, créditos y reputación.
        </li>
        <li>
          <strong>De moderación:</strong> historial de sanciones (tipo, motivo, moderador y fecha) y,
          si activas las transcripciones, el contenido de los tickets cerrados.
        </li>
        <li>
          <strong>De la sesión web:</strong> tu identificador de Discord, tu nombre, tu avatar y un
          token de acceso, guardados en una cookie firmada que caduca a los 7 días.
        </li>
      </ul>

      <h2>2. Qué NO guardamos</h2>
      <ul>
        <li>No almacenamos el contenido de los mensajes del chat, salvo lo que registres a propósito con el módulo de Logs o con las transcripciones de tickets.</li>
        <li>No guardamos contraseñas: la autenticación la gestiona Discord mediante OAuth2.</li>
        <li>No vendemos ni cedemos datos a terceros.</li>
      </ul>

      <h2>3. Para qué los usamos</h2>
      <p>
        Únicamente para que funcionen las características que has activado: calcular niveles, aplicar
        el AutoMod, mostrar rankings, registrar sanciones y mostrarte el panel de control.
      </p>

      <h2>4. Conservación y borrado</h2>
      <ul>
        <li>Los datos se conservan mientras el bot esté en el servidor.</li>
        <li>
          Si expulsas al bot, la configuración se mantiene por si vuelves a invitarlo. Puedes pedir
          su borrado completo por el servidor de soporte.
        </li>
        <li>Cualquier usuario puede solicitar la eliminación de sus datos personales.</li>
      </ul>

      <h2>5. Seguridad</h2>
      <p>
        La conexión con la base de datos y la API interna del bot están restringidas y protegidas por
        claves. Aun así, ningún sistema es infalible: no introduzcas información sensible en los
        campos de configuración.
      </p>

      <h2>6. Contacto</h2>
      <p>
        Para ejercer tus derechos de acceso, rectificación o supresión, escríbenos por el servidor de
        soporte enlazado en el pie de página.
      </p>
    </LegalLayout>
  );
}

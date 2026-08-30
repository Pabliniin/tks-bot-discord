import LegalLayout from '@/components/LegalLayout';

export const metadata = { title: 'Reglas' };

export default function RulesPage() {
  const botName = process.env.NEXT_PUBLIC_BOT_NAME || 'TK$ Bot';

  return (
    <LegalLayout title="Reglas de uso" updated="30 de agosto de 2026">
      <p>
        Estas reglas se aplican al uso de {botName} y a su servidor de soporte. Incumplirlas puede
        suponer la pérdida del acceso al servicio.
      </p>

      <h2>1. Respeto</h2>
      <ul>
        <li>Trata bien a los demás. No se tolera el acoso, el odio ni las amenazas.</li>
        <li>Nada de contenido sexual explícito, gore ni material perturbador.</li>
      </ul>

      <h2>2. Uso del bot</h2>
      <ul>
        <li>No abuses de los comandos ni intentes saturar el bot a propósito.</li>
        <li>No uses el bot para enviar spam ni publicidad no solicitada.</li>
        <li>No intentes explotar fallos: si encuentras uno, avísanos por el soporte.</li>
      </ul>

      <h2>3. Configuración responsable</h2>
      <ul>
        <li>No configures el AutoMod ni el Anti-Raid para sancionar de forma arbitraria.</li>
        <li>Informa a tus miembros de que el módulo de Logs registra su actividad.</li>
        <li>No uses las transcripciones de tickets para exponer conversaciones privadas.</li>
      </ul>

      <h2>4. Soporte</h2>
      <ul>
        <li>Antes de preguntar, consulta la documentación y la sección de preguntas frecuentes.</li>
        <li>No menciones al equipo repetidamente: te responderemos en cuanto podamos.</li>
      </ul>

      <h2>5. Normas de Discord</h2>
      <p>
        En todo caso se aplican los{' '}
        <a
          href="https://discord.com/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-400 hover:underline"
        >
          Términos de Servicio
        </a>{' '}
        y las{' '}
        <a
          href="https://discord.com/guidelines"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-400 hover:underline"
        >
          Normas de la Comunidad
        </a>{' '}
        de Discord.
      </p>
    </LegalLayout>
  );
}

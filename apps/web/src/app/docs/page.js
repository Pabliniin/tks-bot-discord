import Link from 'next/link';
import { MODULES, VARIABLES } from '@tkbot/shared';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { buildInviteUrl } from '@/lib/discord';

export const metadata = {
  title: 'Documentación',
  description: 'Cómo configurar cada módulo de TK$ Bot: bienvenidas, niveles, AutoMod, tickets y más.',
};

/** Guía de primeros pasos. */
const STEPS = [
  {
    title: 'Invita al bot',
    body: 'Pulsa «Añadir a Discord», elige tu servidor y acepta los permisos. Deja marcados todos los permisos que pide: cada módulo necesita los suyos.',
  },
  {
    title: 'Sube su rol',
    body: 'En Ajustes del servidor → Roles, arrastra el rol del bot por encima de los roles que quieras que gestione. Sin esto no podrá dar roles de nivel ni sancionar a nadie.',
  },
  {
    title: 'Abre el panel',
    body: 'Entra en el panel de control, inicia sesión con Discord y elige tu servidor. Verás los 15 módulos en la barra lateral.',
  },
  {
    title: 'Activa lo que necesites',
    body: 'Cada módulo tiene un interruptor principal. Actívalo, rellena los campos y pulsa «Guardar cambios». El bot aplica los cambios al instante.',
  },
];

/** Explicación por módulo, referenciada desde la portada. */
const MODULE_DOCS = {
  welcome: {
    anchor: 'bienvenida',
    body: 'Elige un canal, escribe el mensaje con variables como [user] o [memberCount] y, si quieres, activa la imagen de bienvenida. Puedes usar un fondo propio poniendo la URL de una imagen de 1000×350 px. La despedida se configura igual, más abajo en la misma página.',
  },
  autoresponder: {
    anchor: 'respuestas',
    body: 'Añade tantas reglas como quieras. Cada una tiene un desencadenante, una forma de comparación (contiene, exacto, empieza por, termina en o expresión regular) y una respuesta que puede ser texto o un embed.',
  },
  embeds: {
    anchor: 'embeds',
    body: 'Diseña el embed con la vista previa en vivo, elige el canal y pulsa «Publicar». Si vuelves a editarlo y publicas de nuevo, el bot edita el mensaje original en lugar de enviar uno nuevo.',
  },
  levels: {
    anchor: 'niveles',
    body: 'Los miembros ganan XP al escribir (una vez por minuto, para evitar el spam) y opcionalmente al estar en voz. Puedes dar roles al alcanzar cada nivel, multiplicar la XP de ciertos roles y excluir canales.',
  },
  autoroles: {
    anchor: 'autoroles',
    body: 'Asigna roles automáticamente al entrar. El retardo es útil contra raids: los bots de raid suelen irse antes de recibirlo. También puedes devolver sus roles a quien vuelva al servidor.',
  },
  logs: {
    anchor: 'logs',
    body: 'Activa los eventos que te interesen. Cada uno puede ir a un canal distinto o al canal por defecto. Para saber quién ejecutó cada acción, el bot necesita el permiso «Ver registro de auditoría».',
  },
  colors: {
    anchor: 'colores',
    body: 'Define una lista de colores con su nombre y su código hexadecimal. El bot crea los roles automáticamente la primera vez que alguien pide ese color con el comando color.',
  },
  selfroles: {
    anchor: 'roles',
    body: 'Crea un panel, elige entre botones, menú desplegable o reacciones, añade los roles y pulsa «Publicar». El modo exclusivo permite un solo rol del panel; el modo verificación impide quitárselo.',
  },
  tempchannels: {
    anchor: 'canales-temporales',
    body: 'Elige un canal de voz que hará de «creador». Quien entre en él tendrá su propio canal, con su nombre, y se borrará solo al quedarse vacío.',
  },
  templinks: {
    anchor: 'enlaces-temporales',
    body: 'Permite que tus miembros generen invitaciones de un solo uso con caducidad, sin darles el permiso de crear invitaciones del servidor.',
  },
  antiraid: {
    anchor: 'antiraid',
    body: 'Si entran demasiadas cuentas en poco tiempo, el bot sanciona a los recién llegados y puede subir el nivel de verificación del servidor durante un rato. Requiere Premium.',
  },
  vipProtection: {
    anchor: 'proteccion-vip',
    body: 'Limita cuántos baneos, expulsiones o borrados de canal puede hacer una misma persona por minuto. Si alguien se pasa, se le retiran los roles automáticamente. Requiere Premium.',
  },
  starboard: {
    anchor: 'starboard',
    body: 'Cuando un mensaje recibe suficientes reacciones con el emoji elegido, se copia a un canal destacado. El contador se actualiza solo según suben o bajan las reacciones.',
  },
  automod: {
    anchor: 'automod',
    body: 'Once filtros independientes, cada uno con su propia acción, duración y exclusiones. El umbral de infracciones permite avisar las primeras veces y castigar solo si insisten.',
  },
  tickets: {
    anchor: 'tickets',
    body: 'Crea un panel con un botón. Al pulsarlo se abre un canal privado entre el usuario y tu equipo de soporte. Puedes añadir hasta 5 preguntas que se muestran como formulario al abrir el ticket.',
  },
};

export default function DocsPage() {
  const botName = process.env.NEXT_PUBLIC_BOT_NAME || 'TK$ Bot';

  return (
    <>
      <Navbar />

      <main className="container-page min-h-[70vh] py-16">
        <header className="mx-auto mb-14 max-w-3xl text-center">
          <h1 className="text-3xl font-black text-white sm:text-5xl">Documentación</h1>
          <p className="mt-4 text-ink-300">
            Todo lo que necesitas para configurar {botName} en tu servidor.
          </p>
        </header>

        <div className="mx-auto max-w-3xl space-y-16">
          {/* Primeros pasos */}
          <section id="primeros-pasos">
            <h2 className="text-2xl font-bold text-white">Primeros pasos</h2>
            <ol className="mt-6 space-y-4">
              {STEPS.map((step, index) => (
                <li key={step.title} className="card flex gap-4 p-5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <span>
                    <span className="block font-semibold text-white">{step.title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-ink-300">{step.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {/* Variables */}
          <section id="variables">
            <h2 className="text-2xl font-bold text-white">Variables</h2>
            <p className="mt-2 text-sm text-ink-300">
              Puedes usar estas variables en los mensajes personalizables. Se sustituyen por el valor
              real al enviarse.
            </p>

            <div className="mt-6 space-y-6">
              {Object.entries(VARIABLES).map(([context, list]) => (
                <div key={context} className="card p-5">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-brand-300">
                    {context === 'welcome'
                      ? 'Bienvenida y despedida'
                      : context === 'autoresponder'
                        ? 'Respuestas automáticas'
                        : 'Sistema de niveles'}
                  </h3>
                  <dl className="mt-3 space-y-2">
                    {list.map((variable) => (
                      <div key={variable.tag} className="flex flex-wrap gap-x-3 text-sm">
                        <dt>
                          <code className="rounded bg-ink-900 px-2 py-0.5 font-mono text-brand-200">
                            {variable.tag}
                          </code>
                        </dt>
                        <dd className="text-ink-300">{variable.es}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </section>

          {/* Apartados */}
          <section id="apartados">
            <h2 className="text-2xl font-bold text-white">Apartados</h2>
            <p className="mt-2 text-sm text-ink-300">
              Cada apartado se configura desde su propia página del panel de control.
            </p>

            <div className="mt-6 space-y-4">
              {MODULES.map((module) => {
                const doc = MODULE_DOCS[module.id];
                return (
                  <article
                    key={module.id}
                    id={doc?.anchor || module.id}
                    className="card scroll-mt-24 p-5"
                  >
                    <h3 className="flex items-center gap-2.5 text-base font-bold text-white">
                      <span className="text-xl">{module.icon}</span>
                      {module.es}
                      {module.premium && (
                        <span className="badge bg-warning/15 text-warning">Premium</span>
                      )}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-300">{doc?.body}</p>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Preguntas frecuentes */}
          <section id="faq">
            <h2 className="text-2xl font-bold text-white">Preguntas frecuentes</h2>

            <div className="mt-6 space-y-3">
              {[
                {
                  q: '¿Por qué el bot no da los roles de nivel?',
                  a: 'Casi siempre es la jerarquía: el rol del bot tiene que estar por encima del rol que intenta dar. Compruébalo en Ajustes del servidor → Roles.',
                },
                {
                  q: '¿Cómo cambio el prefijo?',
                  a: 'En Ajustes generales del panel. El prefijo por defecto es «-», y los comandos de barra funcionan siempre, sin importar el prefijo.',
                },
                {
                  q: 'He guardado un cambio y el bot no lo aplica.',
                  a: 'El bot guarda la configuración en caché un minuto y el panel se lo notifica al guardar. Si el bot estaba apagado al guardar, se aplicará como mucho un minuto después de encenderlo.',
                },
                {
                  q: '¿El AutoMod castiga a los moderadores?',
                  a: 'No, si dejas activada la opción «Los moderadores quedan exentos». También puedes excluir roles y canales concretos, filtro a filtro.',
                },
                {
                  q: '¿Los comandos funcionan con barra y con prefijo?',
                  a: 'Sí, los 41 comandos funcionan de las dos formas. Ejecuta «npm run deploy» una vez para registrar los comandos de barra en Discord.',
                },
              ].map((item) => (
                <details key={item.q} className="card group p-5">
                  <summary className="cursor-pointer list-none font-semibold text-white marker:hidden">
                    {item.q}
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-ink-300">{item.a}</p>
                </details>
              ))}
            </div>
          </section>

          <div className="flex flex-wrap justify-center gap-3">
            <a
              href={buildInviteUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              Añadir a Discord
            </a>
            <Link href="/commands" className="btn-secondary">
              Ver todos los comandos
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}

# TK$ Bot

Bot multipropósito para Discord con panel de control web. Réplica funcional de
ProBot: 58 comandos, 18 módulos configurables y el mismo panel — más música y
cobros con Stripe. Código propio, modificable libremente.

---

## Qué incluye

**Bot de Discord** (`apps/bot`)

- 58 comandos que funcionan **a la vez** con prefijo (`-ban`) y con barra (`/ban`).
- 18 módulos: bienvenidas, respuestas automáticas, embeds, niveles, auto-roles,
  logs, colores, roles autoasignables, canales temporales, enlaces temporales,
  anti-raid, protección VIP, starboard, automod, tickets, apelaciones, música,
  sorteos y contadores.
- Tarjetas de imagen generadas al vuelo (bienvenida, rango y perfil).
- AutoMod con 11 filtros independientes.
- Sanciones temporales que se levantan solas aunque reinicies el bot.
- Registros que dicen siempre **quién** hizo **qué** y **a quién**.

**Panel de control** (`apps/web`)

- Sitio público: portada, comandos, documentación, premium y páginas legales.
- Inicio de sesión con Discord (OAuth2).
- Un formulario por módulo, generado a partir de un esquema declarativo.
- Diseñador de embeds con vista previa en vivo.

**Paquete compartido** (`packages/shared`)

- Modelos de MongoDB y constantes que usan tanto el bot como la web.

---

## Lo que no tiene la competencia

Once funciones pensadas para diferenciar el producto de ProBot y similares.
Están todas terminadas y probadas.

| Función | Dónde está | Para qué sirve |
| --- | --- | --- |
| **Cobros con Stripe** | `/premium` | La gente compra sola: elige plan, paga con tarjeta y el premium se activa al momento. Se dan de baja ellos desde el portal de Stripe. Ver [PAGOS.md](PAGOS.md). |
| **Panel de administración** | `/admin` | Cuántos servidores hay, cuántos pagan y cuánto entra al mes. Solo para los dueños y el personal del bot. |
| **Sorteos** | `giveaway` | Con botón en vez de reacción: se comprueban requisitos (rol, antigüedad, nivel) y se dice al momento por qué no puedes entrar. ProBot los hace mal. |
| **Contadores de servidor** | Panel → Contadores | Canales de voz que se renombran solos: «👥 Miembros: 1.234». Se ven desde fuera y hacen algo de publicidad por su cuenta. |
| **Música** | 13 comandos | ProBot no tiene música, y desde que cerraron Groovy y Rythm nadie ha ocupado bien ese hueco. Cola, votación para saltar, filtros y cuatro fuentes. Requiere [Lavalink](MUSICA.md). |
| **Clasificación pública** | `/clasificacion/<servidor>` | Una página web con el ranking del servidor. Cada miembro entra a ver su puesto, y de paso ve tu marca. Es el mejor canal de captación que puede tener un bot. Va apagada por defecto y se activa en Niveles. |
| **Estadísticas** | Panel → Estadísticas | Gráficas de crecimiento, entradas y salidas, retención, mensajes por día y canales más activos, con comparación frente al periodo anterior. |
| **Simulador de AutoMod** | Panel → AutoMod | Escribes un mensaje y dice qué haría el bot, sin tocar Discord. Prueba la configuración de la pantalla **aunque no la hayas guardado**, para no activar filtros a ciegas. |
| **Historial con deshacer** | Panel → Historial | Quién cambió qué y cuándo, con los valores anteriores. Si alguien rompe algo, se deshace con un clic. Se conservan 180 días. |
| **Apelaciones** | `/apelar/<servidor>` | Quien recibe una sanción puede explicar su versión desde una página web. El enlace va en el aviso privado que recibe. El equipo lo revisa desde el panel y puede levantar el baneo desde ahí. |
| **Copias y plantillas** | Panel → Herramientas | Exporta la configuración a un archivo y la restaura, en el mismo servidor o en otro. Cuatro plantillas (Comunidad, Gaming, Soporte y Blindado) que configuran todo de un clic. |

También hay **Panel → Moderación**, para consultar el historial de sanciones de
cualquier miembro sin abrir Discord, y retirar advertencias.

### Detalles que importan

- **La copia portable** quita los canales y roles al exportar, porque no existen
  en otro servidor. La **copia completa** los conserva, para restaurar el mismo.
- **El simulador comparte los detectores con el bot** (`packages/shared/src/automodFilters.js`),
  así que lo que enseña es literalmente lo que aplicará el bot. Si usara una
  copia aparte, acabaría mintiendo en cuanto se tocara una de las dos.
- **La apelación exige iniciar sesión con Discord.** Sin eso, cualquiera podría
  apelar haciéndose pasar por otro y el equipo no podría fiarse de nada.
- **La clasificación pública va apagada por defecto.** Publicar quién habla más
  en un servidor privado sin que su dueño lo pida sería filtrar datos suyos.

---

## Requisitos

| Programa | Versión | Para qué |
|---|---|---|
| [Node.js](https://nodejs.org) | 20 o superior | Ejecutar todo |
| [MongoDB](https://www.mongodb.com/try/download/community) | 6 o superior | Guardar la configuración |

MongoDB puede ser local o gratuito en la nube con
[MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register).

---

## Puesta en marcha en Windows

Solo hay **un paso manual**: rellenar seis datos en un archivo. El resto lo hace
todo `INICIAR.bat`.

### 1. Crear la aplicación en Discord

Entra en <https://discord.com/developers/applications> y pulsa **New Application**.
Ponle el nombre que quieras y quédate con esta pestaña abierta: vas a copiar
tres cosas de aquí.

**En la pestaña «Bot»:**

1. Pulsa **Reset Token** y copia el token. → es `DISCORD_TOKEN`
   *(solo se muestra una vez; si lo pierdes, genera otro)*
2. Baja hasta **Privileged Gateway Intents** y activa los dos interruptores:
   - **SERVER MEMBERS INTENT**
   - **MESSAGE CONTENT INTENT**

   Sin estos dos el bot arranca pero no ve a los miembros ni lee los mensajes,
   así que ni las bienvenidas ni los niveles ni el automod funcionarán.

**En la pestaña «OAuth2»:**

3. Copia el **Client ID**. → es `DISCORD_CLIENT_ID`
4. Pulsa **Reset Secret**, copia el **Client Secret**. → es `DISCORD_CLIENT_SECRET`
5. En **Redirects**, pulsa **Add Redirect** y pega exactamente:

   ```
   http://localhost:3000/api/auth/callback
   ```

   Guarda los cambios abajo del todo.

### 2. Coger tu ID de usuario y el de tu servidor

En Discord, ve a **Ajustes de usuario → Avanzado** y activa el **Modo desarrollador**.
Después:

- Clic derecho sobre tu nombre → **Copiar ID de usuario**. → es `BOT_OWNERS`
- Clic derecho sobre el icono de tu servidor → **Copiar ID del servidor**. → es `DISCORD_DEV_GUILD_ID`

### 3. Rellenar el archivo `.env`

Abre `.env` con el Bloc de notas y pega los cinco valores. Si el archivo no
existe todavía, `INICIAR.bat` lo crea solo la primera vez que lo ejecutes.

```bash
DISCORD_TOKEN=          <- el token del paso 1.1
DISCORD_CLIENT_ID=      <- el Client ID del paso 1.3
DISCORD_CLIENT_SECRET=  <- el Client Secret del paso 1.4
DISCORD_DEV_GUILD_ID=   <- el ID de tu servidor del paso 2
BOT_OWNERS=             <- tu ID de usuario del paso 2
```

Los demás campos ya vienen listos y no hay que tocarlos para usarlo en tu PC.
Las claves `BOT_API_SECRET` y `SESSION_SECRET` ya están generadas.

### 4. Arrancar

Doble clic en **`INICIAR.bat`**.

Se encarga de todo: comprueba que tienes Node.js, instala las dependencias la
primera vez, valida que el `.env` esté completo, comprueba que MongoDB responde,
registra los comandos de barra y arranca el bot y la web a la vez. Al cabo de
unos segundos te abre el navegador en <http://localhost:3000>.

Si falta algún dato del `.env`, te dice **cuál** y te abre el archivo para que lo
rellenes.

> Deja esa ventana negra abierta mientras uses el bot. Para detenerlo, pulsa
> **Ctrl+C** dentro de ella.

### 5. Invitar el bot a tu servidor

En el panel, pulsa **Iniciar sesión**, entra con Discord y verás la lista de tus
servidores. Pulsa **Invitar el bot** en el que quieras.

Después, en Discord: **Ajustes del servidor → Roles**, y arrastra el rol de
TK$ Bot **por encima** de los roles que deba gestionar. Sin eso no podrá dar
roles de nivel ni sancionar a nadie.

### Otros archivos `.bat`

- **`REGISTRAR-COMANDOS.bat`** — vuelve a registrar los comandos de barra.
  Úsalo si añades comandos, o si los comandos con `/` no te aparecen en Discord.

---

## Quién puede entrar al panel

Cualquier persona que inicie sesión con Discord verá **la lista de todos los
servidores donde tiene permisos** para configurar el bot. Se le muestra un
servidor si cumple al menos una de estas condiciones:

| Condición | Etiqueta en el panel |
|---|---|
| Es el dueño del servidor | Dueño del servidor |
| Tiene el permiso **Administrador** | Administrador |
| Tiene el permiso **Gestionar servidor** | Gestionar servidor |

Los servidores se muestran separados en dos grupos: **Con TK$ Bot** (con el botón
de configurar) y **Sin TK$ Bot** (con el botón de invitarlo).

Nadie puede tocar un servidor donde no tenga esos permisos: cada petición al
guardar se vuelve a comprobar contra Discord en el servidor, no en el navegador.
Tampoco se pueden modificar el plan premium ni las estadísticas internas desde
el panel, aunque se manipule la petición.

---

## Subirlo a un servidor

Elige la guía según cómo tengas montado el servidor:

| Tu situación | Guía |
|---|---|
| Uso **Easypanel**, Coolify o similar | **[EASYPANEL.md](EASYPANEL.md)** |
| Tengo un VPS «pelado» con acceso SSH | [DEPLOY.md](DEPLOY.md) |
| Quiero Docker en mi PC o en cualquier sitio | `docker compose up --build` |

**Con Easypanel** creas tres servicios (Mongo, bot y web) apuntando a los
Dockerfiles del proyecto. El propio panel se encarga de Docker, del proxy y del
HTTPS.

**Con un VPS sin panel**, copia la carpeta al servidor (sin `node_modules` ni
`.next`) y ejecuta:

```bash
chmod +x deploy/instalar-vps.sh && ./deploy/instalar-vps.sh tudominio.com
```

El script instala Node, PM2, Nginx y Certbot, genera las claves, compila,
arranca los dos procesos, configura el dominio con HTTPS y cierra el cortafuegos.

---

## Comandos del proyecto

| Comando | Qué hace |
|---|---|
| `npm run dev` | Arranca bot y panel a la vez |
| `npm run bot` | Solo el bot, con recarga automática |
| `npm run web` | Solo el panel, con recarga automática |
| `npm run deploy` | Registra los comandos de barra en el servidor de pruebas |
| `npm run deploy:global` | Los registra globalmente |
| `npm run build` | Compila el panel para producción |
| `npm test` | Ejecuta las 78 pruebas |
| `npm run lint` | Comprueba sintaxis, carga de módulos y definiciones de comandos |
| `npm run gen:commands` | Regenera el catálogo de comandos que usa la web |

> Ejecuta `npm run gen:commands` cada vez que añadas o cambies un comando: así
> la página pública de comandos se mantiene al día aunque el bot esté apagado.

---

## Estructura

```
TK$ BOT/
├── apps/
│   ├── bot/                    Cliente de Discord
│   │   ├── src/
│   │   │   ├── commands/       Los 58 comandos, por categoría
│   │   │   ├── events/         Escuchadores de eventos de Discord
│   │   │   ├── modules/        Lógica de cada módulo del panel
│   │   │   ├── canvas/         Generación de las tarjetas de imagen
│   │   │   ├── structures/     Cliente, contexto de comandos, permisos
│   │   │   ├── utils/          Utilidades (tiempo, embeds, filtros…)
│   │   │   └── api/            API interna que consume el panel
│   │   ├── assets/fonts/       Fuentes propias para las tarjetas (opcional)
│   │   └── tests/              Pruebas del bot
│   └── web/                    Sitio y panel (Next.js)
│       ├── src/app/            Páginas y rutas de API
│       │   ├── clasificacion/  Clasificación pública (sin sesión)
│       │   ├── apelar/         Formulario público de apelación
│       │   └── dashboard/      Panel: módulos y secciones de gestión
│       ├── src/components/     Componentes de interfaz
│       ├── src/lib/            Sesión, OAuth, esquemas y lógica pura
│       └── tests/              Pruebas del panel
├── packages/shared/            Modelos de MongoDB y lógica compartida
└── scripts/                    Validación y generación del catálogo
```

**Dónde vive la lógica que se prueba.** Todo lo que es cálculo puro está en
módulos sin dependencias de Next.js ni de mongoose, para poder probarlo con
`node --test` sin levantar nada:

| Archivo | Qué resuelve |
| --- | --- |
| `packages/shared/src/automodFilters.js` | Los detectores del AutoMod. Los comparten el bot y el simulador del panel. |
| `packages/shared/src/automodSimulator.js` | Qué haría el bot con un mensaje dado. |
| `packages/shared/src/backup.js` | Construir y leer las copias de seguridad. |
| `packages/shared/src/templates.js` | Las cuatro plantillas de configuración. |
| `apps/web/src/lib/configHistory.js` | Guardar los valores anteriores para poder deshacer. |
| `apps/web/src/lib/guildStats.js` | Series de las gráficas y el trazado del SVG. |
| `apps/web/src/lib/mergeLogEvents.js` | Combinar los eventos de registro sin pisar los ya guardados. |
| `apps/web/src/lib/saveSettings.js` | Único punto por el que se escribe la configuración. |

---

## Cómo modificarlo

### Añadir un comando

Crea un archivo en `apps/bot/src/commands/<categoría>/`:

```js
'use strict';
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  name: 'saludo',
  category: 'general',
  aliases: ['hola'],
  description: 'Saluda a alguien.',
  usage: '[usuario]',
  cooldown: 3,

  data: new SlashCommandBuilder()
    .setName('saludo')
    .setDescription('Saluda a alguien.')
    .addUserOption((o) => o.setName('usuario').setDescription('A quién').setRequired(false)),

  async execute(ctx) {
    const objetivo = ctx.options.getUser('usuario') || ctx.user;
    await ctx.reply(`¡Hola ${objetivo}!`);
  },
};
```

El bot lo carga solo al arrancar y funcionará con prefijo y con barra sin tocar
nada más. Después ejecuta `npm run deploy` y `npm run gen:commands`.

### Añadir un ajuste al panel

1. Añade el campo al esquema en `packages/shared/src/models/Guild.js`.
2. Añade el campo al formulario en `apps/web/src/lib/moduleSchemas.js`.

No hace falta escribir interfaz: el formulario se genera a partir del esquema.
Los tipos disponibles son `toggle`, `text`, `textarea`, `number`, `select`,
`color`, `emoji`, `channel`, `channels`, `role`, `roles`, `tags`, `embed` y `list`.

### Cambiar la marca

- Nombre, lema y colores: `packages/shared/src/constants.json`.
- Paleta de la web: `apps/web/tailwind.config.js`.
- Logotipo: `apps/web/src/components/Logo.js`.
- Fuente de las tarjetas: pon un `.ttf` en `apps/bot/assets/fonts/` y se usará
  automáticamente.

---

## Administrar el bot: premium y personal

Hay dos comandos de administración. **No aparecen en `/help` ni en la web
pública**: solo los ve quien tiene permiso.

### Quién puede qué

| Nivel | Quién es | Puede |
|---|---|---|
| **Dueño** | Los IDs de `BOT_OWNERS` en el `.env` | Todo, incluido nombrar personal |
| **Personal** | A quien nombres con `/staff add` | Repartir premium |
| Resto | Todos los demás | Nada de esto |

Un miembro del personal **no puede** modificar la lista de personal ni
destituirte. Así, aunque su cuenta se vea comprometida, no puede darse más
permisos. Los dueños solo se cambian editando `BOT_OWNERS` y reiniciando el bot.

### `/premium` — repartir suscripciones

Para ti y para el personal que nombres.

```bash
/premium add servidor:123456789012345678 nivel:2 duracion:30d
/premium add servidor:123456789012345678 nivel:1          # sin caducidad
/premium remove servidor:123456789012345678
/premium info servidor:123456789012345678                 # vacío = servidor actual
/premium list                                             # todos los que tienen premium
```

La duración admite `30d`, `6meses`, `1año`, `2semanas`… Si la dejas vacía, el
premium no caduca. El cambio se aplica al instante, sin reiniciar nada.

Todas las respuestas son **efímeras**: solo las ves tú, aunque lo uses en un
canal público.

### `/staff` — decidir quién reparte premium

Solo para los dueños.

```bash
/staff add @Amigo       # ahora puede usar /premium
/staff remove @Amigo    # se lo retiras
/staff list             # ver dueños y personal
```

Quien añadas recibe un mensaje privado avisándole.

### Poner tu ID en `BOT_OWNERS`

Sin esto no podrás usar `/staff`. En Discord, activa el **Modo desarrollador**
(Ajustes de usuario → Avanzado), haz clic derecho sobre tu nombre y copia tu ID.
Después ponlo en el `.env`:

```bash
BOT_OWNERS=TU_ID_DE_USUARIO
```

Si sois varios dueños, sepáralos por comas:

```bash
BOT_OWNERS=111111111111111111,222222222222222222
```

> En Easypanel esto se cambia en **Entorno** del servicio `bot`, y luego hay que
> pulsar **Implementar**.

### Cambiarlo a mano en la base de datos

Si prefieres no usar los comandos:

```js
db.guilds.updateOne(
  { guildId: "ID_DEL_SERVIDOR" },
  { $set: { "premium.tier": 2, "premium.until": new Date("2027-01-01") } }
)
```

No hay pasarela de pago conectada. Si quieres cobrar de verdad, integra Stripe o
PayPal en `apps/web/src/app/premium/page.js` y haz que al cobrar escriba esos
mismos campos.

---

## El botón «Añadir aplicación» del perfil del bot

Cuando alguien pulsa el nombre del bot en Discord, sale una tarjeta con un
botón **+ Añadir aplicación**. Ese botón **no funciona solo**: hay que
configurarlo en el portal de Discord, y por defecto viene desactivado.

Ve a [discord.com/developers/applications](https://discord.com/developers/applications),
elige tu aplicación y abre **Installation** en el menú de la izquierda:

**1. Install Link**
Cámbialo de `None` a **Discord Provided Link**. Esto es lo que enciende el
botón. Sin ello no hace nada al pulsarlo.

**2. Installation Contexts**
Marca **Guild Install**. Deja **User Install** desmarcado: este bot está hecho
para servidores, y activarlo dejaría que la gente lo «instalara» en su cuenta
sin que funcionara nada.

**3. Default Install Settings** → *Guild Install*

- **Scopes:** `bot` y `applications.commands`
- **Permissions:** marca los que necesita el bot. La forma rápida es pegar el
  número de permisos: en la misma página hay un calculador, o usa el enlace de
  invitación que genera el panel, que ya lleva los correctos.

**4. Guarda los cambios** (botón *Save Changes* abajo).

El cambio tarda unos minutos en verse. Cierra Discord del todo y vuelve a
abrirlo si sigue sin salir.

> **Nota sobre el número de permisos.** El valor correcto está en
> `packages/shared/src/constants.json` (`REQUIRED_PERMISSIONS`). Si lo pones a
> mano en el portal, asegúrate de incluir **Enviar mensajes**, **Adjuntar
> archivos**, **Leer historial** y **Conectar/Hablar** en voz: sin el primero
> el bot es mudo, sin el segundo no salen las tarjetas de bienvenida y de
> rango, y sin los últimos no funciona la música ni los canales temporales.

### La «Web oficial» y la descripción del perfil

En la misma aplicación, en **General Information**:

- **Description** — el texto que sale bajo el nombre en la tarjeta del perfil.
- **Terms of Service URL** — `https://tudominio/legal/terms`
- **Privacy Policy URL** — `https://tudominio/legal/privacy`

Las dos últimas son **obligatorias** si algún día quieres verificar el bot
(hace falta a partir de 75 servidores). Ya las tienes hechas en el panel.

---

## Problemas frecuentes

**«Faltan variables de entorno»** — No has copiado `.env.example` a `.env`, o
falta algún valor. El bot dice cuáles.

**El botón «Añadir aplicación» no hace nada** — Falta configurar el *Install
Link* en el portal de Discord. Ver el apartado de arriba.

**Los comandos de música dicen que no está configurado** — Falta el servicio
Lavalink. Las instrucciones están en [MUSICA.md](MUSICA.md). El resto del bot
funciona igual sin él.

**El bot arranca pero no responde a los comandos** — Faltan los *intents*
privilegiados. Actívalos en el portal de Discord (paso 1.2) y reinicia el bot.

**«Used disallowed intents»** — Lo mismo: los dos intents no están activados.

**No da los roles de nivel** — El rol del bot está por debajo del rol que
intenta asignar. Súbelo en Ajustes del servidor → Roles.

**El panel no muestra canales ni roles** — El bot está apagado o no está en ese
servidor. El panel avisa en la parte superior cuando ocurre.

**Guardo un cambio y el bot no lo aplica** — El bot cachea la configuración un
minuto y el panel se lo notifica al guardar. Si el bot estaba apagado, se
aplicará como mucho un minuto después de encenderlo.

**`EADDRINUSE` en el puerto 3001** — Otro proceso usa el puerto de la API
interna. Cambia `BOT_API_PORT` en el `.env`.

**Errores raros del panel en desarrollo** — Borra la caché con el servidor
**parado** y vuelve a arrancar. En PowerShell, de uno en uno:

```powershell
Remove-Item -Recurse -Force apps\web\.next
```

```powershell
npm run web
```

> En PowerShell no existen `rm -rf` ni el operador `&&`. Si prefieres esos
> comandos, usa Git Bash, que se instala junto con Git.

---

## Notas técnicas

- **Comandos híbridos.** `apps/bot/src/structures/OptionResolver.js` convierte
  los argumentos de texto de un comando por prefijo en las mismas opciones que
  entrega una interacción de barra, usando la definición del `SlashCommandBuilder`.
  Por eso cada comando se escribe una sola vez.

- **Caché de configuración.** El bot guarda los ajustes de cada servidor durante
  60 segundos. Al guardar en el panel, la web llama a la API interna del bot
  para invalidar esa entrada y que el cambio se aplique al momento.

- **Seguridad del panel.** Las rutas de API comprueban que el usuario tenga
  «Gestionar servidor» en ese servidor concreto, y filtran lo que se puede
  escribir (`apps/web/src/lib/editableKeys.js`): `premium`, `stats` y `guildId`
  no son modificables desde el navegador.

- **API interna.** Escucha solo en `127.0.0.1` y exige la cabecera
  `x-api-key`. Nunca la expongas a internet.

- **Escalado.** El XP se acumula en memoria y solo se escribe en MongoDB una vez
  por usuario y minuto. Las estadísticas diarias hacen lo mismo: se acumulan en
  memoria y se vuelcan cada dos minutos en una sola operación por lotes, así que
  un servidor con mucho tráfico no genera una escritura por mensaje. Con muchos
  servidores, lo primero que conviene añadir es Redis para la caché de
  configuración y para el limitador de peticiones.

- **Un solo punto de escritura.** Toda la configuración se guarda a través de
  `apps/web/src/lib/saveSettings.js`, lo use el formulario, una plantilla, la
  importación de una copia o el botón de deshacer. Así ninguna de esas vías se
  puede saltar la validación ni dejar de anotarse en el historial.

- **Datos que caducan solos.** El historial de cambios se borra a los 180 días y
  las estadísticas a los 400, mediante índices TTL de MongoDB. No hace falta
  ninguna tarea de limpieza.

- **Gráficas sin librerías.** Las del panel se dibujan con SVG escrito a mano.
  Cualquier librería de gráficas habitual añadiría entre 50 y 150 KB al paquete,
  y aquí solo hacen falta una línea y unas barras. El trazado vive en
  `apps/web/src/lib/guildStats.js` porque allí está probado: un `NaN` en un
  atributo `d` no da ningún error, solo deja la gráfica en blanco.

---

## Aviso legal

Este proyecto replica las **funcionalidades** de ProBot con código escrito desde
cero. No incluye código, assets, logotipos ni textos de marca de ProBot. Las
páginas legales (`/legal/*`) son plantillas genéricas: revísalas antes de abrir
el servicio al público.

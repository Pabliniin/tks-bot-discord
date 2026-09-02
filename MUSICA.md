# Sistema de música

El bot no procesa el audio él mismo: se lo pide a **Lavalink**, un servicio
aparte. Esta guía explica cómo montarlo.

> **Sin Lavalink, todo lo demás del bot funciona igual.** Los comandos de
> música simplemente dicen que no está configurado. Puedes dejarlo para después.

---

## Por qué un servicio aparte

Podría hacerlo el propio bot, pero sería peor por dos motivos:

**Consume mucha CPU.** Decodificar y transmitir audio es de lo más caro que
puede hacer un proceso. Con varios servidores sonando a la vez, un bot que
procese el audio él mismo se queda sin recursos y empieza a fallar en todo lo
demás: comandos lentos, registros que no salen, moderación que llega tarde.

**Se rompe constantemente.** YouTube cambia sus defensas cada pocas semanas y
las librerías de Node que extraen audio se rompen con cada cambio. Lavalink se
actualiza por su cuenta: cambias la versión de la imagen y vuelve a funcionar,
sin tocar el bot ni volver a desplegarlo.

Es lo que usan todos los bots de música serios.

---

## Opción A: Easypanel (tu caso)

### 1. Crear el servicio

En tu proyecto `tks_bot`:

1. **+ Service** → **App**
2. Nombre: `lavalink`
3. En **Source**, elige **Docker Image**
4. Imagen: `ghcr.io/lavalink-devs/lavalink:4`

### 2. Variables de entorno

En la pestaña **Environment**, pega esto (cambia la contraseña):

```
_JAVA_OPTIONS=-Xmx512m
SERVER_PORT=2333
SERVER_ADDRESS=0.0.0.0
LAVALINK_SERVER_PASSWORD=pon_aqui_una_contraseña_larga
LAVALINK_SERVER_SOURCES_YOUTUBE=true
LAVALINK_SERVER_SOURCES_SOUNDCLOUD=true
LAVALINK_SERVER_SOURCES_BANDCAMP=true
LAVALINK_SERVER_SOURCES_TWITCH=true
LAVALINK_SERVER_SOURCES_HTTP=true
```

Genera la contraseña con este comando, igual que hiciste con las otras:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

### 3. No le pongas dominio

**Importante:** en la pestaña **Domains**, no añadas ninguno. Lavalink solo lo
tiene que alcanzar el bot por la red interna. Si lo publicas en internet,
cualquiera con la contraseña puede usar tu servidor para transmitir audio.

### 4. Memoria

En **Advanced** → **Resources**, ponle un límite de **768 MB**. Lavalink es
Java y sin límite puede acabar comiéndose la RAM del servidor.

### 5. Conectar el bot

En el servicio `bot`, añade estas tres variables:

```
LAVALINK_HOST=tks_bot_lavalink:2333
LAVALINK_PASSWORD=la_misma_contraseña_de_arriba
LAVALINK_SECURE=false
```

> El nombre `tks_bot_lavalink` sale de juntar tu proyecto (`tks_bot`) con el
> nombre del servicio (`lavalink`). Es como Easypanel resuelve la red interna.

### 6. Desplegar

Despliega primero `lavalink`, espera a que arranque (Java tarda unos 30-60
segundos la primera vez) y luego redespliega `bot`.

En los registros del bot debe salir:

```
MUSIC  Lavalink «principal» conectado.
```

---

## Opción B: Todo con docker-compose

Si usas `docker-compose.yml`, Lavalink ya viene incluido. Solo tienes que
poner la contraseña en tu `.env`:

```
LAVALINK_PASSWORD=pon_aqui_una_contraseña_larga
```

Y arrancar como siempre:

```bash
docker compose up --build
```

---

## Opción C: En tu PC, para probar

Necesitas **Java 17 o superior**. Comprueba si lo tienes:

```bash
java -version
```

Si no lo tienes, descárgalo de [adoptium.net](https://adoptium.net).

Luego:

```bash
docker run -d --name lavalink -p 2333:2333 -e LAVALINK_SERVER_PASSWORD=prueba123 ghcr.io/lavalink-devs/lavalink:4
```

Y en tu `.env`:

```
LAVALINK_HOST=localhost:2333
LAVALINK_PASSWORD=prueba123
LAVALINK_SECURE=false
```

---

## Comprobar que funciona

1. Entra en un canal de voz de tu servidor.
2. Escribe `-play` seguido de una canción. Por ejemplo:

```
-play bad bunny monaco
```

Si sale un mensaje diciendo que el sistema no está configurado, revisa que las
tres variables del bot estén bien y que el servicio `lavalink` esté encendido.

---

## Los comandos

| Comando | Qué hace |
| --- | --- |
| `play <canción>` | Reproduce o añade a la cola. Acepta nombres y enlaces. |
| `skip` | Salta. Si hay más gente escuchando, se vota. |
| `stop` | Para todo y sale del canal. |
| `queue [página]` | Enseña la cola con el progreso de lo que suena. |
| `nowplaying` | Qué suena y por dónde va. |
| `pause` | Pausa o reanuda (el mismo comando hace las dos cosas). |
| `volume [0-200]` | Consulta o cambia el volumen. |
| `loop [off\|cancion\|cola]` | Repite. Sin argumento va rotando entre los tres. |
| `shuffle` | Mezcla la cola. |
| `remove <número>` | Quita una canción de la cola. |
| `seek <tiempo>` | Salta a un momento: `1:30`, `90`, `2m30s`. |
| `clearqueue` | Vacía la cola sin parar lo que suena. |
| `filter <efecto>` | Efectos de audio. **Premium.** |

Todos funcionan con prefijo (`-play`) y con barra (`/play`).

### Filtros disponibles (Premium)

`bassboost` · `nightcore` · `vaporwave` · `karaoke` · `ochodimensional` ·
`ninguno` (para quitarlos)

Son de pago porque consumen CPU extra en Lavalink. El resto de la música
funciona igual sin Premium.

---

## Quién puede controlar la música

Por defecto **cualquiera** puede usar los comandos, que es lo razonable en un
servidor de amigos. En el panel (módulo **Música**) puedes cambiarlo:

- **Rol de DJ** — quien lo tenga salta y para sin votar.
- **Solo el DJ** — el resto solo puede pedir canciones.
- **Votos para saltar** — qué porcentaje de los oyentes hace falta.

Tres cosas pasan siempre, sin configurar nada:

- **Quien pidió una canción puede saltarla**, aunque no sea DJ. Es su canción.
- **Si estás solo escuchando, no se vota.** No tiene sentido pedirte permiso.
- **Para `stop` con más gente delante hace falta ser DJ de verdad.** Parar
  afecta a todos, así que ahí no vale «la puse yo».

---

## Si algo no funciona

**«El sistema de música no está configurado»**
Al bot le faltan `LAVALINK_HOST` o `LAVALINK_PASSWORD`. Revísalas y
redespliega el servicio `bot`.

**«El servidor de música no responde»**
Lavalink está apagado o arrancando. Java tarda hasta un minuto la primera vez.
Mira los registros del servicio `lavalink`.

**No encuentra nada al buscar**
Prueba a pegar el enlace directamente. Si con enlace tampoco funciona,
actualiza la imagen de Lavalink: en Easypanel, **Deploy** en el servicio
`lavalink` vuelve a bajar la última versión.

**Se oye entrecortado**
Súbele la memoria a Lavalink (`_JAVA_OPTIONS=-Xmx1024m`) o dale más CPU al
servidor. Es lo único del bot que necesita recursos de verdad.

**El bot entra pero no se oye nada**
Comprueba que tiene permiso de **Hablar** en ese canal de voz, y que no está
silenciado por el servidor (icono de micrófono tachado en la lista).

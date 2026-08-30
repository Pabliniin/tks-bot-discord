# Desplegar TK$ Bot en Easypanel

Guía para la pantalla en la que estás: proyecto `tks_bot`, botón **+ Servicio**.

Easypanel se encarga de Docker, del proxy inverso y de los certificados HTTPS,
así que **no necesitas PM2 ni Nginx ni Certbot**. Ignora `DEPLOY.md`: esa guía
es para un VPS sin panel.

Vas a crear **tres servicios**:

| Servicio | Tipo | Para qué |
|---|---|---|
| `mongo` | Mongo | Base de datos |
| `bot` | Aplicación | El bot de Discord |
| `web` | Aplicación | El panel web |

---

## Paso 0: subir el código a GitHub

Easypanel despliega desde un repositorio.

### La forma fácil

1. Crea el repositorio en <https://github.com/new>:
   - **Nombre:** `tkbot`
   - Marca **Private** (privado)
   - **No marques nada más**: ni README, ni .gitignore, ni licencia
   - Pulsa **Create repository** y copia la URL que te muestra

2. Doble clic en **`SUBIR-A-GITHUB.bat`**.

   Te pedirá tu nombre, tu correo y esa URL. Configura Git, comprueba que no se
   suba ningún archivo `.env` con tus claves, y sube todo. La primera vez se
   abrirá el navegador para que inicies sesión en GitHub.

3. En Easypanel, ve a **Ajustes → Git** y conecta tu cuenta de GitHub.

### Si prefieres hacerlo a mano

En PowerShell (el terminal de Windows) los comandos van **de uno en uno**.
`&&` no funciona en PowerShell, da error de sintaxis:

```powershell
cd "$HOME\Desktop\Rogue\Personal\TK`$\BOT"
```

```powershell
git config --global user.name "Tu Nombre"
```

```powershell
git config --global user.email "tu@correo.com"
```

```powershell
git init -b main
```

```powershell
git add .
```

```powershell
git commit -m "TK$ Bot"
```

```powershell
git remote add origin https://github.com/TU_USUARIO/tkbot.git
```

```powershell
git push -u origin main
```

> El `.gitignore` ya excluye `.env`, `node_modules` y `.next`. Aun así,
> comprueba en GitHub que **no aparece ningún archivo `.env`** antes de seguir.
> Son 176 archivos y algo más de 1 MB.

---

## Paso 1: la base de datos

En la pantalla donde estás, pulsa **Mongo**.

- **Nombre del servicio:** `mongo`
- Deja el resto por defecto y pulsa **Crear**.

Cuando termine, entra en el servicio y busca la sección de **credenciales** o
**Connection URL**. Copia la cadena interna, que tendrá esta forma:

```
mongodb://mongo:LA_CONTRASEÑA@tks_bot_mongo:27017/mongo?authSource=admin
```

Guárdala: la vas a pegar en los dos servicios siguientes.

> `tks_bot_mongo` es el nombre interno: tu proyecto (`tks_bot`) más el nombre
> del servicio (`mongo`). Así se llaman entre sí los servicios de un proyecto.

---

## Paso 2: el bot

Pulsa **+ Servicio → Aplicación**.

- **Nombre del servicio:** `bot`

### Pestaña «Source» (origen)

- **Tipo:** GitHub
- **Repositorio:** tu repositorio
- **Rama:** `main`
- **Build Path** / ruta de construcción: `/` (la raíz)

### Pestaña «Build» (construcción)

- **Método:** `Dockerfile`
- **Dockerfile Path:** `apps/bot/Dockerfile`

### Pestaña «Environment» (variables)

Pega esto, cambiando los valores en mayúsculas:

```bash
NODE_ENV=production

DISCORD_TOKEN=TU_TOKEN_DE_DISCORD
DISCORD_CLIENT_ID=TU_CLIENT_ID
DISCORD_CLIENT_SECRET=TU_CLIENT_SECRET
BOT_OWNERS=TU_ID_DE_USUARIO

MONGODB_URI=LA_CADENA_DE_MONGO_DEL_PASO_1

BOT_API_HOST=0.0.0.0
BOT_API_PORT=3001
BOT_API_SECRET=GENERA_UNA_CLAVE_LARGA

AUTO_DEPLOY_COMMANDS=true

NEXT_PUBLIC_SITE_URL=https://TU_DOMINIO
```

Para generar `BOT_API_SECRET`, ejecuta esto en tu PC y pega el resultado:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> **`BOT_API_HOST=0.0.0.0`** es imprescindible: el bot y la web van en
> contenedores distintos, así que la API tiene que aceptar la red interna.
> No expongas el puerto 3001 (no le pongas dominio a este servicio).
>
> **`AUTO_DEPLOY_COMMANDS=true`** registra los comandos de barra al arrancar,
> así no tienes que entrar por consola al contenedor.

### Pestaña «Domains» (dominios)

**No añadas ninguno.** El bot no es una web: solo debe ser accesible desde
dentro del proyecto.

Pulsa **Desplegar**.

---

## Paso 3: el panel web

Pulsa **+ Servicio → Aplicación**.

- **Nombre del servicio:** `web`

### Pestaña «Source»

Igual que el bot: mismo repositorio, rama `main`, Build Path `/`.

### Pestaña «Build»

- **Método:** `Dockerfile`
- **Dockerfile Path:** `apps/web/Dockerfile`

### Pestaña «Environment»

```bash
NODE_ENV=production

DISCORD_CLIENT_ID=TU_CLIENT_ID
DISCORD_CLIENT_SECRET=TU_CLIENT_SECRET
DISCORD_REDIRECT_URI=https://TU_DOMINIO/api/auth/callback

MONGODB_URI=LA_MISMA_CADENA_DE_MONGO_DEL_PASO_1

SESSION_SECRET=GENERA_OTRA_CLAVE_LARGA

BOT_API_URL=http://tks_bot_bot:3001
BOT_API_SECRET=LA_MISMA_CLAVE_QUE_PUSISTE_EN_EL_BOT

NEXT_PUBLIC_SITE_URL=https://TU_DOMINIO
NEXT_PUBLIC_BOT_NAME=TK$ Bot
NEXT_PUBLIC_SUPPORT_INVITE=https://discord.gg/TU_INVITACION
```

Dos cosas que suelen fallar aquí:

- **`BOT_API_URL=http://tks_bot_bot:3001`** — es `proyecto_servicio`. Si a tu
  proyecto o al servicio del bot les pusiste otro nombre, ajústalo.
- **`BOT_API_SECRET`** tiene que ser **exactamente la misma** que en el bot, o
  el panel no podrá leer los canales ni los roles de tus servidores.

### Pestaña «Domains»

- Pulsa **Añadir dominio**
- **Host:** tu dominio (por ejemplo `tkbot.midominio.com`)
- **Puerto:** `3000`
- Activa **HTTPS**

Easypanel saca el certificado solo. Antes, el dominio debe apuntar por DNS a
la IP de tu VPS: `72.61.157.48`.

Pulsa **Desplegar**.

---

## Paso 4: avisar a Discord del dominio

En <https://discord.com/developers/applications> → tu aplicación → **OAuth2** →
**Redirects**, añade:

```
https://TU_DOMINIO/api/auth/callback
```

Tiene que coincidir **carácter por carácter** con `DISCORD_REDIRECT_URI`.
Guarda los cambios abajo del todo.

Aprovecha y comprueba en la pestaña **Bot** que siguen activados
**SERVER MEMBERS INTENT** y **MESSAGE CONTENT INTENT**.

---

## Listo

Entra en `https://TU_DOMINIO`, inicia sesión con Discord y verás tus servidores.

---

## Comprobar que todo va bien

En Easypanel, cada servicio tiene una pestaña de **Logs**:

**`bot`** — debe mostrar algo así:

```
INFO  Conectando a MongoDB...
READY MongoDB conectado
CMDS  41 comandos cargados (88 alias)
EVENT 27 eventos registrados
MODS  14 módulos cargados
API   API interna escuchando en http://0.0.0.0:3001
READY Conectado como TK$ Bot#1234
READY 41 comandos de barra registrados globalmente
```

**`web`** — debe mostrar:

```
▲ Next.js 15.5.24
- Local: http://localhost:3000
✓ Ready in ...
```

---

## Actualizar cuando cambies algo

1. En tu PC, vuelve a ejecutar **`SUBIR-A-GITHUB.bat`**: detecta que el
   repositorio ya existe y solo sube lo que hayas cambiado.

   A mano sería, de uno en uno (recuerda: en PowerShell no funciona `&&`):

   ```powershell
   git add .
   ```

   ```powershell
   git commit -m "cambios"
   ```

   ```powershell
   git push
   ```

2. En Easypanel, entra en el servicio y pulsa **Desplegar**.

Puedes activar **Auto Deploy** en la pestaña Source para que se despliegue solo
con cada `git push`.

> Si cambias o añades comandos, ejecuta antes `npm run gen:commands` en tu PC
> para que la página pública de comandos se actualice.

---

## Si algo falla

**El bot dice «El token de Discord no es válido»**
El `DISCORD_TOKEN` está mal copiado, o le sobra un espacio. Genera uno nuevo en
el portal de Discord y vuelve a pegarlo.

**El bot dice «Faltan los intents privilegiados»**
Activa SERVER MEMBERS INTENT y MESSAGE CONTENT INTENT en el portal de Discord y
reinicia el servicio.

**El bot no arranca la API y avisa de `BOT_API_SECRET`**
La clave tiene menos de 24 caracteres. Con `BOT_API_HOST=0.0.0.0` se exige una
clave larga a propósito. Genera una nueva.

**No conecta con MongoDB**
Copia otra vez la cadena desde el servicio `mongo` de Easypanel. Debe apuntar a
`tks_bot_mongo`, no a `localhost` ni a `127.0.0.1`.

**El panel carga pero no muestra canales ni roles**
La web no está llegando al bot. Revisa que `BOT_API_URL` sea
`http://tks_bot_bot:3001` y que `BOT_API_SECRET` sea idéntica en los dos
servicios. Comprueba también que el bot esté en marcha.

**Discord dice «Invalid OAuth2 redirect_uri»**
`DISCORD_REDIRECT_URI` no coincide con la del portal de Discord. Repasa que
ambas empiecen por `https://` y no sobre ninguna barra al final.

**Inicio sesión y vuelvo a la portada sin entrar**
Falta el HTTPS en el dominio. Actívalo en la pestaña Domains del servicio `web`.

**El despliegue falla al construir**
Mira los logs de construcción. Si se queda sin memoria, en Easypanel puedes
subir el límite del servicio, o crear espacio de intercambio en el VPS:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
```

---

## Copias de seguridad

En el servicio `mongo`, pestaña **Backups**, configura una copia diaria hacia
S3 o hacia el disco del servidor. Ahí está toda la configuración de los
servidores que usen tu bot.

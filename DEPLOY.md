# Desplegar TK$ Bot en un VPS de Hostinger

Guía completa desde un VPS recién creado hasta la web funcionando con HTTPS.
Tiempo aproximado: 30 minutos.

Al terminar tendrás el bot y la web corriendo en el mismo servidor, reiniciándose
solos si se caen o si reinicias el VPS.

---

## Antes de empezar

Necesitas:

- Un VPS en Hostinger con **Ubuntu 22.04 o 24.04**
- Un dominio apuntando al VPS
- Los datos de tu aplicación de Discord (token, client ID, client secret)

### Apuntar el dominio al VPS

1. En el panel de Hostinger (hPanel), abre tu VPS y copia su **dirección IP**.
2. Ve a la zona DNS de tu dominio y crea dos registros:

   | Tipo | Nombre | Valor |
   |---|---|---|
   | A | `@` | la IP de tu VPS |
   | A | `www` | la IP de tu VPS |

Los DNS tardan entre unos minutos y unas horas en propagarse. Puedes seguir con
los pasos siguientes mientras tanto; solo el paso del certificado HTTPS necesita
que ya esté propagado.

---

## 1. Conectarte al servidor

Desde tu PC (PowerShell o la terminal que uses):

```bash
ssh root@LA_IP_DE_TU_VPS
```

La contraseña la fijaste al crear el VPS. También puedes usar el **Browser
terminal** del hPanel de Hostinger si prefieres no usar SSH.

### Crear un usuario sin privilegios (recomendado)

Trabajar como `root` es arriesgado. Crea un usuario normal:

```bash
adduser tkbot && usermod -aG sudo tkbot
```

```bash
su - tkbot
```

A partir de aquí, todos los comandos van como este usuario.

---

## 2. Instalar lo necesario

### Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
```

Comprueba que ha ido bien:

```bash
node -v && npm -v
```

### Nginx, PM2 y Certbot

```bash
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx git build-essential
```

```bash
sudo npm install -g pm2
```

### MongoDB

Tienes dos opciones. **La más fácil es MongoDB Atlas** (gratis, gestionado, con
copias de seguridad): créate una cuenta en <https://www.mongodb.com/cloud/atlas/register>,
haz un clúster M0 gratuito, y en **Network Access** permite la IP de tu VPS.
Copia la cadena de conexión y sáltate el resto de este apartado.

Si prefieres instalarlo en el propio VPS:

```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb.gpg --dearmor
```

```bash
echo "deb [ signed-by=/usr/share/keyrings/mongodb.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
```

```bash
sudo apt update && sudo apt install -y mongodb-org && sudo systemctl enable --now mongod
```

Comprueba que está en marcha:

```bash
sudo systemctl status mongod --no-pager
```

---

## 3. Subir el proyecto

### Opción A: con Git (recomendado)

Sube tu carpeta a un repositorio **privado** de GitHub y clónalo:

```bash
cd ~ && git clone https://github.com/TU_USUARIO/TU_REPO.git tkbot && cd tkbot
```

Actualizar después será tan fácil como `git pull`.

> Comprueba que el `.gitignore` está haciendo su trabajo: el archivo `.env`
> **nunca** debe subirse al repositorio.

### Opción B: copiando los archivos

Desde tu PC, en la carpeta que contiene `BOT`:

```bash
scp -r "TK$/BOT" tkbot@LA_IP_DE_TU_VPS:~/tkbot
```

---

## 4. Configurar las variables de entorno

```bash
cd ~/tkbot && cp .env.example .env && nano .env
```

Rellena estos valores (Ctrl+O para guardar, Ctrl+X para salir):

```bash
DISCORD_TOKEN=tu_token_real
DISCORD_CLIENT_ID=tu_client_id
DISCORD_CLIENT_SECRET=tu_client_secret
BOT_OWNERS=tu_id_de_usuario_de_discord

# Local, o la cadena de Atlas si usas la nube
MONGODB_URI=mongodb://127.0.0.1:27017/tkbot

BOT_API_PORT=3001
BOT_API_URL=http://127.0.0.1:3001

# Estas dos son las que cambian respecto a tu PC
NEXT_PUBLIC_SITE_URL=https://tudominio.com
DISCORD_REDIRECT_URI=https://tudominio.com/api/auth/callback

NEXT_PUBLIC_BOT_NAME=TK$ Bot
NEXT_PUBLIC_SUPPORT_INVITE=https://discord.gg/tu_invitacion
```

Genera las dos claves secretas y pégalas en el archivo:

```bash
node -e "console.log('BOT_API_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

```bash
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

### Añadir la URL de producción en Discord

En <https://discord.com/developers/applications> → tu aplicación → **OAuth2** →
**Redirects**, añade:

```
https://tudominio.com/api/auth/callback
```

Puedes tener varias a la vez, así que **no borres** la de `localhost` si quieres
seguir desarrollando en tu PC.

---

## 5. Instalar y compilar

```bash
cd ~/tkbot && npm install
```

```bash
npm run build
```

Registra los comandos de barra de forma global (tarda hasta una hora en verse en
todos los servidores):

```bash
npm run deploy:global
```

---

## 6. Arrancar con PM2

```bash
mkdir -p logs && pm2 start ecosystem.config.js
```

Comprueba que los dos procesos están en verde:

```bash
pm2 status
```

Haz que arranquen solos al reiniciar el servidor:

```bash
pm2 save && pm2 startup
```

Ese último comando imprime **otro comando** que empieza por `sudo env PATH=...`.
Cópialo y ejecútalo tal cual.

---

## 7. Configurar Nginx

```bash
sudo cp ~/tkbot/deploy/nginx-tkbot.conf /etc/nginx/sites-available/tkbot
```

Cambia el dominio de ejemplo por el tuyo:

```bash
sudo nano /etc/nginx/sites-available/tkbot
```

Activa el sitio y desactiva el de por defecto:

```bash
sudo ln -sf /etc/nginx/sites-available/tkbot /etc/nginx/sites-enabled/tkbot && sudo rm -f /etc/nginx/sites-enabled/default
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

En este punto, `http://tudominio.com` ya debería mostrar la web.

---

## 8. Activar HTTPS

Sin HTTPS **no podrás iniciar sesión en el panel**: las cookies de sesión están
marcadas como seguras en producción y el navegador las descarta en HTTP.

```bash
sudo certbot --nginx -d tudominio.com -d www.tudominio.com
```

Te pedirá un correo y que aceptes las condiciones. Cuando pregunte si redirigir
el tráfico HTTP a HTTPS, responde que **sí**.

El certificado se renueva solo. Puedes comprobarlo con:

```bash
sudo certbot renew --dry-run
```

---

## 9. Cerrar el cortafuegos

Deja abiertos solo SSH y la web. Los puertos 3000 y 3001 quedan cerrados a
internet: solo se usan dentro del propio servidor.

```bash
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw --force enable
```

```bash
sudo ufw status
```

Comprueba desde tu PC que el puerto de la API **no** responde desde fuera
(debe dar tiempo de espera agotado o conexión rechazada):

```bash
curl -m 5 http://LA_IP_DE_TU_VPS:3001/health
```

---

## Listo

Entra en `https://tudominio.com`, inicia sesión con Discord y configura tus
servidores.

---

## Mantenimiento

### Actualizar tras hacer cambios

```bash
cd ~/tkbot && git pull && npm install && npm run build && pm2 restart all
```

Si has añadido o cambiado comandos, además:

```bash
npm run gen:commands && npm run deploy:global && pm2 restart all
```

### Comandos útiles

| Comando | Qué hace |
|---|---|
| `pm2 status` | Estado de los dos procesos |
| `pm2 logs` | Registros en vivo de ambos |
| `pm2 logs tkbot-bot --lines 100` | Últimas 100 líneas del bot |
| `pm2 restart tkbot-web` | Reiniciar solo la web |
| `pm2 monit` | Uso de CPU y memoria en vivo |
| `sudo systemctl reload nginx` | Recargar Nginx tras cambiar su configuración |

### Copia de seguridad de la base de datos

Si tienes MongoDB en el VPS, conviene una copia diaria:

```bash
mkdir -p ~/backups && mongodump --db tkbot --out ~/backups/$(date +%F)
```

Para automatizarla, añade esta línea con `crontab -e`:

```
0 4 * * * /usr/bin/mongodump --db tkbot --out /home/tkbot/backups/$(date +\%F)
```

Con MongoDB Atlas las copias son automáticas y no tienes que hacer nada.

---

## Si algo falla

**La web no carga y Nginx da 502** — La web no está arrancada. Mira `pm2 status`
y `pm2 logs tkbot-web`.

**El bot no aparece en línea** — `pm2 logs tkbot-bot`. Lo más habitual es el
token mal copiado o los intents privilegiados sin activar en el portal de Discord.

**Al iniciar sesión, Discord dice «Invalid OAuth2 redirect_uri»** — La URL de
`DISCORD_REDIRECT_URI` no coincide **exactamente** con la del portal de Discord.
Revisa que ambas empiecen por `https://` y no tengan una barra final de más.

**Inicio sesión y me devuelve a la portada sin entrar** — Falta el HTTPS, o
Nginx no está pasando la cabecera `X-Forwarded-Proto`. Comprueba el paso 8 y que
usaste el archivo de configuración de `deploy/`.

**El panel no muestra canales ni roles** — El bot está caído o no está en ese
servidor. Comprueba `pm2 status`.

**Se queda sin memoria** — Un VPS de 1 GB va justo para compilar. Si `npm run
build` se queda colgado, crea espacio de intercambio:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
```

Para que persista tras reiniciar:

```bash
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

#!/usr/bin/env bash
#
# TK$ Bot — instalación automática en un VPS Ubuntu (Hostinger, Hetzner, etc.)
#
# Uso, desde la carpeta del proyecto ya subida al servidor:
#
#   chmod +x deploy/instalar-vps.sh
#   ./deploy/instalar-vps.sh tudominio.com
#
# Instala Node, PM2, Nginx y Certbot, compila el proyecto, arranca los dos
# procesos y deja la web servida por HTTPS.
#
# Es seguro volver a ejecutarlo: se salta lo que ya esté hecho.

set -euo pipefail

# ── Colores para que se lea bien ──────────────────────────────
VERDE='\033[0;32m'; ROJO='\033[0;31m'; AMARILLO='\033[1;33m'; AZUL='\033[0;34m'; FIN='\033[0m'

paso()  { echo -e "\n${AZUL}==> $1${FIN}"; }
ok()    { echo -e "${VERDE}[OK]${FIN} $1"; }
aviso() { echo -e "${AMARILLO}[!]${FIN}  $1"; }
error() { echo -e "${ROJO}[X]${FIN}  $1"; exit 1; }

# ── Comprobaciones previas ────────────────────────────────────
[[ $EUID -eq 0 ]] && error "No lo ejecutes como root. Crea un usuario normal:
      adduser tkbot && usermod -aG sudo tkbot && su - tkbot"

command -v sudo >/dev/null || error "Falta sudo. Instálalo como root: apt install -y sudo"

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

[[ -f package.json ]] || error "No encuentro package.json. Ejecuta el script desde la carpeta del proyecto."

DOMINIO="${1:-}"
if [[ -z "$DOMINIO" ]]; then
  read -rp "Dominio (por ejemplo tkbot.com), o Enter para omitir Nginx y HTTPS: " DOMINIO
fi

echo
echo "  Proyecto: $RAIZ"
echo "  Dominio:  ${DOMINIO:-(ninguno, solo se arrancarán los procesos)}"
echo

# ── 1. Paquetes del sistema ───────────────────────────────────
paso "Actualizando el sistema"
sudo apt-get update -qq
ok "Listas de paquetes actualizadas"

paso "Instalando Node.js 20"
if command -v node >/dev/null && [[ "$(node -v | cut -d. -f1 | tr -d 'v')" -ge 20 ]]; then
  ok "Node.js $(node -v) ya instalado"
else
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >/dev/null
  sudo apt-get install -y nodejs >/dev/null
  ok "Node.js $(node -v) instalado"
fi

paso "Instalando herramientas"
sudo apt-get install -y build-essential git curl >/dev/null
ok "Herramientas de compilación instaladas"

if ! command -v pm2 >/dev/null; then
  sudo npm install -g pm2 >/dev/null
  ok "PM2 instalado"
else
  ok "PM2 ya instalado"
fi

# ── 2. Espacio de intercambio si hay poca memoria ─────────────
MEM_MB=$(free -m | awk '/^Mem:/{print $2}')
if [[ "$MEM_MB" -lt 2048 ]] && ! sudo swapon --show | grep -q .; then
  paso "Creando 2 GB de swap (tienes ${MEM_MB} MB de RAM)"
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  ok "Swap activado (evita que se quede sin memoria al compilar)"
fi

# ── 3. MongoDB ────────────────────────────────────────────────
paso "Base de datos"
if grep -qE '^MONGODB_URI=mongodb\+srv://' .env 2>/dev/null; then
  ok "Usas MongoDB Atlas (en la nube). No hace falta instalar nada."
elif command -v mongod >/dev/null; then
  ok "MongoDB ya está instalado"
  sudo systemctl enable --now mongod >/dev/null 2>&1 || true
else
  aviso "MongoDB no está instalado."
  read -rp "     ¿Instalarlo en este servidor? [s/N]: " INSTALAR_MONGO
  if [[ "${INSTALAR_MONGO,,}" == "s" ]]; then
    UBUNTU_CODENAME=$(. /etc/os-release && echo "${UBUNTU_CODENAME:-jammy}")
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc \
      | sudo gpg -o /usr/share/keyrings/mongodb.gpg --dearmor --yes
    echo "deb [ signed-by=/usr/share/keyrings/mongodb.gpg ] https://repo.mongodb.org/apt/ubuntu ${UBUNTU_CODENAME}/mongodb-org/7.0 multiverse" \
      | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list >/dev/null
    sudo apt-get update -qq
    sudo apt-get install -y mongodb-org >/dev/null
    sudo systemctl enable --now mongod
    ok "MongoDB instalado y arrancado"
  else
    aviso "Recuerda poner una MONGODB_URI válida en el .env antes de arrancar."
  fi
fi

# ── 4. Configuración ──────────────────────────────────────────
paso "Comprobando el archivo .env"
if [[ ! -f .env ]]; then
  cp .env.example .env
  aviso "Se ha creado .env a partir de .env.example."
fi

# Rellena automáticamente las claves aleatorias si siguen sin poner.
for CLAVE in BOT_API_SECRET SESSION_SECRET; do
  if grep -qE "^${CLAVE}=cambia_esto" .env; then
    VALOR=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    sed -i "s|^${CLAVE}=.*|${CLAVE}=${VALOR}|" .env
    ok "$CLAVE generada automáticamente"
  fi
done

# Ajusta las URL al dominio indicado.
if [[ -n "$DOMINIO" ]]; then
  sed -i "s|^NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=https://${DOMINIO}|" .env
  sed -i "s|^DISCORD_REDIRECT_URI=.*|DISCORD_REDIRECT_URI=https://${DOMINIO}/api/auth/callback|" .env
  ok "URL del sitio ajustadas a https://${DOMINIO}"
fi

if ! node scripts/check-env.js; then
  echo
  error "Rellena los campos que faltan en el archivo .env y vuelve a ejecutar este script:
      nano $RAIZ/.env"
fi

# ── 5. Instalación y compilación ──────────────────────────────
paso "Instalando dependencias del proyecto"
npm install --no-audit --no-fund
ok "Dependencias instaladas"

paso "Compilando el panel web"
npm run build
ok "Panel compilado"

paso "Generando el catálogo de comandos"
npm run gen:commands >/dev/null
ok "Catálogo generado"

# ── 6. Arranque con PM2 ───────────────────────────────────────
paso "Arrancando el bot y la web"
mkdir -p logs
pm2 delete tkbot-bot tkbot-web >/dev/null 2>&1 || true
pm2 start ecosystem.config.js
pm2 save >/dev/null

# Configura el arranque automático al reiniciar el servidor.
COMANDO_STARTUP=$(pm2 startup systemd -u "$USER" --hp "$HOME" 2>/dev/null | grep '^sudo' || true)
if [[ -n "$COMANDO_STARTUP" ]]; then
  eval "$COMANDO_STARTUP" >/dev/null 2>&1 && ok "Arranque automático configurado" \
    || aviso "No se pudo configurar el arranque automático. Ejecuta a mano: pm2 startup"
fi

ok "Procesos en marcha"
pm2 status

# ── 7. Nginx y HTTPS ──────────────────────────────────────────
if [[ -n "$DOMINIO" ]]; then
  paso "Configurando Nginx"
  sudo apt-get install -y nginx certbot python3-certbot-nginx >/dev/null

  sudo sed "s/tudominio\.com/${DOMINIO}/g" deploy/nginx-tkbot.conf \
    | sudo tee /etc/nginx/sites-available/tkbot >/dev/null

  sudo ln -sf /etc/nginx/sites-available/tkbot /etc/nginx/sites-enabled/tkbot
  sudo rm -f /etc/nginx/sites-enabled/default

  if sudo nginx -t 2>/dev/null; then
    sudo systemctl reload nginx
    ok "Nginx configurado para $DOMINIO"
  else
    error "La configuración de Nginx tiene errores. Revísala con: sudo nginx -t"
  fi

  paso "Solicitando el certificado HTTPS"
  aviso "El dominio debe apuntar ya a la IP de este servidor."
  echo "     IP de este servidor: $(curl -s -m 5 ifconfig.me || echo 'no se pudo averiguar')"
  echo
  read -rp "     ¿Continuar con el certificado? [S/n]: " CONTINUAR

  if [[ "${CONTINUAR,,}" != "n" ]]; then
    if sudo certbot --nginx -d "$DOMINIO" -d "www.$DOMINIO" --redirect --agree-tos -m "admin@${DOMINIO}" --non-interactive; then
      ok "HTTPS activado"
    else
      aviso "No se pudo obtener el certificado. Comprueba los DNS y ejecuta luego:
       sudo certbot --nginx -d $DOMINIO -d www.$DOMINIO"
    fi
  fi

  # ── 8. Cortafuegos ──────────────────────────────────────────
  paso "Configurando el cortafuegos"
  sudo apt-get install -y ufw >/dev/null
  sudo ufw allow OpenSSH >/dev/null
  sudo ufw allow 'Nginx Full' >/dev/null
  sudo ufw --force enable >/dev/null
  ok "Cortafuegos activo. Los puertos 3000 y 3001 quedan cerrados a internet."
fi

# ── Resumen ───────────────────────────────────────────────────
echo
echo -e "${VERDE}================================================${FIN}"
echo -e "${VERDE}  Instalación completada${FIN}"
echo -e "${VERDE}================================================${FIN}"
echo

if [[ -n "$DOMINIO" ]]; then
  echo "  Tu panel:  https://${DOMINIO}"
  echo
  echo -e "  ${AMARILLO}Antes de poder iniciar sesión, en el portal de Discord${FIN}"
  echo -e "  ${AMARILLO}(OAuth2 -> Redirects) añade esta URL exacta:${FIN}"
  echo
  echo "      https://${DOMINIO}/api/auth/callback"
else
  echo "  Tu panel:  http://$(curl -s -m 5 ifconfig.me || echo 'IP-DEL-SERVIDOR'):3000"
fi

echo
echo "  Registrar los comandos de barra:"
echo "      npm run deploy:global"
echo
echo "  Comandos útiles:"
echo "      pm2 status              estado de los procesos"
echo "      pm2 logs                registros en vivo"
echo "      pm2 restart all         reiniciar todo"
echo

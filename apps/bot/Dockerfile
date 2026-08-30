# ── Imagen del bot de TK$ Bot ────────────────────────────────
#
# Se construye desde la RAÍZ del proyecto, no desde esta carpeta:
#   docker build -f apps/bot/Dockerfile -t tkbot-bot .
#
# En Easypanel se indica como "Dockerfile Path": apps/bot/Dockerfile

FROM node:20-bookworm-slim

# Las tarjetas de bienvenida y de rango se dibujan con @napi-rs/canvas.
# Sin fuentes instaladas en el sistema, el texto saldría en blanco.
#   fontconfig      -> localizar fuentes
#   fonts-dejavu    -> familia de respaldo declarada en canvas/helpers.js
#   fonts-noto-*    -> acentos, alfabetos no latinos y emojis en color
RUN apt-get update && apt-get install -y --no-install-recommends \
      fontconfig \
      fonts-dejavu-core \
      fonts-noto-core \
      fonts-noto-color-emoji \
      ca-certificates \
    && fc-cache -f \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Los manifiestos se copian primero para aprovechar la caché de capas:
# mientras no cambien las dependencias, no se reinstalan.
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/bot/package.json ./apps/bot/
COPY apps/web/package.json ./apps/web/

# Se instalan explícitamente los dos paquetes que necesita el bot. Hay que
# nombrar también `@tkbot/shared`: si no, npm enlaza el paquete pero no baja
# sus propias dependencias (mongoose) y el bot fallaría al arrancar.
RUN npm ci --no-audit --no-fund \
      --workspace @tkbot/bot \
      --workspace @tkbot/shared \
      --include-workspace-root

# Ahora sí el código fuente.
COPY packages/shared ./packages/shared
COPY apps/bot ./apps/bot

ENV NODE_ENV=production
# En contenedor, la web vive en otro sitio: la API debe aceptar la red interna.
ENV BOT_API_HOST=0.0.0.0
ENV BOT_API_PORT=3001

# El bot no necesita root.
USER node

EXPOSE 3001

# Comprobación de salud: el endpoint /health no requiere clave.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3001/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "apps/bot/src/index.js"]

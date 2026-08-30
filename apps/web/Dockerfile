# ── Imagen del panel web de TK$ Bot ──────────────────────────
#
# Se construye desde la RAÍZ del proyecto, no desde esta carpeta:
#   docker build -f apps/web/Dockerfile -t tkbot-web .
#
# En Easypanel se indica como "Dockerfile Path": apps/web/Dockerfile

# ── Etapa 1: instalar dependencias y compilar ────────────────
FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/bot/package.json ./apps/bot/
COPY apps/web/package.json ./apps/web/

RUN npm ci --no-audit --no-fund

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# Todas las variables NEXT_PUBLIC_* se leen en componentes de servidor, así que
# se resuelven al arrancar y no hace falta pasarlas al construir la imagen.
ENV NEXT_TELEMETRY_DISABLED=1

# Se invoca el binario de Next directamente en lugar del script de npm: así no
# se ejecuta la sincronización del .env, que aquí no existe (las variables las
# pone Easypanel o docker compose al arrancar).
WORKDIR /app/apps/web
RUN node ../../node_modules/next/dist/bin/next build
WORKDIR /app


# ── Etapa 2: imagen final, sin herramientas de compilación ───
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Se copia el resultado de la compilación y las dependencias ya resueltas.
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/packages/shared ./packages/shared
COPY --from=builder --chown=node:node /app/apps/web ./apps/web

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

WORKDIR /app/apps/web
CMD ["node", "../../node_modules/next/dist/bin/next", "start", "-p", "3000"]

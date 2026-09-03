# ── Resolutor de YouTube para TK$ Bot (yt-dlp) ──────────────────
#
# Por que existe: ver el docstring de apps/ytresolver/app.py.
#
# Se construye desde la RAIZ del proyecto:
#   docker build -f apps/ytresolver/Dockerfile -t tkbot-ytresolver .
#
# En Easypanel se indica como "Dockerfile Path": apps/ytresolver/Dockerfile

FROM python:3.12-slim

WORKDIR /app

# ffmpeg: yt-dlp lo necesita para juntar audio+video cuando el mejor
# formato disponible no viene ya en un único archivo (pasa con algunos
# videos). Ahora que este servicio DESCARGA el audio en vez de solo pasar
# una URL, hace falta de verdad.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# yt-dlp se instala SIN fijar version a proposito: en cada reconstruccion de
# la imagen se coge la ultima, para seguir el ritmo de los cambios que
# YouTube le hace a sus defensas. Si un dia deja de funcionar, lo primero es
# reconstruir esta imagen sin cache antes de sospechar de otra cosa.
#
# bgutil-ytdlp-pot-provider: plugin que le pide a un servicio aparte (ver
# MUSICA.md) el "token de origen" que YouTube exige a clientes que marca
# como sospechosos. yt-dlp lo detecta solo al estar instalado; no hace falta
# activarlo a mano, solo darle POT_PROVIDER_URL para que sepa a qué
# servidor pedirselo (ver POT_PROVIDER_URL en app.py).
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir fastapi "uvicorn[standard]" yt-dlp bgutil-ytdlp-pot-provider

COPY apps/ytresolver/app.py ./app.py

# Sin usuario sin privilegios: Easypanel monta /app/cookies.txt como root y
# un usuario normal no puede leerlo ("Permission denied"). Es un servicio
# interno (sin dominio publicado) protegido por YT_RESOLVER_TOKEN, así que
# correr como root aquí es un riesgo asumible.
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=3)" || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]

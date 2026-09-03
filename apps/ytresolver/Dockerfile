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

# yt-dlp se instala SIN fijar version a proposito: en cada reconstruccion de
# la imagen se coge la ultima, para seguir el ritmo de los cambios que
# YouTube le hace a sus defensas. Si un dia deja de funcionar, lo primero es
# reconstruir esta imagen sin cache antes de sospechar de otra cosa.
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir fastapi "uvicorn[standard]" yt-dlp

COPY apps/ytresolver/app.py ./app.py

# Sin usuario sin privilegios: Easypanel monta /app/cookies.txt como root y
# un usuario normal no puede leerlo ("Permission denied"). Es un servicio
# interno (sin dominio publicado) protegido por YT_RESOLVER_TOKEN, así que
# correr como root aquí es un riesgo asumible.
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=3)" || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]

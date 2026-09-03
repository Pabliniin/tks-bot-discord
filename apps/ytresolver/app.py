"""Resolutor de YouTube para TK$ Bot.

Por que existe: Lavalink no puede tocar YouTube de forma fiable desde este
servidor. El plugin oficial (dev.lavalink.youtube) falla con "This video
requires login" en todos sus clientes en CUALQUIER video, lo que apunta a
que YouTube marco la IP del VPS como sospechosa, no a un fallo de
configuracion.

Como funciona (importante, es la segunda version de este servicio): NO se le
pasa a Lavalink la URL directa del CDN de Google. Eso se probo primero y
fallaba de formas distintas cada vez -- unas veces el formato que yt-dlp
elegia no era el que Lavalink esperaba, otras la URL firmada de Google traia
protocolos (HLS/DASH) que la fuente HTTP de Lavalink no sabe leer como un
archivo normal. Demasiadas piezas que tenian que estar de acuerdo a la vez.

Ahora este servicio DESCARGA el audio con yt-dlp a un archivo local y lo
sirve el mismo por HTTP normal y corriente. Lavalink ya no tiene que
entenderse con nada de Google: solo descarga un archivo de audio de un
servidor cualquiera, que es lo que su fuente HTTP hace bien siempre. Cuesta
unos segundos mas por cancion (hay que descargarla antes de poder sonar),
pero es muchisimo mas fiable.

Cookies opcionales (/app/cookies.txt, montado aparte en Easypanel, nunca en
el repositorio): de una sesion real de YouTube. Se probaron solas primero y
NO bastaron -- hasta con cookies recien exportadas de una sesion de verdad,
YouTube seguia devolviendo "Sign in to confirm you're not a bot" en videos
normales (no solo en contenido con restriccion de edad/region). Eso apunta a
un bloqueo de reputacion de la IP del VPS mas fuerte de lo que las cookies
por si solas pueden arreglar.

Proveedor de PO token (POT_PROVIDER_URL, opcional): un "token de origen"
adicional que YouTube exige en clientes marcados como sospechosos, aparte de
la sesion. Lo genera un servicio aparte (proyecto bgutil-ytdlp-pot-provider,
https://github.com/Brainicism/bgutil-ytdlp-pot-provider) que se monta como
otro contenedor en Easypanel. Tampoco es una garantia al 100%, pero es la
pieza que faltaba en las pruebas: cookies sin esto no bastaron.
"""

import asyncio
import glob
import logging
import os
import threading
import time
import uuid

import yt_dlp
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("ytresolver")

API_KEY = os.environ.get("YT_RESOLVER_TOKEN", "")
MAX_RESULTADOS = 25

CACHE_DIR = "/app/cache"
os.makedirs(CACHE_DIR, exist_ok=True)

# Cuanto se guarda un archivo descargado antes de borrarlo solo. De sobra
# para que le de tiempo a sonar (canción + lo que tarde en llegarle su turno
# en la cola), sin dejar que el disco crezca sin límite.
CACHE_TTL_SEGUNDOS = 30 * 60

COOKIES_PATH = "/app/cookies.txt"
TIENE_COOKIES = os.path.isfile(COOKIES_PATH)
if TIENE_COOKIES:
    log.info("Usando cookies de sesión en %s", COOKIES_PATH)
else:
    log.info("Sin archivo de cookies (%s): se prueba sin sesión iniciada.", COOKIES_PATH)

POT_PROVIDER_URL = os.environ.get("POT_PROVIDER_URL", "").strip().rstrip("/")
if POT_PROVIDER_URL:
    log.info("Usando proveedor de PO token en %s", POT_PROVIDER_URL)
else:
    log.info("Sin POT_PROVIDER_URL: se prueba sin token de origen.")

app = FastAPI()


def _limpiar_cache_periodicamente():
    while True:
        ahora = time.time()
        for ruta in glob.glob(os.path.join(CACHE_DIR, "*")):
            try:
                if ahora - os.path.getmtime(ruta) > CACHE_TTL_SEGUNDOS:
                    os.remove(ruta)
            except OSError:
                pass
        time.sleep(300)


threading.Thread(target=_limpiar_cache_periodicamente, daemon=True).start()


def _opciones_yt_dlp(identificador: str) -> dict:
    opciones = {
        "quiet": True,
        "no_warnings": True,
        "outtmpl": os.path.join(CACHE_DIR, f"{identificador}.%(ext)s"),
        # Audio-only si existe (más rápido de bajar); si no, el mejor que haya.
        # Sin restringir contenedor ni protocolo: al DESCARGAR el archivo
        # entero en vez de pasarle la URL a otro sistema, ya no importa si es
        # HLS/DASH o qué contenedor trae -- yt-dlp lo junta él solo y lo dueja
        # como un archivo normal en disco.
        "format": "bestaudio/best",
        "socket_timeout": 20,
        "noplaylist": True,
    }
    if TIENE_COOKIES:
        opciones["cookiefile"] = COOKIES_PATH
    if POT_PROVIDER_URL:
        opciones["extractor_args"] = {
            "youtubepot-bgutilhttp": {"base_url": POT_PROVIDER_URL},
        }
    return opciones


def _descargar(identificador: str, nombre_base: str) -> dict:
    """Descarga un video/pista a CACHE_DIR y devuelve sus metadatos + nombre de archivo."""
    with yt_dlp.YoutubeDL(_opciones_yt_dlp(nombre_base)) as ydl:
        info = ydl.extract_info(identificador, download=True)

    if info.get("is_live"):
        raise ValueError("Es un directo, no se puede descargar.")

    coincidencias = glob.glob(os.path.join(CACHE_DIR, f"{nombre_base}.*"))
    if not coincidencias:
        raise RuntimeError("yt-dlp no dejó ningún archivo descargado.")

    archivo = os.path.basename(coincidencias[0])
    return {
        "archivo": archivo,
        "title": info.get("title") or "Desconocido",
        "author": info.get("uploader") or info.get("channel") or "Desconocido",
        "durationMs": int((info.get("duration") or 0) * 1000),
        "thumbnail": info.get("thumbnail"),
        "sourceUrl": info.get("webpage_url") or info.get("original_url"),
    }


def _listar_entradas_playlist(objetivo: str, limite: int) -> tuple:
    """Para una URL de lista: nombres/ids sin descargar nada todavía (rápido)."""
    opciones = dict(_opciones_yt_dlp("_"), extract_flat="in_playlist")
    with yt_dlp.YoutubeDL(opciones) as ydl:
        info = ydl.extract_info(objetivo, download=False)

    entradas = info.get("entries")
    if entradas is None:
        return [objetivo], None

    identificadores = [e.get("url") or e.get("id") for e in entradas if e]
    identificadores = [i for i in identificadores if i][:limite]
    return identificadores, info.get("title")


def _resolver_sync(consulta: str, es_busqueda: bool, limite: int) -> dict:
    objetivo = f"ytsearch{max(1, limite)}:{consulta}" if es_busqueda else consulta

    try:
        if es_busqueda:
            identificadores, nombre_lista = [objetivo], None
        else:
            identificadores, nombre_lista = _listar_entradas_playlist(objetivo, limite)
    except Exception as err:  # noqa: BLE001
        return {"error": str(err), "tracks": [], "playlist": None}

    if not identificadores:
        return {"tracks": [], "playlist": None, "error": "No se ha encontrado nada."}

    # Una a una, con una pausa corta entre cada una -- no en paralelo. Varias
    # descargas de golpe con la misma sesión de cookies es precisamente el
    # patrón que YouTube vigila para bloquear por bot; tarda más, pero es lo
    # que de verdad ha dado mejor resultado en pruebas reales.
    tracks = []
    for i, identificador in enumerate(identificadores):
        if i > 0:
            time.sleep(0.6)
        nombre_base = uuid.uuid4().hex
        try:
            datos = _descargar(identificador, nombre_base)
        except Exception as err:  # noqa: BLE001 - se registra y se descarta esta pista
            log.warning("No se pudo descargar %s: %s", identificador, err)
            continue
        tracks.append(datos)

    if not tracks:
        return {
            "tracks": [],
            "playlist": None,
            "error": "No se pudo descargar ninguna pista (posiblemente bloqueada o privada).",
        }

    if nombre_lista and len(tracks) > 1:
        return {"tracks": tracks, "playlist": nombre_lista, "error": None}
    return {"tracks": [tracks[0]], "playlist": None, "error": None}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/files/{nombre}")
def servir_archivo(nombre: str):
    # El nombre siempre es un uuid4().hex generado por este mismo servicio
    # (ver `_descargar`): no hay entrada de usuario aquí que pudiera escapar
    # de CACHE_DIR, así que basta con comprobar que exista.
    ruta = os.path.join(CACHE_DIR, nombre)
    if not os.path.isfile(ruta) or not os.path.dirname(os.path.abspath(ruta)) == os.path.abspath(CACHE_DIR):
        raise HTTPException(status_code=404, detail="not found")
    return FileResponse(ruta)


@app.get("/resolve")
async def resolve(
    query: str = Query(..., min_length=1),
    search: bool = Query(False),
    limit: int = Query(1, ge=1, le=MAX_RESULTADOS),
    x_api_key: str = Header(default=""),
):
    if not API_KEY or x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="unauthorized")

    bucle = asyncio.get_running_loop()
    try:
        resultado = await bucle.run_in_executor(None, _resolver_sync, query, search, limit)
    except Exception as err:  # noqa: BLE001
        log.exception("Fallo resolviendo %r", query)
        return JSONResponse(status_code=500, content={"error": str(err), "tracks": [], "playlist": None})

    # Los "tracks" llevan el nombre del archivo ya descargado; el bot arma la
    # URL final con su propia base (BASE_URL/files/<archivo>) para no atar
    # este servicio a saber su propio nombre de host en Easypanel.
    return resultado

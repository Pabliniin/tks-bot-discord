"""Resolutor de YouTube para TK$ Bot.

Por que existe: Lavalink no puede tocar YouTube de forma fiable desde este
servidor. El plugin oficial (dev.lavalink.youtube) falla con "This video
requires login" en todos sus clientes (MUSIC, ANDROID_VR, WEB, WEBEMBEDDED) en
CUALQUIER video, lo que apunta a que YouTube marco la IP del VPS como
sospechosa, no a un fallo de configuracion. yt-dlp se actualiza mucho mas a
menudo persiguiendo cada cambio de YouTube, asi que tiene mejores
probabilidades de pasar esa comprobacion.

Como se usa: este servicio NUNCA le manda audio a nadie. Solo le pide a
yt-dlp la URL directa del archivo de audio (el CDN de Google, googlevideo.com)
y se la devuelve al bot. El bot le pasa esa URL a Lavalink como si fuera un
archivo HTTP cualquiera (la fuente "http", ya activada) — Lavalink nunca habla
con YouTube directamente para estos tracks.

Esto NO es una garantia: si el bloqueo de YouTube fuera por reputacion pura de
la IP (no por el cliente que la pide), yt-dlp tropezaria con lo mismo. Es el
mecanismo con mejores probabilidades disponible sin depender de una cuenta o
de infraestructura de terceros, no una solucion garantizada al 100%.
"""

import asyncio
import logging
import os
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

import yt_dlp
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("ytresolver")

API_KEY = os.environ.get("YT_RESOLVER_TOKEN", "")
MAX_RESULTADOS = 25

# Un solo pool para todas las llamadas a yt-dlp: son bloqueantes (I/O de red
# sincrono), asi que corren en hilos aparte para no parar el bucle de eventos
# de FastAPI. 4 workers es a proposito poco: mas llamadas simultaneas a
# YouTube desde la misma IP solo aumentan el riesgo de que nos bloqueen mas.
POOL = ThreadPoolExecutor(max_workers=4)

YDL_OPTS_BASE = {
    "quiet": True,
    "no_warnings": True,
    "skip_download": True,
    # Sin "format": aquí no se le pide a yt-dlp que elija un formato — eso
    # hace que `extract_info` falle entera con "Requested format is not
    # available" en cuanto su selector interno no encuentra nada que encaje
    # (nos pasó con "bestaudio/best"). Se extrae SIEMPRE la lista completa
    # de formatos, sin condiciones, y el formato se elige a mano en
    # `_pista_desde_info`: así, si un video no trae audio-only, cae a
    # cualquier formato con audio en vez de fallar de golpe.
    #
    # Tampoco se fija "player_client" a mano: yt-dlp decide qué clientes
    # probar y esa lista la actualizan con cada versión persiguiendo los
    # cambios de YouTube; fijarla nosotros solo puede quedarse anticuada.
    "socket_timeout": 20,
}

# "Sign in to confirm you're not a bot": ni el plugin de Lavalink ni yt-dlp
# sin más pasan este bloqueo desde la IP del VPS — es un bloqueo por
# reputación de la IP, no por el cliente usado. Con cookies de una sesión
# real de YouTube, las peticiones se ven como las de una persona con sesión
# iniciada en vez de un servidor anónimo. El archivo se monta aparte (no va
# en el repositorio ni en variables de entorno) porque son credenciales de
# una cuenta de verdad.
COOKIES_PATH = "/app/cookies.txt"
if os.path.isfile(COOKIES_PATH):
    YDL_OPTS_BASE["cookiefile"] = COOKIES_PATH
    log.info("Usando cookies de sesión en %s", COOKIES_PATH)
else:
    log.info("Sin archivo de cookies (%s): se prueba sin sesión iniciada.", COOKIES_PATH)

app = FastAPI()


def _extraer(objetivo: str, plano: bool = False) -> dict:
    opciones = dict(YDL_OPTS_BASE)
    if plano:
        opciones["extract_flat"] = "in_playlist"
    with yt_dlp.YoutubeDL(opciones) as ydl:
        return ydl.extract_info(objetivo, download=False)


def _es_stub_plano(entrada: dict) -> bool:
    """Una entrada de `extract_flat` trae el id y poco mas: hay que resolverla entera."""
    return entrada.get("_type") == "url" or "formats" not in entrada


def _pista_desde_info(info: dict) -> Optional[dict]:
    if info.get("is_live"):
        return None

    url = info.get("url")
    if not url:
        formatos = info.get("formats") or []
        audio = [
            f for f in formatos
            if f.get("acodec") not in (None, "none") and f.get("vcodec") in (None, "none")
        ]
        elegido = audio[-1] if audio else (formatos[-1] if formatos else None)
        url = elegido.get("url") if elegido else None

    if not url:
        return None

    return {
        "url": url,
        "title": info.get("title") or "Desconocido",
        "author": info.get("uploader") or info.get("channel") or "Desconocido",
        "durationMs": int((info.get("duration") or 0) * 1000),
        "thumbnail": info.get("thumbnail"),
        "sourceUrl": info.get("webpage_url") or info.get("original_url"),
    }


def _resolver_entrada(entrada: dict) -> Optional[dict]:
    if not _es_stub_plano(entrada):
        pista = _pista_desde_info(entrada)
        if pista:
            return pista

    identificador = entrada.get("url") or entrada.get("id")
    if not identificador:
        return None

    try:
        return _pista_desde_info(_extraer(identificador))
    except Exception as err:  # noqa: BLE001 - se registra y se descarta esta pista
        log.warning("No se pudo resolver %s: %s", identificador, err)
        return None


def _resolver_sync(consulta: str, es_busqueda: bool, limite: int) -> dict:
    objetivo = f"ytsearch{max(1, limite)}:{consulta}" if es_busqueda else consulta

    try:
        # Una busqueda por texto ya devuelve cada resultado resuelto del
        # todo; una URL puede ser una lista larga, asi que ahi se pide plano
        # primero (rapido) y solo se resuelve entera cada pista que se vaya
        # a usar de verdad.
        info = _extraer(objetivo, plano=not es_busqueda)
    except Exception as err:  # noqa: BLE001
        return {"error": str(err), "tracks": [], "playlist": None}

    entradas = info.get("entries")
    if entradas is None:
        pista = _pista_desde_info(info)
        if not pista:
            n = len(info.get("formats") or [])
            return {
                "tracks": [],
                "playlist": None,
                "error": f"Sin audio disponible (¿directo en vivo?). {n} formato(s) recibidos.",
            }
        return {"tracks": [pista], "playlist": None, "error": None}

    entradas = [e for e in entradas if e][:limite]
    if not entradas:
        return {"tracks": [], "playlist": None, "error": "La lista está vacía."}

    with ThreadPoolExecutor(max_workers=min(4, len(entradas))) as pool_interno:
        tracks = [t for t in pool_interno.map(_resolver_entrada, entradas) if t]

    return {
        "tracks": tracks,
        "playlist": info.get("title") if not es_busqueda else None,
        "error": None if tracks else "No se pudo resolver ninguna pista de la lista.",
    }


@app.get("/health")
def health():
    return {"status": "ok"}


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
        resultado = await bucle.run_in_executor(POOL, _resolver_sync, query, search, limit)
    except Exception as err:  # noqa: BLE001
        log.exception("Fallo resolviendo %r", query)
        return JSONResponse(status_code=500, content={"error": str(err), "tracks": [], "playlist": None})

    return resultado

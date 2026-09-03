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
    # Selector explícito de audio, en orden de preferencia:
    #   140            -> itag fijo de YouTube para AAC/m4a ~128kbps. Casi
    #                     todos los videos lo tienen; es el mismo formato
    #                     "seguro" que usan la mayoría de bots basados en
    #                     yt-dlp, precisamente porque Lavalink lo decodifica
    #                     sin problema.
    #   bestaudio[...]  -> si no hay 140, el mejor audio-only en m4a o webm,
    #                     evitando HLS/DASH (Lavalink no sabe leer eso como
    #                     un archivo HTTP normal).
    #   best            -> último recurso: video+audio combinado.
    #
    # No dejar "format" sin más NO basta: yt-dlp aplica un selector por
    # defecto igual (algo como "bestvideo+bestaudio/best"), y con eso
    # fusiona video y audio -- sin ffmpeg instalado en esta imagen, o falla,
    # o el "url" que devuelve no es un archivo de audio simple, y Lavalink
    # lo rechaza ("Something went wrong while looking up the track", nos
    # pasó en pruebas reales con "all"). Aun así, `_elegir_formato` sigue de
    # red de seguridad si por lo que sea no queda `info['url']` puesto.
    #
    # Tampoco se fija "player_client" a mano (salvo con cookies, más abajo):
    # yt-dlp decide qué clientes probar y esa lista la actualizan con cada
    # versión persiguiendo los cambios de YouTube.
    "format": "140/bestaudio[ext=m4a][protocol^=https]/bestaudio[protocol^=https]/best",
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
    # Los clientes "android"/"ios" autentican con una clave de la app móvil,
    # no con cookies: si yt-dlp prueba esos primero y fallan (nos pasó en
    # pruebas reales, incluso con cookies puestas), nunca llega a usarlas.
    # Solo "web" lee la cookiejar, así que con cookies se fuerza ese.
    YDL_OPTS_BASE["extractor_args"] = {"youtube": {"player_client": ["web"]}}
    log.info("Usando cookies de sesión en %s (cliente forzado a «web»)", COOKIES_PATH)
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


def _elegir_formato(formatos: list) -> Optional[dict]:
    """
    Se prefiere audio-only, servido como archivo directo (no HLS/DASH
    fragmentado, que Lavalink no sabe leer como una URL HTTP normal), y en
    los contenedores que Lavalink sabe decodificar seguro: m4a (AAC) o webm
    (Opus). Si no hay ninguno así, se cae a cualquier formato con audio,
    aunque sea de peor calidad, antes que fallar del todo.
    """
    audio = [
        f for f in formatos
        if f.get("acodec") not in (None, "none") and f.get("vcodec") in (None, "none")
    ]

    directos = [
        f for f in audio
        if "m3u8" not in (f.get("protocol") or "") and "dash" not in (f.get("protocol") or "")
    ]

    buenos = [f for f in directos if f.get("ext") in ("m4a", "webm")]

    for candidatos in (buenos, directos, audio, formatos):
        if candidatos:
            # abr (bitrate de audio) más alto primero; los que no lo traen, al final.
            return max(candidatos, key=lambda f: f.get("abr") or 0)
    return None


def _pista_desde_info(info: dict) -> Optional[dict]:
    if info.get("is_live"):
        return None

    elegido = None
    url = info.get("url")
    if not url:
        elegido = _elegir_formato(info.get("formats") or [])
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
        # No sensible, solo para depurar sin adivinar: qué formato se eligió.
        "formatoDebug": {
            "ext": (elegido or {}).get("ext"),
            "protocol": (elegido or {}).get("protocol"),
            "acodec": (elegido or {}).get("acodec"),
            "abr": (elegido or {}).get("abr"),
        } if elegido else None,
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


@app.get("/debug/cookies")
def debug_cookies(x_api_key: str = Header(default="")):
    """Diagnóstico temporal: solo forma del archivo y permisos, nunca valores de cookies."""
    if not API_KEY or x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="unauthorized")

    info = {
        "existeRuta": os.path.exists(COOKIES_PATH),
        "uidProceso": os.getuid(),
        "gidProceso": os.getgid(),
    }
    try:
        st = os.stat(COOKIES_PATH)
        info["modo"] = oct(st.st_mode)
        info["propietarioUid"] = st.st_uid
        info["propietarioGid"] = st.st_gid
    except OSError as err:
        info["statError"] = str(err)
        return info

    try:
        with open(COOKIES_PATH, "r", encoding="utf-8", errors="replace") as f:
            lineas = f.readlines()
    except OSError as err:
        info["openError"] = str(err)
        return info

    datos = [l for l in lineas if l.strip() and not l.lstrip().startswith("#")]
    info.update({
        "totalLineas": len(lineas),
        "primeraLineaRepr": repr(lineas[0][:60]) if lineas else None,
        "lineasDeDatos": len(datos),
        "camposPrimeras3": [len(l.rstrip("\n").split("\t")) for l in datos[:3]],
    })
    return info


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

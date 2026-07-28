"""Noticias del sector minero peruano en la portada (julio 2026, pedido
explícito de Esthiven): un feed RSS real de un medio especializado
(Rumbo Minero — confirmado en vivo que expone RSS estándar en
rumbominero.com/feed/, se actualiza cada hora), filtrado por palabras
clave relevantes a formalización minera — el feed general trae de todo
(precio del cobre, minería internacional), no solo lo que le importa a
un minero artesanal peruano.

Deliberadamente simple: NO se republica el contenido del artículo (sería
tomar contenido ajeno) — solo título + descripción corta + el enlace al
sitio original, igual que cualquier lector de RSS. Nada de esto se
mezcla con el índice del asesor conversacional (eso sería un proyecto
aparte); es una sección propia, visible igual para cualquier visitante.

Mismo patrón "mejor esfuerzo con caché" que geocatmin.py/reinfo.py: si
Rumbo Minero está caído o cambia de formato, la portada nunca se rompe
— sigue mostrando lo último cacheado (o nada, la primera vez). Se
refresca en segundo plano (ver routers/noticias.py): la primera visita
tras vencer el caché agenda el refresco y sirve lo que ya había,
nunca bloquea una visita real esperando la respuesta de un sitio
externo.

DESACTIVADO por defecto (como reinfo.py/copernicus.py, no como
geocatmin.py): activar con MINELINK_NOTICIAS=1 en Render cuando Esthiven
confirme que quiere la sección en vivo. Aunque no cuesta dinero ni
necesita credenciales, es una dependencia externa nueva — mejor que la
prenda a propósito. Este patrón (apagado salvo que se pida "=1", no
prendido salvo que se pida "=0") también evita un problema real de
orden de importación entre archivos de test: si el default fuera
"prendido", el momento exacto en que test_smoke.py fija la variable de
entorno importaría (pytest puede importar test_noticias.py primero,
alfabéticamente, antes de que ese `os.environ[...] = "0"` se ejecute)."""
import html as _html
import os
import re
import time
import unicodedata
from xml.etree import ElementTree

import requests

_DESACTIVADO = os.environ.get("MINELINK_NOTICIAS") != "1"

_FEED_URL = "https://www.rumbominero.com/feed/"
_TIMEOUT = 10
_MAX_NOTICIAS = 6
_MAX_CARACTERES_DESCRIPCION = 220
# Rumbo Minero se actualiza cada hora según su propio feed, pero no hace
# falta consultarlo tan seguido — 6h alcanza para que se sienta "fresco"
# sin pedirle de más a su servidor.
_INTERVALO_REFRESCO_SEGUNDOS = 6 * 60 * 60

# "Relevante para un minero artesanal peruano" — el feed general trae de
# todo (precio del cobre, minería internacional); esto filtra solo lo
# que de verdad le importa a quien usa MineLink. Sin tildes porque
# _es_relevante normaliza el texto antes de comparar.
_PALABRAS_CLAVE = [
    "reinfo",
    "formalizacion",
    "igafom",
    "mineria artesanal",
    "pequena mineria",
    "minem",
    "concesion minera",
    "mineria informal",
    "mape",
    "ingemmet",
]

_CACHE: list[dict] | None = None
_ULTIMO_REFRESCO: float | None = None


def _sin_tildes(texto: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFKD", texto) if not unicodedata.combining(c)
    )


def _es_relevante(titulo: str, descripcion: str) -> bool:
    texto = _sin_tildes(f"{titulo} {descripcion}".lower())
    return any(palabra in texto for palabra in _PALABRAS_CLAVE)


def _limpiar_descripcion(texto: str) -> str:
    """El <description> del RSS suele traer HTML crudo (párrafos,
    entidades) — esto lo deja como texto plano y corto, para una tarjeta,
    no para el artículo completo."""
    sin_tags = re.sub(r"<[^>]+>", " ", texto)
    sin_tags = _html.unescape(sin_tags)
    sin_tags = re.sub(r"\s+", " ", sin_tags).strip()
    if len(sin_tags) > _MAX_CARACTERES_DESCRIPCION:
        sin_tags = sin_tags[:_MAX_CARACTERES_DESCRIPCION].rsplit(" ", 1)[0] + "…"
    return sin_tags


def _parsear_rss(contenido: bytes) -> list[dict]:
    raiz = ElementTree.fromstring(contenido)
    items = []
    for item in raiz.findall("./channel/item"):
        titulo = (item.findtext("title") or "").strip()
        enlace = (item.findtext("link") or "").strip()
        descripcion = (item.findtext("description") or "").strip()
        fecha = (item.findtext("pubDate") or "").strip()
        if titulo and enlace:
            items.append(
                {"titulo": titulo, "descripcion": descripcion, "enlace": enlace, "fecha": fecha}
            )
    return items


def necesita_refresco() -> bool:
    if _DESACTIVADO:
        return False
    return (
        _ULTIMO_REFRESCO is None
        or time.monotonic() - _ULTIMO_REFRESCO > _INTERVALO_REFRESCO_SEGUNDOS
    )


def noticias_desde_cache() -> list[dict]:
    return _CACHE or []


def refrescar() -> None:
    """Mejor esfuerzo: cualquier fallo (red, formato inesperado del feed)
    deja el caché anterior intacto — nunca lo vacía por un error puntual.
    Marca `_ULTIMO_REFRESCO` incluso si falla, para no reintentar en cada
    visita mientras el sitio externo esté caído."""
    global _CACHE, _ULTIMO_REFRESCO
    if _DESACTIVADO:
        return
    try:
        resp = requests.get(
            _FEED_URL,
            timeout=_TIMEOUT,
            headers={"User-Agent": "MineLinkBot/1.0 (+https://mine-link-seven.vercel.app)"},
        )
        resp.raise_for_status()
        items = _parsear_rss(resp.content)
        relevantes = [
            {
                "titulo": item["titulo"],
                "descripcion": _limpiar_descripcion(item["descripcion"]),
                "enlace": item["enlace"],
                "fecha": item["fecha"],
            }
            for item in items
            if _es_relevante(item["titulo"], item["descripcion"])
        ][:_MAX_NOTICIAS]
        _CACHE = relevantes
    except Exception:
        pass
    finally:
        _ULTIMO_REFRESCO = time.monotonic()

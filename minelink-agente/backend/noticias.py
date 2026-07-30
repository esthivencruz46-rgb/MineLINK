"""Noticias del sector minero peruano en la portada (julio 2026, pedido
explícito de Esthiven): el RSS público de un medio especializado (Rumbo
Minero — rumbominero.com/feed/), filtrado para excluir lo internacional
— el feed general trae de todo (Costa de Marfil, Zimbabue, Chile,
Bolivia...), no solo lo que le importa a un minero o inversionista
peruano.

Se probó migrar a la API `wp-json/wp/v2/posts` (trae imagen destacada,
algo que el RSS no tiene) pero en producción devolvía 403 Forbidden
desde el servidor de Render — confirmado en vivo vía el endpoint de
diagnóstico `estado()`/`GET /noticias/estado` de más abajo, agregado
justamente para poder ver el error real sin entrar a los logs de
Render. Funcionaba perfecto en local/dev: el bloqueo es específico del
lado de Rumbo Minero contra el servidor de producción (típico de un
plugin de seguridad de WordPress bloqueando IPs de datacenter/cloud, o
directamente la ruta `/wp-json/` — un vector común de scraping que
muchos sitios restringen más agresivo que el RSS). El RSS (`/feed/`) es
un endpoint mucho más estándar y universalmente permitido -- lo
consumen lectores/bots de todo tipo, bloquearlo rompe casos de uso
legítimos que a los sitios sí les importan (Google News, agregadores) --
así que es la fuente con más chances reales de funcionar desde Render.
Costo: sin imagen destacada por ahora (el RSS no la trae -- sin
`<enclosure>`, sin `media:content`, sin `content:encoded`, se probó
explícitamente). El schema/frontend igual soportan `imagen: None`
(ícono de respaldo en la tarjeta) por si el día de mañana aparece otra
fuente de datos que sí la traiga.

Filtro por CATEGORÍA, no por palabra clave en el texto (julio 2026,
corregido tras un reporte en vivo de Esthiven — "cómo que no hay
noticias peruanas, hay bastante" — con captura de pantalla del sitio
real mostrando Quellaveco, Huánuco, Fujimori). TODO artículo
internacional está etiquetado explícitamente "Internacionales" (a veces
también "OTROS PAÍSES" o el país en mayúsculas: BOLIVIA, CHILE). Los
artículos peruanos no llevan esa etiqueta. Buscar "Perú" en el
título/descripción fallaba porque una noticia puede ser 100% peruana
sin decir la palabra "Perú" en ningún lado (ej. "Quellaveco genera S/ X
millones en Moquegua"). Como Rumbo Minero ya es un sitio 100% de
minería/energía, todo lo que NO esté etiquetado como internacional es
relevante por defecto — no hace falta además que hable de
REINFO/formalización específicamente.

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
# julio 2026, pedido explícito de Esthiven: que aparezcan más noticias al
# hacer scroll, no una lista fija corta — el frontend revela de a lotes
# (ver NoticiasSection.tsx) sobre esta misma lista ya cacheada, sin
# pedir nada nuevo al backend en cada scroll. _MAX_NOTICIAS es cuánto
# guarda el caché en total.
_MAX_NOTICIAS = 18
_MAX_CARACTERES_DESCRIPCION = 220
# Rumbo Minero se actualiza cada hora, pero no hace falta consultarlo tan
# seguido — 6h alcanza para que se sienta "fresco" sin pedirle de más a
# su servidor.
_INTERVALO_REFRESCO_SEGUNDOS = 6 * 60 * 60

# Categorías de WordPress que Rumbo Minero usa para marcar contenido NO
# peruano (confirmado contra el feed real en vivo, julio 2026). Todo lo
# que NO caiga en esta lista se trata como relevante — el sitio entero ya
# es de minería/energía, y esto es una exclusión, no un filtro positivo.
# "internacionales"/"otros paises" son las etiquetas genéricas que el
# propio sitio usa en TODOS los casos vistos; los países sueltos son
# defensa en profundidad por si algún artículo lleva el país pero no la
# etiqueta genérica (no se vio ese caso en vivo, pero el sitio también
# tiene secciones propias por país en su menú).
_CATEGORIAS_EXCLUIDAS = {
    "internacionales",
    "otros paises",
    "bolivia",
    "chile",
    "mexico",
    "colombia",
    "argentina",
    "ecuador",
    "usa",
    "estados unidos",
    "canada",
}

_CACHE: list[dict] | None = None
_ULTIMO_REFRESCO: float | None = None
_ULTIMO_ERROR: str | None = None


def _sin_tildes(texto: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFKD", texto) if not unicodedata.combining(c)
    )


def _es_relevante(categorias: list[str]) -> bool:
    """Relevante = NO está etiquetado como internacional. Sin categorías
    (formato inesperado, feed distinto) también cuenta como relevante —
    el sitio entero ya es de minería/energía peruana por defecto."""
    normalizadas = {_sin_tildes(c.strip().lower()) for c in categorias if c.strip()}
    return normalizadas.isdisjoint(_CATEGORIAS_EXCLUIDAS)


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
        categorias = [(c.text or "").strip() for c in item.findall("category")]
        if titulo and enlace:
            items.append(
                {
                    "titulo": titulo,
                    "descripcion": descripcion,
                    "enlace": enlace,
                    "fecha": fecha,
                    "categorias": categorias,
                }
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


def estado() -> dict:
    """Diagnóstico público (julio 2026, tras un caso real de /noticias
    vacío en producción sin ninguna pista de por qué): sin esto, revisar
    un fallo de esta llamada externa exige entrar al panel de Logs de
    Render a mano. Nada sensible viaja en este pedido (no hay
    credenciales de por medio, a diferencia del asesor), así que no hace
    falta protegerlo con auth de admin -- solo se expone lo mínimo para
    diagnosticar: si está activado, cuántas hay en caché, hace cuánto
    fue el último intento y el error del último intento fallido, si
    hubo uno."""
    return {
        "desactivado": _DESACTIVADO,
        "cantidad_en_cache": len(_CACHE or []),
        "ultimo_refresco_hace_segundos": (
            round(time.monotonic() - _ULTIMO_REFRESCO, 1) if _ULTIMO_REFRESCO is not None else None
        ),
        "ultimo_error": _ULTIMO_ERROR,
    }


def refrescar() -> None:
    """Mejor esfuerzo: cualquier fallo (red, formato inesperado del feed)
    deja el caché anterior intacto — nunca lo vacía por un error puntual.
    Marca `_ULTIMO_REFRESCO` incluso si falla, para no reintentar en cada
    visita mientras el sitio externo esté caído."""
    global _CACHE, _ULTIMO_REFRESCO, _ULTIMO_ERROR
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
                "imagen": None,
            }
            for item in items
            if _es_relevante(item["categorias"])
        ][:_MAX_NOTICIAS]
        _CACHE = relevantes
        _ULTIMO_ERROR = None
    except Exception as error:
        # No debe romper nunca la portada (mejor esfuerzo), pero un fallo
        # en silencio total es indiagnosticable en producción -- julio
        # 2026, tras un caso real donde /noticias quedó vacío varios
        # minutos después de un deploy y no había ninguna pista de por
        # qué. Se guarda en _ULTIMO_ERROR (ver estado(), consultable sin
        # entrar a Render) y además se imprime (Render captura stdout en
        # su panel de Logs, por si hace falta más detalle).
        _ULTIMO_ERROR = repr(error)
        print(f"[noticias] refrescar() fallo: {error!r}")
    finally:
        _ULTIMO_REFRESCO = time.monotonic()

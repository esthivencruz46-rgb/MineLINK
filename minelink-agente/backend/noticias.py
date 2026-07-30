"""Noticias del sector minero peruano en la portada (julio 2026, pedido
explícito de Esthiven): la API REST pública de WordPress de un medio
especializado (Rumbo Minero — rumbominero.com/wp-json/wp/v2/posts),
filtrada para excluir lo internacional — el feed general trae de todo
(Costa de Marfil, Zimbabue, Chile, Bolivia...), no solo lo que le importa
a un minero o inversionista peruano.

Se usa la API `wp-json` en vez del RSS (`/feed/`, usado en la primera
versión de julio 2026) por dos motivos confirmados en vivo: (1) el RSS
estándar no trae ninguna imagen por artículo (sin `<enclosure>`, sin
`media:content`, sin `content:encoded` — se probó explícitamente) mientras
que `wp-json` sí, vía `_embed=wp:featuredmedia` (pedido de Esthiven:
mostrar la foto del artículo, no solo texto); (2) `wp-json` separa
categoría real de WordPress (`taxonomy: "category"`) de las simples
etiquetas del post (`taxonomy: "post_tag"`, ej. "ORO"/"INVERSION"), un
filtro más preciso que leer el `<category>` del RSS a secas (que mezclaba
ambas cosas, aunque en la práctica no cambiaba el resultado). Se piden
`_POSTS_A_CONSULTAR` (40) en vez de los ~10 que trae el RSS por defecto:
en días con varias notas internacionales seguidas, los últimos posts no
alcanzan para completar `_MAX_NOTICIAS` solo con contenido peruano
(confirmado en vivo julio 2026, reporte con captura de Esthiven mostrando
Huánuco/Fujimori/Quellaveco que quedaban fuera de los primeros 10 — y
luego, pedido explícito de que aparezcan más al hacer scroll en vez de
una lista fija corta, ver `_MAX_NOTICIAS` más abajo).

Filtro por CATEGORÍA, no por palabra clave en el texto (corregido tras
ese mismo reporte — "cómo que no hay noticias peruanas, hay bastante").
TODO artículo internacional está etiquetado explícitamente
"Internacionales" (a veces también "OTROS PAÍSES" o el país en
mayúsculas: BOLIVIA, CHILE). Los artículos peruanos no llevan esa
etiqueta. Buscar "Perú" en el título/descripción fallaba porque una
noticia puede ser 100% peruana sin decir la palabra "Perú" en ningún
lado (ej. "Quellaveco genera S/ X millones en Moquegua"). Como Rumbo
Minero ya es un sitio 100% de minería/energía, todo lo que NO esté
etiquetado como internacional es relevante por defecto — no hace falta
además que hable de REINFO/formalización específicamente.

Deliberadamente simple: NO se republica el contenido del artículo (sería
tomar contenido ajeno) — solo título + extracto corto + imagen destacada
+ el enlace al sitio original, igual que cualquier lector de RSS/vista
previa. Nada de esto se mezcla con el índice del asesor conversacional
(eso sería un proyecto aparte); es una sección propia, visible igual
para cualquier visitante.

Mismo patrón "mejor esfuerzo con caché" que geocatmin.py/reinfo.py: si
Rumbo Minero está caído, cambia de formato o algún día desactiva su API
`wp-json` (algunos sitios WordPress lo bloquean por seguridad — este no,
confirmado en vivo), la portada nunca se rompe — sigue mostrando lo
último cacheado (o nada, la primera vez). Se refresca en segundo plano
(ver routers/noticias.py): la primera visita tras vencer el caché agenda
el refresco y sirve lo que ya había, nunca bloquea una visita real
esperando la respuesta de un sitio externo.

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

import requests

_DESACTIVADO = os.environ.get("MINELINK_NOTICIAS") != "1"

_API_URL = "https://www.rumbominero.com/wp-json/wp/v2/posts"
_TIMEOUT = 10
# julio 2026, pedido explícito de Esthiven: que aparezcan más noticias al
# hacer scroll, no una lista fija de 6 — el frontend revela de a
# _LOTE_FRONTEND (ver NoticiasSection.tsx) sobre esta misma lista ya
# cacheada, sin pedir nada nuevo al backend en cada scroll. _MAX_NOTICIAS
# es cuánto guarda el caché en total (~3 "páginas" de scroll);
# _POSTS_A_CONSULTAR es cuántos posts crudos se piden a wp-json para
# tener de dónde filtrar -- verificado en vivo que con 40 salen ~20
# relevantes en un día normal, suficiente margen para completar
# _MAX_NOTICIAS incluso en un día con muchas notas internacionales
# seguidas (ver docstring del módulo).
_MAX_NOTICIAS = 18
_MAX_CARACTERES_DESCRIPCION = 220
_POSTS_A_CONSULTAR = 40
# Tamaño de imagen de WordPress a usar como miniatura de tarjeta — ni el
# thumbnail cuadrado de 150x150 (se ve recortado en una miniatura
# horizontal) ni el "full" original (pesado para una lista de hasta 18
# notas).
_TAMANO_IMAGEN_PREFERIDO = "medium"
# Rumbo Minero se actualiza cada hora, pero no hace falta consultarlo tan
# seguido — 6h alcanza para que se sienta "fresco" sin pedirle de más a
# su servidor.
_INTERVALO_REFRESCO_SEGUNDOS = 6 * 60 * 60

# Categorías de WordPress que Rumbo Minero usa para marcar contenido NO
# peruano (confirmado contra la API real en vivo, julio 2026). Todo lo
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


def _sin_tildes(texto: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFKD", texto) if not unicodedata.combining(c)
    )


def _es_relevante(categorias: list[str]) -> bool:
    """Relevante = NO está etiquetado como internacional. Sin categorías
    (formato inesperado, API distinta) también cuenta como relevante —
    el sitio entero ya es de minería/energía peruana por defecto."""
    normalizadas = {_sin_tildes(c.strip().lower()) for c in categorias if c.strip()}
    return normalizadas.isdisjoint(_CATEGORIAS_EXCLUIDAS)


def _limpiar_descripcion(texto: str) -> str:
    """El excerpt de WordPress trae HTML crudo (párrafos, entidades) —
    esto lo deja como texto plano y corto, para una tarjeta, no para el
    artículo completo."""
    sin_tags = re.sub(r"<[^>]+>", " ", texto)
    sin_tags = _html.unescape(sin_tags)
    sin_tags = re.sub(r"\s+", " ", sin_tags).strip()
    if len(sin_tags) > _MAX_CARACTERES_DESCRIPCION:
        sin_tags = sin_tags[:_MAX_CARACTERES_DESCRIPCION].rsplit(" ", 1)[0] + "…"
    return sin_tags


def _extraer_imagen(post: dict) -> str | None:
    """La imagen destacada viaja "embebida" (`_embed=wp:featuredmedia`)
    solo si el post tiene una — sin eso, `_embedded` puede no traer la
    clave o traer un objeto de error, nunca asumir que existe."""
    medios = post.get("_embedded", {}).get("wp:featuredmedia")
    if not medios or not isinstance(medios, list):
        return None
    detalles = medios[0].get("media_details")
    if not detalles:
        return None
    tamanos = detalles.get("sizes", {})
    elegido = tamanos.get(_TAMANO_IMAGEN_PREFERIDO) or tamanos.get("full")
    return elegido.get("source_url") if elegido else None


def _parsear_posts(datos: list[dict]) -> list[dict]:
    items = []
    for post in datos:
        titulo = _html.unescape((post.get("title", {}).get("rendered") or "").strip())
        enlace = (post.get("link") or "").strip()
        descripcion = (post.get("excerpt", {}).get("rendered") or "").strip()
        fecha = (post.get("date") or "").strip()
        categorias = [
            termino.get("name", "")
            for grupo in post.get("_embedded", {}).get("wp:term", [])
            for termino in grupo
            if termino.get("taxonomy") == "category"
        ]
        if titulo and enlace:
            items.append(
                {
                    "titulo": titulo,
                    "descripcion": descripcion,
                    "enlace": enlace,
                    "fecha": fecha,
                    "categorias": categorias,
                    "imagen": _extraer_imagen(post),
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


def refrescar() -> None:
    """Mejor esfuerzo: cualquier fallo (red, formato inesperado de la
    API) deja el caché anterior intacto — nunca lo vacía por un error
    puntual. Marca `_ULTIMO_REFRESCO` incluso si falla, para no reintentar
    en cada visita mientras el sitio externo esté caído."""
    global _CACHE, _ULTIMO_REFRESCO
    if _DESACTIVADO:
        return
    try:
        resp = requests.get(
            _API_URL,
            params={"per_page": _POSTS_A_CONSULTAR, "_embed": "wp:featuredmedia,wp:term"},
            timeout=_TIMEOUT,
            headers={"User-Agent": "MineLinkBot/1.0 (+https://mine-link-seven.vercel.app)"},
        )
        resp.raise_for_status()
        items = _parsear_posts(resp.json())
        relevantes = [
            {
                "titulo": item["titulo"],
                "descripcion": _limpiar_descripcion(item["descripcion"]),
                "enlace": item["enlace"],
                "fecha": item["fecha"],
                "imagen": item["imagen"],
            }
            for item in items
            if _es_relevante(item["categorias"])
        ][:_MAX_NOTICIAS]
        _CACHE = relevantes
    except Exception:
        pass
    finally:
        _ULTIMO_REFRESCO = time.monotonic()

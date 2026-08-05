"""Anomalías espectrales minerales por concesión (julio 2026, pedido
explícito de Esthiven tras un experimento aislado en
experimentos_copernicus/): usa Copernicus Data Space Ecosystem (Sentinel
Hub) para calcular, sobre el polígono REAL de la concesión del proyecto,
4 índices de exploración minera (óxidos de hierro, arcillas, hierro
ferroso, arcilla/sulfatos/mica — fórmulas confirmadas contra el
repositorio curado "awesome-mining-band-ratio") más un mapa "combinado"
que superpone los 4 a la vez.

"combinado" es TRANSPARENTE salvo donde hay anomalía, igual que las 4
capas individuales — corregido julio 2026 (reportado en vivo con
captura: "solo pido los colores, no la imagen de fondo... eso también
lo agarras y no quiero eso"). Antes traía su PROPIA foto RGB de
Sentinel-2 (una consulta aparte) como lienzo de fondo, así que al
activarlo tapaba el mapa entero con esa foto -- distinta en resolución/
color a la base satelital del mapa (Esri World Imagery) — en vez de
mostrar solo los colores por encima de ella. Ya no se pide esa foto en
absoluto: una llamada menos a Sentinel Hub, más barato también.

Cada capa se recorta a solo el percentil 90+ de cada índice (el 10% más
alto) — el resto queda TRANSPARENTE — para no prometer una clasificación
fina de alteración hidrotermal (propilítica/argílica/filítica) que
Sentinel-2 no puede dar con solo 2 bandas SWIR (eso necesitaría ASTER,
pausado por costo — ver conversación). Es una señal de "acá hay más
óxido/arcilla que en el resto de la concesión", no un diagnóstico.

Capa adicional "coincidencias" (julio 2026, pedido explícito de Esthiven:
una capa donde 2+ de los otros índices se intersecten en el mismo
píxel) — que varios índices independientes coincidan en el mismo punto
es una señal más fuerte que cualquiera aislado (cada uno reacciona a un
mineral distinto; su coincidencia por azar es más rara), así que resalta
esos píxeles en un color propio (violeta, no usado por ningún índice
individual), más intenso mientras más índices coinciden ahí. Se calcula
sumando las 4 máscaras booleanas ya obtenidas en el mismo loop — CERO
llamadas ni créditos adicionales a Sentinel Hub.

DESACTIVADO por defecto (como reinfo.py): activar con
MINELINK_COPERNICUS=1 una vez que Esthiven cargue CDSE_CLIENT_ID /
CDSE_CLIENT_SECRET en el panel de Render (Dashboard de
dataspace.copernicus.eu -> User Settings -> OAuth Clients). Sin eso,
`generar_capas` devuelve None y el caller conserva lo último cacheado —
igual que todos los servicios externos de este proyecto, nunca rompe la
ficha pública.

Cuota gratis del nivel "General user" de Copernicus: 10,000 Processing
Units/mes. Cada concesión completa (6 capas: 4 índices + combinado +
coincidencias, estas dos últimas sin costo adicional por ser derivadas
localmente de los 4 índices ya pedidos -- ya no se pide una foto RGB
aparte) cuesta ~15-20 PU con el tamaño de imagen usado acá (calculado en
vivo, julio 2026 -- bajó de ~20-25 PU al quitar la llamada de la foto
RGB) -- de sobra para varios cientos de concesiones al mes.
"""
import math
import os
from datetime import date
from io import BytesIO
from typing import Optional

import numpy as np
from PIL import Image, ImageDraw
from sentinelhub import BBox, CRS, DataCollection, MimeType, SentinelHubRequest, SHConfig

_DESACTIVADO = os.environ.get("MINELINK_COPERNICUS") != "1"

_MAX_NUBES = 0.20
_PERCENTIL = 90
# Sentinel-2 no cambia rápido para este propósito (a diferencia de REINFO
# o el catastro) y cada refresco cuesta creditos reales -- 90 dias, mas
# conservador que los 30 de geocatmin.
DIAS_REFRESCO = 90

_KM_POR_GRADO_LAT = 111.32


def _rgb255(color_0a1: tuple) -> list:
    return [round(c * 255) for c in color_0a1]


_RAMPA_JS = """
function rampa(valor, minV, maxV, colorBajo, colorAlto) {
  let t = Math.min(1, Math.max(0, (valor - minV) / (maxV - minV)));
  return [
    colorBajo[0] + t * (colorAlto[0] - colorBajo[0]),
    colorBajo[1] + t * (colorAlto[1] - colorBajo[1]),
    colorBajo[2] + t * (colorAlto[2] - colorBajo[2]),
  ];
}
"""


def _evalscript_crudo(bandas: list, formula: str) -> str:
    entradas = ",".join(f'"{b}"' for b in bandas)
    return f"""
        //VERSION=3
        function setup() {{ return {{ input: [{entradas}], output: {{ bands: 1, sampleType: "FLOAT32" }} }}; }}
        function evaluatePixel(s) {{ return [{formula}]; }}
    """


# Formulas confirmadas julio 2026 contra el repositorio curado
# "awesome-mining-band-ratio" (ver CLAUDE.md) — mismas que
# experimentos_copernicus/procesar_aoi.py, portadas tal cual.
_INDICES = {
    "oxidos_de_hierro": {
        "titulo": "Óxidos de hierro (férrico) — B04/B02",
        "evalscript_crudo": _evalscript_crudo(["B02", "B04"], "s.B04 / (s.B02 + 1e-6)"),
        "color": (220, 20, 20),
    },
    "arcillas": {
        "titulo": "Arcillas (índice simple) — B11/B12",
        "evalscript_crudo": _evalscript_crudo(["B11", "B12"], "s.B11 / (s.B12 + 1e-6)"),
        "color": (0, 102, 204),
    },
    "hierro_ferroso": {
        "titulo": "Hierro ferroso — (B03+B11)/(B04+B08)",
        "evalscript_crudo": _evalscript_crudo(
            ["B03", "B04", "B08", "B11"], "(s.B03 + s.B11) / (s.B04 + s.B08 + 1e-6)"
        ),
        "color": (255, 140, 0),
    },
    "arcilla_sulfatos_mica": {
        "titulo": "Arcilla / Sulfatos / Mica — (B11/B12)/(B08/B04)",
        "evalscript_crudo": _evalscript_crudo(
            ["B04", "B08", "B11", "B12"],
            "(s.B11 / (s.B12 + 1e-6)) / (s.B08 / (s.B04 + 1e-6) + 1e-6)",
        ),
        "color": (204, 204, 0),
    },
}
NOMBRES_CAPAS = [*_INDICES.keys(), "combinado", "coincidencias"]

# Sube cuando cambia qué guarda `generar_capas` (ej. se agregó
# "coincidencias", y luego "combinado" dejó de traer su propia foto de
# fondo — julio 2026; v4 agosto 2026: las 6 capas ahora dibujan el borde
# de la concesión encima, ver _con_borde_poligono; v5 agosto 2026: el
# bbox+lienzo ahora se ajustan al aspecto real del polígono en vez de un
# cuadrado fijo 800x800, ver bbox_y_tamano_de_poligono) — es lo único que
# fuerza un refresco inmediato en `_anomalias_necesita_refresco`
# (routers/proyectos.py); sin esto, el caché ya generado con la forma
# vieja se sigue sirviendo tal cual hasta los DIAS_REFRESCO (90 días),
# mismo patrón que ya usan geocatmin/reinfo para sus propios cachés
# versionados.
VERSION_CACHE = 5

# Violeta: no lo usa ninguno de los 4 índices individuales (rojo/azul/
# naranja/amarillo), para que la coincidencia se distinga a simple vista
# de cualquier índice aislado. Más opaco mientras más índices coinciden
# en el mismo píxel (2 de 4 ya es una señal; 4 de 4 es la más fuerte).
_COLOR_COINCIDENCIAS = (155, 0, 200)
_ALPHA_POR_COINCIDENCIAS = {2: 140, 3: 200, 4: 255}


def _capa_coincidencias(conteo: np.ndarray) -> Image.Image:
    """`conteo[y,x]` = en cuántos de los 4 índices ese píxel cayó en su
    percentil 90+. Píxeles con 0 o 1 quedan transparentes (no es una
    coincidencia, es ruido de un solo índice)."""
    rgba = np.zeros((*conteo.shape, 4), dtype=np.uint8)
    for n, alpha in _ALPHA_POR_COINCIDENCIAS.items():
        rgba[conteo == n] = [*_COLOR_COINCIDENCIAS, alpha]
    return Image.fromarray(rgba, mode="RGBA")


_LADO_PX_MAX = 800
_LADO_PX_MIN = 400


def bbox_y_tamano_de_poligono(
    poligono: list, margen: float = 1.12
) -> tuple[Optional[tuple], Optional[tuple[int, int]]]:
    """Bbox en WGS84 Y el tamaño de lienzo (ancho,alto en píxeles) que le
    corresponde a SU PROPIO aspecto -- mismo criterio que
    `geocatmin._bbox_y_tamano_ajustado_poligono` (agosto 2026, pedido
    explícito tras comparar en vivo capturas reales de las dos capas:
    "las fotos de Copernicus [deben ser] como la de ASTER 931 o Anomalías
    Espectrales... todas las capas deben ser iguales a esas"). Reemplaza
    el bbox exacto del polígono sobre un lienzo CUADRADO fijo
    (`_TAMANO_PX`) que usaba antes: al forzar toda concesión a encajar en
    un cuadrado, una concesión angosta quedaba distorsionada o mal
    encuadrada. Generar el lienzo AL aspecto real del bbox (con un
    margen chico, en vez de el bbox exacto sin margen) hace que la
    concesión llene el cuadro sin distorsión, igual que en GEOCATMIN.
    Duplicada a propósito, no importada de geocatmin -- mismo criterio que
    `_COLOR_BORDE_CONCESION`: geocatmin y copernicus son módulos
    independientes, cada uno best-effort por su cuenta. None si el
    polígono viene vacío/mal formado."""
    if not poligono or not poligono[0]:
        return None, None
    anillo = poligono[0]
    lngs = [p[0] for p in anillo]
    lats = [p[1] for p in anillo]
    cx, cy = (min(lngs) + max(lngs)) / 2, (min(lats) + max(lats)) / 2
    medio_lng = max((max(lngs) - min(lngs)) / 2, 0.0008) * margen
    medio_lat = max((max(lats) - min(lats)) / 2, 0.0008) * margen
    bbox = (cx - medio_lng, cy - medio_lat, cx + medio_lng, cy + medio_lat)

    aspecto = medio_lng / medio_lat
    if aspecto >= 1:
        ancho, alto = _LADO_PX_MAX, round(_LADO_PX_MAX / aspecto)
    else:
        ancho, alto = round(_LADO_PX_MAX * aspecto), _LADO_PX_MAX
    return bbox, (max(ancho, _LADO_PX_MIN), max(alto, _LADO_PX_MIN))


# Mismo color que geocatmin._COLOR_BORDE_CONCESION -- una sola convención
# visual para "esto es el borde de la concesión" en toda la app, sea cual
# sea la capa (Copernicus o GEOCATMIN) que lo dibuje.
_COLOR_BORDE_CONCESION = (0, 255, 255, 255)


def _con_borde_poligono(imagen: Image.Image, bbox_coords: tuple, poligono: list) -> Image.Image:
    """Dibuja el contorno (sin relleno) de la concesión sobre una capa ya
    recortada al bbox de esa misma concesión -- agosto 2026, pedido
    explícito de Esthiven: las 6 capas de Copernicus se veían "solas",
    sin ninguna referencia de qué parte de la imagen es la concesión real
    y qué parte es solo el margen del bounding box. Mismo mecanismo que
    geocatmin._con_borde_concesion; lee `imagen.size` (no un tamaño fijo)
    porque el lienzo ahora varía según el aspecto del propio polígono
    (ver `bbox_y_tamano_de_poligono`)."""
    if not poligono:
        return imagen
    xmin, ymin, xmax, ymax = bbox_coords
    ancho, alto = imagen.size
    dibujo = ImageDraw.Draw(imagen)
    for anillo in poligono:
        puntos = [
            (
                (lng - xmin) / (xmax - xmin) * ancho,
                (ymax - lat) / (ymax - ymin) * alto,
            )
            for lng, lat in anillo
        ]
        if len(puntos) >= 2:
            dibujo.line(puntos + [puntos[0]], fill=_COLOR_BORDE_CONCESION, width=3)
    return imagen


def _config() -> Optional[SHConfig]:
    client_id = os.environ.get("CDSE_CLIENT_ID", "").strip()
    client_secret = os.environ.get("CDSE_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        return None
    config = SHConfig()
    config.sh_client_id = client_id
    config.sh_client_secret = client_secret
    config.sh_base_url = "https://sh.dataspace.copernicus.eu"
    config.sh_token_url = (
        "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
    )
    return config


def _pedir(config: SHConfig, bbox: BBox, evalscript: str, formato: MimeType, tamano: tuple):
    request = SentinelHubRequest(
        evalscript=evalscript,
        input_data=[
            SentinelHubRequest.input_data(
                # Igual que en el experimento: la coleccion por defecto trae
                # fija la URL del Sentinel Hub generico, que pisa el config
                # y manda el request al servidor equivocado para
                # credenciales de CDSE (verificado en vivo: 401).
                data_collection=DataCollection.SENTINEL2_L2A.define_from(
                    "SENTINEL2_L2A_CDSE", service_url=config.sh_base_url
                ),
                time_interval=(_fecha_hace_18_meses(), date.today().isoformat()),
                maxcc=_MAX_NUBES,
                mosaicking_order="leastCC",
            )
        ],
        responses=[SentinelHubRequest.output_response("default", formato)],
        bbox=bbox,
        size=tamano,
        config=config,
    )
    return request.get_data()[0]


def _fecha_hace_18_meses() -> str:
    hoy = date.today()
    anio, mes = hoy.year, hoy.month - 18
    while mes <= 0:
        mes += 12
        anio -= 1
    return date(anio, mes, 1).isoformat()


def _png_bytes(imagen: Image.Image) -> bytes:
    buf = BytesIO()
    imagen.save(buf, format="PNG")
    return buf.getvalue()


def generar_capas(poligono: list) -> Optional[dict]:
    """{"bbox": [xmin,ymin,xmax,ymax], "generado_en": iso, "v": VERSION_CACHE,
    "capas": {"oxidos_de_hierro": bytes_png, ..., "combinado": bytes_png,
    "coincidencias": bytes_png}} -- o None si esta desactivado, faltan
    credenciales, no hay poligono, o la consulta a Copernicus falla
    (best-effort, igual que geocatmin y reinfo: nunca rompe la ficha, el
    caller conserva lo último cacheado)."""
    if _DESACTIVADO:
        return None
    config = _config()
    if config is None:
        return None
    bbox_coords, tamano = bbox_y_tamano_de_poligono(poligono)
    if bbox_coords is None:
        return None

    try:
        bbox = BBox(bbox_coords, crs=CRS.WGS84)
        # "combinado" arranca TRANSPARENTE (julio 2026, reportado en vivo:
        # "solo pido los colores, no la imagen de fondo") -- antes pedía su
        # propia foto RGB de Sentinel-2 como lienzo y tapaba el mapa entero
        # con ella al activarlo. Ya no se pide esa foto en absoluto: una
        # llamada menos a Sentinel Hub por generación.
        lienzo_combinado: Optional[Image.Image] = None

        capas: dict[str, bytes] = {}
        conteo_coincidencias: Optional[np.ndarray] = None
        for nombre, info in _INDICES.items():
            valores = _pedir(config, bbox, info["evalscript_crudo"], MimeType.TIFF, tamano)
            umbral = float(np.percentile(valores, _PERCENTIL))
            mascara = valores >= umbral

            rgba = np.zeros((*mascara.shape, 4), dtype=np.uint8)
            rgba[mascara] = [*info["color"], 255]
            capa_imagen = _con_borde_poligono(
                Image.fromarray(rgba, mode="RGBA"), bbox_coords, poligono
            )
            capas[nombre] = _png_bytes(capa_imagen)

            if lienzo_combinado is None:
                lienzo_combinado = Image.new("RGBA", (mascara.shape[1], mascara.shape[0]), (0, 0, 0, 0))
            capa_media = np.zeros((*mascara.shape, 4), dtype=np.uint8)
            capa_media[mascara] = [*info["color"], 128]
            lienzo_combinado = Image.alpha_composite(
                lienzo_combinado, Image.fromarray(capa_media, mode="RGBA")
            )

            mascara_uint8 = mascara.astype(np.uint8)
            conteo_coincidencias = (
                mascara_uint8 if conteo_coincidencias is None else conteo_coincidencias + mascara_uint8
            )

        capas["combinado"] = _png_bytes(
            _con_borde_poligono(lienzo_combinado, bbox_coords, poligono)
        )
        capas["coincidencias"] = _png_bytes(
            _con_borde_poligono(_capa_coincidencias(conteo_coincidencias), bbox_coords, poligono)
        )
        return {
            "bbox": list(bbox_coords),
            "generado_en": date.today().isoformat(),
            "v": VERSION_CACHE,
            "capas": capas,
        }
    except Exception:
        # best-effort: cualquier fallo de red/credenciales/cuota agotada
        # no debe romper la ficha — se conserva lo último cacheado.
        return None

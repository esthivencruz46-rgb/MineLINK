"""Anomalías espectrales minerales por concesión (julio 2026, pedido
explícito de Esthiven tras un experimento aislado en
experimentos_copernicus/): usa Copernicus Data Space Ecosystem (Sentinel
Hub) para calcular, sobre el polígono REAL de la concesión del proyecto,
4 índices de exploración minera (óxidos de hierro, arcillas, hierro
ferroso, arcilla/sulfatos/mica — fórmulas confirmadas contra el
repositorio curado "awesome-mining-band-ratio") más un mapa combinado que
los superpone sobre la foto real del terreno.

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
coincidencias, esta última sin costo por ser derivada localmente)
cuesta ~20-25 PU con el tamaño de imagen usado acá (calculado en vivo,
julio 2026) -- de sobra para varios cientos de concesiones al mes.
"""
import math
import os
from datetime import date
from io import BytesIO
from typing import Optional

import numpy as np
from PIL import Image
from sentinelhub import BBox, CRS, DataCollection, MimeType, SentinelHubRequest, SHConfig

_DESACTIVADO = os.environ.get("MINELINK_COPERNICUS") != "1"

_TAMANO_PX = (800, 800)
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


_EVALSCRIPT_RGB = """
    //VERSION=3
    function setup() { return { input: ["B02","B03","B04"], output: { bands: 3 } }; }
    function evaluatePixel(s) { return [s.B04*2.5, s.B03*2.5, s.B02*2.5]; }
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


def bbox_de_poligono(poligono: list) -> Optional[tuple]:
    """xmin,ymin,xmax,ymax en WGS84 a partir de los anillos ArcGIS
    [lng,lat] de geocatmin (mismo polígono que ya dibuja el mapa) — None
    si el polígono viene vacío/mal formado."""
    if not poligono or not poligono[0]:
        return None
    anillo = poligono[0]
    lngs = [p[0] for p in anillo]
    lats = [p[1] for p in anillo]
    return min(lngs), min(lats), max(lngs), max(lats)


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


def _pedir(config: SHConfig, bbox: BBox, evalscript: str, formato: MimeType):
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
        size=_TAMANO_PX,
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
    """{"bbox": [xmin,ymin,xmax,ymax], "generado_en": iso, "v": 1,
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
    bbox_coords = bbox_de_poligono(poligono)
    if bbox_coords is None:
        return None

    try:
        bbox = BBox(bbox_coords, crs=CRS.WGS84)
        base = _pedir(config, bbox, _EVALSCRIPT_RGB, MimeType.PNG)
        lienzo_combinado = Image.fromarray(base).convert("RGBA")

        capas: dict[str, bytes] = {}
        conteo_coincidencias: Optional[np.ndarray] = None
        for nombre, info in _INDICES.items():
            valores = _pedir(config, bbox, info["evalscript_crudo"], MimeType.TIFF)
            umbral = float(np.percentile(valores, _PERCENTIL))
            mascara = valores >= umbral

            rgba = np.zeros((*mascara.shape, 4), dtype=np.uint8)
            rgba[mascara] = [*info["color"], 255]
            capas[nombre] = _png_bytes(Image.fromarray(rgba, mode="RGBA"))

            capa_media = np.zeros((*mascara.shape, 4), dtype=np.uint8)
            capa_media[mascara] = [*info["color"], 128]
            lienzo_combinado = Image.alpha_composite(
                lienzo_combinado, Image.fromarray(capa_media, mode="RGBA")
            )

            mascara_uint8 = mascara.astype(np.uint8)
            conteo_coincidencias = (
                mascara_uint8 if conteo_coincidencias is None else conteo_coincidencias + mascara_uint8
            )

        capas["combinado"] = _png_bytes(lienzo_combinado)
        capas["coincidencias"] = _png_bytes(_capa_coincidencias(conteo_coincidencias))
        return {
            "bbox": list(bbox_coords),
            "generado_en": date.today().isoformat(),
            "v": 1,
            "capas": capas,
        }
    except Exception:
        # best-effort: cualquier fallo de red/credenciales/cuota agotada
        # no debe romper la ficha — se conserva lo último cacheado.
        return None

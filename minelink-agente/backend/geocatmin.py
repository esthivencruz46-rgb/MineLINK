"""Consulta GEOCATMIN (INGEMMET) por punto: con las coordenadas del pin
que el minero declaró, trae datos OFICIALES de registros públicos:

- Catastro minero (SERV_CATASTRO_MINERO_WGS84, capa 0): la concesión en
  la que cae el punto — nombre, código único, titular registrado, estado
  (titulado / en trámite / extinguido) y hectáreas.
- Geología integrada 100K (SERV_GEOLOGIA_100K_INTEGRADA, capa 6): la
  unidad geológica y su litología en el punto — cobertura de TODO el país.
- Geología 50K (SERV_GEOLOGIA_50K_INTEGRADA, capa 7 "Litología"): más
  detalle, pero SOLO donde INGEMMET tiene carta a esa escala — se muestra
  además de la 100K cuando existe, nunca en su lugar (la 100K es la base
  garantizada).
- Fallas geológicas cercanas al pin (julio 2026, pedido explícito de
  Esthiven): capa "Fallas" a 1:50K (SERV_GEOLOGIA_50K_INTEGRADA, capa 2)
  con reserva a 1:100K (SERV_GEOLOGIA_100K_INTEGRADA, capa 3) cuando la
  50K no tiene cobertura ahí — a diferencia de geologia/geologia_50k, acá
  NUNCA se muestran ambas escalas juntas, se usa 100K solo si 50K no dio
  nada. Es una capa de LÍNEA (una falla no tiene ancho) — un punto casi
  nunca cae justo encima, así que se busca dentro de un radio
  (`_DISTANCIA_FALLA_M`, verificado en vivo contra proyectos reales) en
  vez de una intersección exacta; si ninguna escala encuentra nada ahí,
  se reintenta una vez con un radio ampliado (`_DISTANCIA_FALLA_AMPLIADA_M`,
  ~10x10 km) antes de confirmar que no hay fallas cerca.
- Sedimentos de quebrada (SERV_GEOQUIMICA_2022, capa 0, puntos de
  geoquímica de INGEMMET — agosto 2026, pedido explícito de Esthiven):
  muestras que caen DENTRO del polígono de la concesión y, si no hay
  ninguna dentro, las más cercanas (buffer ampliado alrededor del
  polígono) con su distancia al pin. Es una capa de PUNTOS y los campos
  de elementos van como texto ("N.R." = no reportado, "<10" = límite de
  detección). El query usa la geometría poligonal de la concesión (no por
  punto). La codificación de INGEMMET fue un problema real (agosto 2026):
  hoy el servicio sirve UTF-8 real y un decode fijo latin-1 corrompía los
  nombres ("ProspecciÃ³n GeoquÃ­mica"), pero la capa de catastro llegó a
  servir latin-1 pese a declarar UTF-8 (el "Per�" histórico) — por eso
  `_json_de_respuesta` intenta UTF-8 estricto y solo cae a latin-1 cuando
  el body no es UTF-8 válido (ver ahí y `_query_geometria_poligono`).

Es "best effort", igual que geoubicacion.py: si INGEMMET no responde se
devuelve None y el caller conserva lo último cacheado — la ficha pública
nunca se cae ni se queda cargando por culpa de un servicio externo. El
resultado se cachea en la operación (ver routers/proyectos.py) porque el
pin casi nunca cambia y el catastro se actualiza a diario, no por hora.

IMPORTANTE: el pin es APROXIMADO y lo declara el minero — que no caiga
dentro de una concesión NO prueba nada malo (y operar una concesión de
otro titular vía contrato es perfectamente legal). Todo se presenta como
dato referencial, nunca como sentencia.
"""

import json
import math
import os
from datetime import date
from typing import Optional

import requests

# Los tests lo desactivan para no hacer llamadas externas reales.
_DESACTIVADO = os.environ.get("MINELINK_GEOCATMIN") == "0"

_BASE = "https://geocatmin.ingemmet.gob.pe/arcgis/rest/services"
# SERNANP publica sus ANP en su propio ArcGIS (verificado julio 2026):
# capa 0102/0 = ANP de administración nacional; 0214/0 = zonas de
# amortiguamiento. Campos: anp_nomb, anp_cate.
_SERNANP = "https://geoservicios.sernanp.gob.pe/arcgis/rest/services/servicios_ogc"
# 20 (antes 12): las exportaciones de imagen al vuelo (capa-3d, galería de
# análisis) llegaban a tardar ~10s desde el datacenter de Render, y con el
# arranque en frío se pasaban del timeout viejo y devolvían 404 "No se pudo
# generar esa capa" intermitente (agosto 2026, ver errores_aprendidos.md).
_TIMEOUT = 20
# La 50K es notablemente más lenta que el resto (verificado: hasta ~25s en
# algunas zonas) — se le da más margen porque es best-effort y el
# resultado queda cacheado 30 días, así que un primer load lento es
# aceptable a cambio de no perder el dato cuando sí existe.
_TIMEOUT_50K = 25
_TIMEOUT_FALLAS = 15

# Radio de búsqueda para la capa de fallas (línea, ancho cero). Calibrado
# en vivo contra proyectos reales de producción (julio 2026): a 1-2km ya
# hay señal real en zonas mineras típicas; a 500m-1km casi siempre da
# vacío incluso donde sí hay fallas relativamente cerca.
_DISTANCIA_FALLA_M = 2000
# Segundo intento (pedido explícito de Esthiven, julio 2026) SOLO cuando
# el radio corto no encontró nada en ninguna escala: un cuadrado de
# ~10x10 km centrado en el pin, aproximado acá como radio de 5 km
# (círculo inscrito en ese cuadrado) — prefiere mostrar una falla algo
# más lejana a que la ficha diga "no hay" cuando en realidad sí hay, solo
# que fuera del radio chico. Nunca reemplaza el radio corto como
# criterio principal, ni inventa una falla: si tampoco encuentra nada
# acá, `items` queda en `[]` (verificado, de verdad no hay).
_DISTANCIA_FALLA_AMPLIADA_M = 5000
# Fallas distintas que se devuelven como máximo (varias son segmentos de
# la misma falla — se deduplica por nombre antes de aplicar este tope).
_MAX_FALLAS = 5

# Sedimentos de quebrada (geoquímica de INGEMMET, SERV_GEOQUIMICA_2022,
# capa 0) — capa de PUNTOS, los elementos van como texto ("N.R." = no
# reportado, "<10" = límite de detección). El query se hace con la
# geometría POLIGONAL de la concesión (no por punto como las demás): lo
# primero que interesa es qué muestras caen DENTRO del polígono. La
# codificación la resuelve `_json_de_respuesta` (ver ahí).
_CAMPOS_LEY_SEDIMENTO = (
    "AU_PPB",
    "AU_PPM",
    "AG_PPM",
    "CU_PPM",
    "PB_PPM",
    "ZN_PPM",
    "AS_PPM",
    "SB_PPM",
    "SN_PPM",
    "MO_PPM",
)
_SEDIMENTOS_OUT_FIELDS = "CODIGO,NOMBRE_PROYECTO," + ",".join(_CAMPOS_LEY_SEDIMENTO)
# Buffer ampliado (metros) para "¿hay cercanas?" cuando no hay ninguna
# muestra dentro del polígono — mismo espíritu que
# _DISTANCIA_FALLA_AMPLIADA_M: prefiere mostrar una muestra algo más
# lejana a decir "no hay" cuando en realidad sí hay, solo que fuera de la
# concesión.
_DISTANCIA_SEDIMENTOS_M = 5000
# Muestras que se devuelven en la ficha como máximo (dentro del polígono
# y cercanas, por separado) — no hace falta el catálogo completo.
_MAX_SEDIMENTOS_DENTRO = 10
_MAX_SEDIMENTOS_CERCANOS = 5

# Capas de SERV_AREA_RESERVADA que generan alerta si el pin cae dentro
# (id de capa → etiqueta legible). La 2 ("Área de No Admisión de
# Petitorios") importa sobre todo al perfil A.
_CAPAS_RESTRICCION = {
    0: "Área de defensa nacional",
    1: "Zona arqueológica",
    2: "Área de no admisión de petitorios",
    6: "Zona urbana",
}

# Cada cuántos días se vuelve a consultar aunque el pin no haya cambiado.
DIAS_REFRESCO = 30


def _nombre_de(attrs: dict) -> Optional[str]:
    """Primer atributo que parezca un nombre legible (los servicios del
    Estado no comparten esquema: NOMBRE, anp_nomb, NM_ZONA...)."""
    for k, v in attrs.items():
        if v and any(s in k.upper() for s in ("NOMB", "NAME")):
            return str(v)
    return None


def _json_de_respuesta(r) -> dict:
    """JSON de la respuesta de INGEMMET tolerando la codificación real del
    servicio (agosto 2026, verificado en vivo). Hoy SERV_GEOQUIMICA_2022
    sirve UTF-8 real — `r.json()` lo decodifica bien, mientras que un
    decode fijo latin-1 corrompía los nombres de proyecto en la ficha
    ("ProspecciÃ³n GeoquÃ­mica" en vez de "Prospección Geoquímica").
    Pero INGEMMET ya mostró servido latin-1 pese a declarar UTF-8 (la capa
    de catastro, origen del "Per�" histórico que derivó en el latin-1
    fijo): si el body no es UTF-8 válido se decodifica latin-1. ASCII
    decodifica igual en ambas, así que el fallback nunca altera respuestas
    que no tienen acentos. Nunca se usa `r.json()` (requests decodifica
    con errors="replace" según su heurística, no distingue estos casos)."""
    try:
        return json.loads(r.content.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return json.loads(r.content.decode("latin-1"))


def _query_punto(
    servicio: str,
    capa: int,
    lng: float,
    lat: float,
    out_fields: str,
    con_geometria: bool = False,
    base: str = _BASE,
    timeout: int = _TIMEOUT,
) -> Optional[dict]:
    """Primer polígono que contiene el punto ({attributes, geometry}), o None."""
    r = requests.get(
        f"{base}/{servicio}/MapServer/{capa}/query",
        params={
            "geometry": '{"x":%s,"y":%s,"spatialReference":{"wkid":4326}}' % (lng, lat),
            "geometryType": "esriGeometryPoint",
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": out_fields,
            "returnGeometry": "true" if con_geometria else "false",
            "outSR": 4326,
            "f": "json",
        },
        timeout=timeout,
    )
    r.raise_for_status()
    features = _json_de_respuesta(r).get("features") or []
    return features[0] if features else None


def _query_cercania(
    servicio: str,
    capa: int,
    lng: float,
    lat: float,
    out_fields: str,
    distancia_m: int = _DISTANCIA_FALLA_M,
    timeout: int = _TIMEOUT_FALLAS,
    con_geometria: bool = False,
) -> list[dict]:
    """Como `_query_punto` pero para capas de LÍNEA (fallas): busca todo lo
    que esté dentro de un radio, no una intersección exacta — una falla
    tiene ancho cero, así que un punto casi nunca cae justo encima.
    Verificado en vivo (julio 2026) que este servicio de INGEMMET sí
    respeta `distance`/`units` (no todos los ArcGIS Server antiguos lo
    hacen). `con_geometria`: devolver la posición de cada feature (lo
    necesitan las muestras de sedimentos para calcular su distancia al
    pin). Se parsea con `_json_de_respuesta` (tolerante al encoding real
    del servicio, ver ahí)."""
    r = requests.get(
        f"{_BASE}/{servicio}/MapServer/{capa}/query",
        params={
            "geometry": '{"x":%s,"y":%s,"spatialReference":{"wkid":4326}}' % (lng, lat),
            "geometryType": "esriGeometryPoint",
            "spatialRel": "esriSpatialRelIntersects",
            "distance": distancia_m,
            "units": "esriSRUnit_Meter",
            "inSR": 4326,
            "outFields": out_fields,
            "returnGeometry": "true" if con_geometria else "false",
            "outSR": 4326,
            "f": "json",
        },
        timeout=timeout,
    )
    r.raise_for_status()
    return _json_de_respuesta(r).get("features") or []


_CAPA_FALLAS_POR_ESCALA = {
    "50k": ("SERV_GEOLOGIA_50K_INTEGRADA", 2, "TIPO,NOMBRE,SISTEMA"),
    "100k": ("SERV_GEOLOGIA_100K_INTEGRADA", 3, "DESCRIP"),
}


def _fallas_cercanas(lng: float, lat: float) -> Optional[dict]:
    """{"escala": "50k"|"100k", "items": [{"nombre","tipo"}, ...]} — o None
    si NINGUNA de las dos consultas pudo completarse (no se pudo
    verificar; distinto de "se verificó y no hay fallas cerca", que es
    `{"escala": ..., "items": []}`). Prioriza 1:50K (más detalle); si esa
    consulta responde pero no encuentra nada dentro del radio (sin
    cobertura a esa escala en la zona, o de verdad no hay), cae a 1:100K
    — NUNCA se combinan ambas escalas, a diferencia de geologia/geologia_50k.
    Si NINGUNA escala encontró nada dentro de `_DISTANCIA_FALLA_M`, se
    reintenta UNA vez con `_DISTANCIA_FALLA_AMPLIADA_M` antes de dar por
    confirmado que no hay fallas cerca (pedido explícito de Esthiven)."""
    escala: Optional[str] = None
    features: list[dict] = []
    try:
        features = _query_cercania(
            "SERV_GEOLOGIA_50K_INTEGRADA", 2, lng, lat, "TIPO,NOMBRE,SISTEMA"
        )
        if features:
            escala = "50k"
    except requests.RequestException:
        pass

    if not features:
        try:
            features = _query_cercania("SERV_GEOLOGIA_100K_INTEGRADA", 3, lng, lat, "DESCRIP")
            escala = "100k"  # respondió (aunque sea vacío) = verificado a esta escala
        except requests.RequestException:
            pass

    if escala is not None and not features:
        servicio, capa, out_fields = _CAPA_FALLAS_POR_ESCALA[escala]
        try:
            features = _query_cercania(
                servicio, capa, lng, lat, out_fields, distancia_m=_DISTANCIA_FALLA_AMPLIADA_M
            )
        except requests.RequestException:
            pass

    if escala is None:
        return None

    vistos: set[str] = set()
    items = []
    for f in features:
        attrs = f.get("attributes") or {}
        etiqueta = attrs.get("NOMBRE") or attrs.get("SISTEMA") or attrs.get("DESCRIP")
        if not etiqueta or etiqueta in vistos:
            continue
        vistos.add(etiqueta)
        items.append({"nombre": etiqueta, "tipo": attrs.get("TIPO")})
        if len(items) >= _MAX_FALLAS:
            break
    return {"escala": escala, "items": items}


def _query_geometria_poligono(
    servicio: str,
    capa: int,
    poligono: list,
    out_fields: str,
    distancia_m: Optional[int] = None,
    timeout: int = _TIMEOUT,
) -> list[dict]:
    """Query con geometría de POLÍGONO (los anillos del catastro) en vez de
    punto — para las muestras de sedimentos que caen DENTRO de la
    concesión. `distancia_m`: buffer en metros alrededor del polígono
    (verificado en vivo, agosto 2026, que los servicios de INGEMMET sí
    respetan `distance`/`units` con geometría poligonal, igual que con
    punto). Se parsea con `_json_de_respuesta` (tolerante al encoding real
    del servicio — verificado en vivo agosto 2026 que el body de
    SERV_GEOQUIMICA_2022 es UTF-8 real)."""
    params: dict = {
        "geometry": json.dumps({"rings": poligono, "spatialReference": {"wkid": 4326}}),
        "geometryType": "esriGeometryPolygon",
        "spatialRel": "esriSpatialRelIntersects",
        "inSR": 4326,
        "outFields": out_fields,
        "returnGeometry": "true",
        "outSR": 4326,
        "f": "json",
    }
    if distancia_m:
        params.update({"distance": distancia_m, "units": "esriSRUnit_Meter"})
    r = requests.get(
        f"{_BASE}/{servicio}/MapServer/{capa}/query", params=params, timeout=timeout
    )
    r.raise_for_status()
    return _json_de_respuesta(r).get("features") or []


def _muestra_sedimento(feature: dict, con_posicion: bool = False) -> dict:
    """De un feature de SERV_GEOQUIMICA_2022, arma la muestra legible:
    {codigo, proyecto, leyes} — las leyes solo con los elementos que de
    verdad tienen valor ("N.R." y vacíos se omiten). `con_posicion` añade
    la lng/lat del punto (necesaria para ordenar las cercanas por
    distancia)."""
    attrs = feature.get("attributes") or {}
    leyes = {
        campo: str(attrs[campo])
        for campo in _CAMPOS_LEY_SEDIMENTO
        if attrs.get(campo) not in (None, "", "N.R.")
    }
    muestra: dict = {
        "codigo": attrs.get("CODIGO"),
        "proyecto": attrs.get("NOMBRE_PROYECTO"),
        "leyes": leyes,
    }
    if con_posicion:
        geom = feature.get("geometry") or {}
        muestra["lng"] = geom.get("x")
        muestra["lat"] = geom.get("y")
    return muestra


def _distancia_km(lng1: float, lat1: float, lng2: float, lat2: float) -> float:
    """Distancia haversine en km — para ordenar las muestras cercanas por
    su distancia al pin (el pin es la referencia que conoce el minero)."""
    radio = 6371.0088
    fi1, fi2 = math.radians(lat1), math.radians(lat2)
    dfi, dlng = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dfi / 2) ** 2 + math.cos(fi1) * math.cos(fi2) * math.sin(dlng / 2) ** 2
    return 2 * radio * math.asin(math.sqrt(a))


def _cercanas_sedimentos(features: list[dict], lng: float, lat: float) -> list[dict]:
    """Las `_MAX_SEDIMENTOS_CERCANOS` muestras más próximas al pin, de más
    cercana a más lejana, cada una con su `distancia_km` (redondeada a 1
    decimal)."""
    con_posicion = []
    for f in features:
        muestra = _muestra_sedimento(f, con_posicion=True)
        if muestra["lng"] is None or muestra["lat"] is None:
            continue
        muestra["distancia_km"] = round(
            _distancia_km(lng, lat, muestra["lng"], muestra["lat"]), 1
        )
        muestra.pop("lng", None)
        muestra.pop("lat", None)
        con_posicion.append(muestra)
    con_posicion.sort(key=lambda m: m["distancia_km"])
    return con_posicion[:_MAX_SEDIMENTOS_CERCANOS]


def _sedimentos_en_zona(lng: float, lat: float, poligono: Optional[list]) -> Optional[dict]:
    """¿Hay muestras de sedimentos de quebrada (geoquímica de INGEMMET,
    SERV_GEOQUIMICA_2022, capa 0) DENTRO del polígono de la concesión? Y
    si no hay ninguna dentro, ¿hay cercanas (buffer ampliado alrededor del
    polígono, con su distancia al pin)? Devuelve
    {"total_dentro", "dentro": [...], "cercanas": [...]}; None = la
    consulta falló (no se pudo verificar — distinto de "se verificó y no
    hay"). `total_dentro` es el conteo real; la lista `dentro` se recorta a
    `_MAX_SEDIMENTOS_DENTRO` para no inflar el caché. Sin polígono (el pin
    no cae en ninguna concesión) se busca por radio alrededor del pin."""
    if poligono:
        try:
            features = _query_geometria_poligono(
                "SERV_GEOQUIMICA_2022", 0, poligono, _SEDIMENTOS_OUT_FIELDS
            )
        except requests.RequestException:
            return None
        dentro = [_muestra_sedimento(f) for f in features]
        if dentro:
            return {
                "total_dentro": len(dentro),
                "dentro": dentro[:_MAX_SEDIMENTOS_DENTRO],
                "cercanas": [],
            }
        # Verificado que no hay dentro: se busca en un buffer ampliado
        # alrededor del polígono; si ese intento falla, se cae al radio
        # alrededor del pin como última instancia.
        cercanas: list[dict] = []
        try:
            cercanas = _cercanas_sedimentos(
                _query_geometria_poligono(
                    "SERV_GEOQUIMICA_2022",
                    0,
                    poligono,
                    _SEDIMENTOS_OUT_FIELDS,
                    distancia_m=_DISTANCIA_SEDIMENTOS_M,
                ),
                lng,
                lat,
            )
        except requests.RequestException:
            pass
        if not cercanas:
            try:
                cercanas = _cercanas_sedimentos(
                    _query_cercania(
                        "SERV_GEOQUIMICA_2022",
                        0,
                        lng,
                        lat,
                        _SEDIMENTOS_OUT_FIELDS,
                        distancia_m=_DISTANCIA_SEDIMENTOS_M,
                        con_geometria=True,
                    ),
                    lng,
                    lat,
                )
            except requests.RequestException:
                pass
        return {"total_dentro": 0, "dentro": [], "cercanas": cercanas}
    try:
        features = _query_cercania(
            "SERV_GEOQUIMICA_2022",
            0,
            lng,
            lat,
            _SEDIMENTOS_OUT_FIELDS,
            distancia_m=_DISTANCIA_SEDIMENTOS_M,
            con_geometria=True,
        )
    except requests.RequestException:
        return None
    return {
        "total_dentro": 0,
        "dentro": [],
        "cercanas": _cercanas_sedimentos(features, lng, lat),
    }


def consultar(coords: Optional[str]) -> Optional[dict]:
    """Consulta ambas capas para un "lat,lng". Devuelve el dict cacheable
    (concesion/geologia pueden ser None = el punto no cae en ninguna), o
    None si la consulta al catastro falló (no cachear un fallo de red
    como si fuera "sin concesión")."""
    if _DESACTIVADO or not coords:
        return None
    try:
        lat, lng = (float(p.strip()) for p in coords.split(","))
    except (ValueError, AttributeError):
        return None

    resultado: dict = {
        # Versión del formato del caché: subir cuando cambie el shape para
        # que los cachés viejos se reconsulten solos (v4: + geología 50K;
        # v5: anp explícito {zona:"fuera"} en vez de quedar en null;
        # v6: + fallas geológicas cercanas, 50K con reserva a 100K;
        # v7: + sedimentos de quebrada dentro del polígono o cercanas;
        # v8: decode de nombres real (UTF-8 de INGEMMET, ver
        #     `_json_de_respuesta`) — los cachés v7 quedaron con mojibake
        #     ("ProspecciÃ³n GeoquÃ­mica").
        "v": 8,
        "coords": coords,
        "consultado_en": date.today().isoformat(),
        "concesion": None,
        "geologia": None,
        "geologia_50k": None,
        # {"escala": "50k"|"100k", "items": [...]}, o None = no se pudo
        # verificar (distinto de items=[] = se verificó y no hay fallas
        # cerca). Ver _fallas_cercanas.
        "fallas": None,
        # {"total_dentro": N, "dentro": [...], "cercanas": [...]}, o None =
        # no se pudo verificar (distinto de total_dentro=0 = se verificó
        # y no hay muestras dentro). Ver _sedimentos_en_zona.
        "sedimentos": None,
        # Alertas de zona: [{tipo, nombre}] — áreas restringidas de
        # GEOCATMIN + ANP/amortiguamiento de SERNANP. Lista vacía = punto
        # limpio; solo-informativas (el pin es aproximado).
        "restricciones": [],
        "anp": None,
    }

    try:
        feature = _query_punto(
            "SERV_CATASTRO_MINERO_WGS84",
            0,
            lng,
            lat,
            "CODIGOU,CONCESION,TIT_CONCES,HECTAGIS,D_ESTADO,LEYENDA,DEPA,PROVI,DISTRI",
            con_geometria=True,
        )
    except requests.RequestException:
        return None
    if feature:
        attrs = feature.get("attributes") or {}
        resultado["concesion"] = {
            "codigo": attrs.get("CODIGOU"),
            "nombre": attrs.get("CONCESION"),
            "titular": attrs.get("TIT_CONCES"),
            "hectareas": attrs.get("HECTAGIS"),
            "estado": attrs.get("D_ESTADO"),
            "leyenda": attrs.get("LEYENDA"),
            "distrito": attrs.get("DISTRI"),
            # Anillos del polígono en pares [lng, lat] (formato ArcGIS,
            # outSR=4326) — el frontend los dibuja resaltados en el mapa.
            "poligono": (feature.get("geometry") or {}).get("rings"),
        }

    # La geología es el complemento: si falla, se conserva lo demás.
    try:
        feature = _query_punto(
            "SERV_GEOLOGIA_100K_INTEGRADA", 6, lng, lat, "UNIDAD,DESCRIP,NAME"
        )
        if feature:
            attrs = feature.get("attributes") or {}
            resultado["geologia"] = {
                "unidad": attrs.get("UNIDAD"),
                "descripcion": attrs.get("DESCRIP"),
                "codigo": attrs.get("NAME"),
            }
    except requests.RequestException:
        pass

    # Geología 50K (más detalle, solo donde existe carta a esa escala):
    # timeout propio más largo porque el servicio es lento, y best-effort
    # separado — si falla o no hay cobertura, la 100K de arriba ya cubrió
    # el dato base.
    try:
        feature = _query_punto(
            "SERV_GEOLOGIA_50K_INTEGRADA",
            7,
            lng,
            lat,
            "UNIDAD,LITOLOGIA,DESCRIP",
            timeout=_TIMEOUT_50K,
        )
        if feature:
            attrs = feature.get("attributes") or {}
            resultado["geologia_50k"] = {
                "unidad": attrs.get("UNIDAD"),
                "litologia": attrs.get("LITOLOGIA"),
                "descripcion": attrs.get("DESCRIP"),
            }
    except requests.RequestException:
        pass

    # Fallas geológicas cercanas al pin (julio 2026, pedido explícito de
    # Esthiven) — best-effort propio, no tumba el resto si falla.
    resultado["fallas"] = _fallas_cercanas(lng, lat)

    # Sedimentos de quebrada dentro del polígono (o cercanas si no hay
    # dentro) — agosto 2026, pedido explícito de Esthiven. Best-effort
    # propio, no tumba el resto si falla.
    resultado["sedimentos"] = _sedimentos_en_zona(
        lng, lat, (resultado.get("concesion") or {}).get("poligono")
    )

    # Alertas de zona (best-effort por capa: una capa caída no tumba a las
    # demás). Áreas restringidas del propio GEOCATMIN...
    for capa, etiqueta in _CAPAS_RESTRICCION.items():
        try:
            feature = _query_punto("SERV_AREA_RESERVADA", capa, lng, lat, "*")
        except requests.RequestException:
            continue
        if feature:
            resultado["restricciones"].append(
                {"tipo": etiqueta, "nombre": _nombre_de(feature.get("attributes") or {})}
            )

    # ...y las Áreas Naturales Protegidas de SERNANP (dentro de una ANP la
    # minería está prohibida; en zona de amortiguamiento hay condiciones).
    # Si AMBAS consultas responden (aunque no encuentren nada), se deja
    # constancia explícita de "fuera" — antes `anp=None` significaba tanto
    # "no cae en ninguna" como "no se pudo consultar", y la ficha pública
    # se quedaba muda en el caso más común (el punto está limpio) en vez de
    # confirmarlo. `anp=None` ahora es SOLO "no se pudo verificar".
    try:
        feature = _query_punto(
            "peru_sernanp_0102", 0, lng, lat, "*", base=_SERNANP
        )
        if feature:
            attrs = feature.get("attributes") or {}
            resultado["anp"] = {
                "nombre": attrs.get("anp_nomb") or _nombre_de(attrs),
                "categoria": attrs.get("anp_cate"),
                "zona": "dentro",
            }
        else:
            feature = _query_punto(
                "peru_sernanp_0214", 0, lng, lat, "*", base=_SERNANP
            )
            if feature:
                attrs = feature.get("attributes") or {}
                resultado["anp"] = {
                    "nombre": attrs.get("anp_nomb") or _nombre_de(attrs),
                    "categoria": attrs.get("anp_cate"),
                    "zona": "amortiguamiento",
                }
            else:
                resultado["anp"] = {"nombre": None, "categoria": None, "zona": "fuera"}
    except requests.RequestException:
        pass

    return resultado


_ESRI_IMAGERY = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer"
# Misma proporción que el recuadro de portada del PDF (178mm × 62mm ≈
# 2.87:1) — así el recorte "cover" de fotoEnCaja() casi no necesita
# recortar arriba/abajo, y el pin (que se dibuja centrado, ver abajo)
# nunca queda fuera de cuadro (julio 2026, reportado por Esthiven: "se ve
# feo" — el mapa salía en 1200×700 ≈ 1.7:1, mucho más cuadrado que el
# recuadro del PDF, así que el recorte se comía buena parte del mapa).
_ASPECTO_PDF = 178 / 62
_ANCHO_MAPA = 1200
_ALTO_MAPA = round(_ANCHO_MAPA / _ASPECTO_PDF)


def _bbox_de(coords: str, poligono: Optional[list]) -> tuple[float, float, float, float]:
    """xmin, ymin, xmax, ymax en grados — SIEMPRE centrado en el PIN (no en
    el centro de la concesión, que puede quedar lejos del pin dentro de un
    polígono grande) y con la proporción de _ASPECTO_PDF, agrandado lo
    necesario para que la concesión completa quepa si hay polígono. Sin
    polígono, una caja fija de ~1.6km de alto alrededor del pin (similar
    al zoom=14 por defecto del mapa web)."""
    lat, lng = (float(p.strip()) for p in coords.split(","))
    medio_lat = 0.006  # ~650m — caja mínima cuando no hay polígono
    if poligono:
        anillo = poligono[0]
        lngs = [p[0] for p in anillo]
        lats = [p[1] for p in anillo]
        medio_lng_necesario = max(abs(lng - min(lngs)), abs(max(lngs) - lng))
        medio_lat_necesario = max(abs(lat - min(lats)), abs(max(lats) - lat))
        medio_lat = max(medio_lat, medio_lat_necesario, medio_lng_necesario / _ASPECTO_PDF)
    medio_lat *= 1.25  # margen, igual que el pad(0.15/1.1) del mapa interactivo
    medio_lng = medio_lat * _ASPECTO_PDF
    return lng - medio_lng, lat - medio_lat, lng + medio_lng, lat + medio_lat


def _exportar_capa(
    url: str,
    bbox: tuple,
    layers: Optional[str] = None,
    tamano: Optional[tuple[int, int]] = None,
    timeout: int = _TIMEOUT,
) -> Optional["Image.Image"]:
    """Pide una imagen estática a un MapServer de ArcGIS (export) para el
    bbox dado — mismo mecanismo que usan los tiles del mapa interactivo,
    pero server-side (sin problema de CORS: acá no aplica, es una llamada
    HTTP normal, no un <img> de navegador). `tamano`: (ancho,alto) en
    píxeles -- por defecto el lienzo panorámico fijo de la portada; la
    galería de análisis pasa el suyo propio, ajustado al aspecto real del
    polígono (ver `_bbox_y_tamano_ajustado_poligono`). `timeout`: por
    defecto `_TIMEOUT`; las capas 50K pasan `_TIMEOUT_50K` porque el
    servicio es notablemente más lento."""
    from PIL import Image
    from io import BytesIO

    ancho, alto = tamano or (_ANCHO_MAPA, _ALTO_MAPA)
    params = {
        "bbox": ",".join(str(v) for v in bbox),
        "bboxSR": 4326,
        "imageSR": 4326,
        "size": f"{ancho},{alto}",
        "format": "png32",
        "transparent": "true",
        "f": "image",
    }
    if layers:
        params["layers"] = layers
    r = requests.get(f"{url}/export", params=params, timeout=timeout)
    r.raise_for_status()
    return Image.open(BytesIO(r.content)).convert("RGBA")


def resumen_para_ia(cache: Optional[dict]) -> Optional[dict]:
    """Del dict que devuelve `consultar()` (o su versión ya cacheada en la
    operación), arma el resumen de texto -- litología a la mejor escala
    disponible + fallas cercanas -- que interpretacion_ubicacion.py usa
    como contexto YA VERIFICADO (agosto 2026, pedido explícito de
    Esthiven: la interpretación de IA debe cruzar la litología/fallas
    oficiales, no solo las capas de Copernicus). No hace falta que Gemini
    "lea" un mapa para esto -- ya es dato estructurado de GEOCATMIN, así
    que viaja como texto, nunca como imagen. None si no hay nada útil que
    resumir (sin geocatmin consultado todavía, o consulta vacía)."""
    if not isinstance(cache, dict):
        return None
    concesion = cache.get("concesion") or {}
    geologia_50k = cache.get("geologia_50k") or {}
    geologia_100k = cache.get("geologia") or {}
    litologia = None
    escala_litologia = None
    # La 50K es más detallada y SOLO existe donde INGEMMET tiene carta a
    # esa escala (ver geocatmin.consultar) -- se prefiere cuando hay dato,
    # la 100K (cobertura garantizada de todo el país) es el respaldo.
    if geologia_50k.get("litologia") or geologia_50k.get("descripcion"):
        litologia = geologia_50k.get("litologia") or geologia_50k.get("descripcion")
        escala_litologia = "1:50,000"
    elif geologia_100k.get("descripcion"):
        litologia = geologia_100k.get("descripcion")
        escala_litologia = "1:100,000"
    fallas = cache.get("fallas") or {}
    if not (concesion or litologia or fallas.get("escala")):
        return None
    return {
        "concesion_nombre": concesion.get("nombre"),
        "concesion_hectareas": concesion.get("hectareas"),
        "litologia": litologia,
        "escala_litologia": escala_litologia,
        "fallas_escala": fallas.get("escala"),
        "fallas_items": [f["nombre"] for f in fallas.get("items") or [] if f.get("nombre")],
    }


_PRODUCTO_SATELITAL = f"{_BASE}/PRODUCTO_SATELITAL"
# Color poco común en imágenes satelitales/falso-color (que suelen ser
# rojos, verdes, amarillos) -- para que el borde de la concesión se
# distinga siempre del contenido de la capa, sin importar cuál sea.
_COLOR_BORDE_CONCESION = (0, 255, 255, 255)


def _exportar_imagen_server(
    url: str, bbox: tuple, tamano: Optional[tuple[int, int]] = None
) -> Optional["Image.Image"]:
    """Como `_exportar_capa` pero para un ImageServer de ArcGIS (endpoint
    `/exportImage`, sin `layers` -- un ImageServer no tiene capas, es un
    único producto) -- usado para los productos satelitales ya procesados
    de GEOCATMIN (PRODUCTO_SATELITAL/..., ej. ASTER 9-3-1)."""
    from PIL import Image
    from io import BytesIO

    ancho, alto = tamano or (_ANCHO_MAPA, _ALTO_MAPA)
    params = {
        "bbox": ",".join(str(v) for v in bbox),
        "bboxSR": 4326,
        "imageSR": 4326,
        "size": f"{ancho},{alto}",
        "format": "png32",
        "f": "image",
    }
    r = requests.get(f"{url}/exportImage", params=params, timeout=_TIMEOUT)
    r.raise_for_status()
    return Image.open(BytesIO(r.content)).convert("RGBA")


def _con_borde_concesion(
    imagen: "Image.Image", bbox: tuple, poligono: Optional[list]
) -> "Image.Image":
    """Dibuja el contorno (sin relleno) de la concesión sobre una imagen ya
    recortada al bbox -- para que quien mire la imagen (Gemini Vision,
    interpretacion_ubicacion.py) pueda distinguir qué cae DENTRO de la
    concesión de lo que es solo el margen del recorte. Usa el tamaño REAL
    de `imagen` (imagen.size), no un tamaño fijo -- la galería de análisis
    ya no todas miden lo mismo (ver `_bbox_y_tamano_ajustado_poligono`)."""
    if not poligono:
        return imagen
    from PIL import ImageDraw

    xmin, ymin, xmax, ymax = bbox
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
            dibujo.line(puntos + [puntos[0]], fill=_COLOR_BORDE_CONCESION, width=4)
    return imagen


def imagenes_analisis_ia(
    coords: Optional[str], poligono: Optional[list]
) -> Optional[dict[str, bytes]]:
    """ASTER 9-3-1 (para distinguir roca expuesta de vegetación, ya viene
    como foto completa del cuadro) y las Anomalías Espectrales oficiales
    de GEOCATMIN (polígonos dispersos, se componen sobre satélite para que
    tengan contexto geográfico real), ambas recortadas sobre la concesión
    y con su borde dibujado encima -- agosto 2026, pedido explícito de
    Esthiven para que interpretacion_ubicacion.py (Gemini Vision) las
    cruce contra las capas de Copernicus, y para que el PDF de inversión
    las muestre una por una (ver routers/proyectos.py). Mejor esfuerzo,
    igual que el resto del módulo: cada capa que falle simplemente no
    aparece en el dict devuelto, nunca tumba a las demás. None si está
    desactivado, sin coords, o ninguna de las dos capas pudo obtenerse."""
    if _DESACTIVADO or not coords:
        return None
    from io import BytesIO

    try:
        # Ajustado al polígono (no al pin), CON el tamaño de lienzo que le
        # corresponde a su propio aspecto -- ver
        # _bbox_y_tamano_ajustado_poligono.
        bbox, tamano = _bbox_y_tamano_ajustado_poligono(poligono, coords)
        if bbox is None:
            return None
    except (ValueError, AttributeError):
        return None

    resultado: dict[str, bytes] = {}

    try:
        aster = _exportar_imagen_server(
            f"{_PRODUCTO_SATELITAL}/MD_ASTER_931/ImageServer", bbox, tamano
        )
        if aster is not None:
            aster = _con_borde_concesion(aster, bbox, poligono)
            salida = BytesIO()
            aster.save(salida, format="PNG")
            resultado["aster_931"] = salida.getvalue()
    except (requests.RequestException, OSError, ValueError):
        pass

    try:
        # A diferencia de ASTER (una foto que ya cubre todo el cuadro), esta
        # capa es solo polígonos dispersos, transparente en el resto -- se
        # compone sobre satélite (mismo criterio que imagen_mapa_cotejo)
        # para que tenga contexto geográfico real, tanto para quien la mire
        # en el PDF como para Gemini Vision en la interpretación de IA.
        base = _exportar_capa(_ESRI_IMAGERY, bbox, tamano=tamano)
        anomalia = _exportar_capa(
            f"{_BASE}/SERV_ANOMALIA_ESPECTRAL/MapServer", bbox, "show:0", tamano=tamano
        )
        if base is not None and anomalia is not None:
            base.alpha_composite(anomalia)
            base = _con_borde_concesion(base, bbox, poligono)
            salida = BytesIO()
            base.save(salida, format="PNG")
            resultado["anomalia_espectral"] = salida.getvalue()
    except (requests.RequestException, OSError, ValueError):
        pass

    return resultado or None


# Lado mayor del lienzo de la galería de análisis (ASTER, Anomalía
# Espectral, catastro+geología+fallas) -- a diferencia de la portada del
# PDF (_ANCHO_MAPA x _ALTO_MAPA, panorámico fijo, para calzar en el
# recuadro de portada), acá el lienzo se genera al ASPECTO REAL del
# polígono en vez de forzarlo al panorámico -- ver
# _bbox_y_tamano_ajustado_poligono. `_LADO_ANALISIS_MIN` evita un lienzo
# demasiado angosto si la concesión es muy alargada en una sola dirección.
_LADO_ANALISIS = 1000
_LADO_ANALISIS_MIN = 480


# Cuánto más ancho que la concesión sale el cuadro de las imágenes de
# análisis. 2.5 = la concesión ocupa ~40% del ancho y queda rodeada de
# terreno visible (agosto 2026, pedido explícito: "que capte el total del
# polígono... y unos menos más lejos para que se vea bien" — con el 1.12
# de la primera versión el polígono llegaba casi al borde del cuadro y no
# se veía dónde está parado dentro del paisaje; se probó en vivo a 1.8 y
# 2.1, y Esthiven cerró en 2.5). Tope práctico: pasando
# de ~3 se pierde detalle DENTRO de la concesión, que es lo que de verdad
# importa (el lienzo tiene los mismos píxeles repartidos en más terreno).
_MARGEN_ANALISIS = 2.5


def _bbox_y_tamano_ajustado_poligono(
    poligono: Optional[list],
    coords: Optional[str] = None,
    margen: float = _MARGEN_ANALISIS,
) -> tuple[Optional[tuple[float, float, float, float]], Optional[tuple[int, int]]]:
    """Bbox centrado en el PROPIO POLÍGONO (no en el pin, a diferencia de
    `_bbox_de`) Y el tamaño de lienzo (ancho,alto en píxeles) que le
    corresponde a SU PROPIO aspecto -- agosto 2026, segunda corrección
    tras un reporte en vivo: la primera versión (`_bbox_ajustado_poligono`,
    ya centraba en el polígono pero mantenía el aspecto panorámico fijo
    _ASPECTO_PDF de la portada) dejaba la concesión bien centrada pero con
    mucho margen vacío a los costados cuando el polígono es más angosto
    que ese panorama -- comparado en vivo contra las capas de Copernicus
    (que sí llenan el cuadro, porque su bbox es el exacto del polígono
    sobre un lienzo cuadrado): "no está centrando bien... quiero que sea
    igual que el de Anomalías Espectrales... en esa escala". Generar el
    lienzo AL aspecto del bbox (en vez de forzar el bbox al aspecto del
    lienzo) hace que la concesión llene el cuadro completo sin distorsión,
    sea cual sea su forma. Sin polígono, cae a una caja fija chica y
    cuadrada alrededor del pin. Devuelve (None, None) si no hay ni
    polígono ni coords."""
    if poligono and poligono[0]:
        anillo = poligono[0]
        lngs = [p[0] for p in anillo]
        lats = [p[1] for p in anillo]
        cx, cy = (min(lngs) + max(lngs)) / 2, (min(lats) + max(lats)) / 2
        medio_lng = max((max(lngs) - min(lngs)) / 2, 0.0008)
        medio_lat = max((max(lats) - min(lats)) / 2, 0.0008)
    elif coords:
        lat, lng = (float(p.strip()) for p in coords.split(","))
        cx, cy, medio_lng, medio_lat = lng, lat, 0.006, 0.006
    else:
        return None, None
    medio_lng *= margen
    medio_lat *= margen
    bbox = (cx - medio_lng, cy - medio_lat, cx + medio_lng, cy + medio_lat)

    aspecto = medio_lng / medio_lat
    if aspecto >= 1:
        ancho, alto = _LADO_ANALISIS, round(_LADO_ANALISIS / aspecto)
    else:
        ancho, alto = round(_LADO_ANALISIS * aspecto), _LADO_ANALISIS
    return bbox, (max(ancho, _LADO_ANALISIS_MIN), max(alto, _LADO_ANALISIS_MIN))


def imagen_mapa_cotejo(
    coords: Optional[str],
    poligono: Optional[list],
    escala_fallas: Optional[str] = None,
    bbox_fijo: Optional[tuple] = None,
    tamano_fijo: Optional[tuple[int, int]] = None,
    con_borde: bool = False,
) -> Optional[bytes]:
    """Compone satélite (Esri) + geología 100K + fallas cercanas (si hay) +
    catastro minero + el pin de la operación en una sola imagen JPEG —
    usada como portada del PDF (pedido explícito de Esthiven: "la imagen
    inicial debe ser la de ubicación con catastro y mapa geológico", julio
    2026). `escala_fallas`: "50k"|"100k"|None — mismo criterio que el mapa
    interactivo (MapaGeocatmin.tsx): None si no hay ninguna falla cerca
    que dibujar. `bbox_fijo`/`tamano_fijo`: si se pasan, se usan tal cual
    en vez de `_bbox_de`/el lienzo panorámico fijo -- lo usa
    `imagen_analisis_catastro` para reusar toda esta composición con el
    bbox y el lienzo ajustados al polígono en vez del panorámico de
    portada (ver `_bbox_y_tamano_ajustado_poligono`). Best-effort: si
    cualquier capa falla, devuelve None y el caller usa la foto normal del
    minero como portada en su lugar — nunca rompe la descarga del PDF."""
    if _DESACTIVADO or not coords:
        return None
    from PIL import Image, ImageDraw
    from io import BytesIO

    try:
        bbox = bbox_fijo or _bbox_de(coords, poligono)
        tamano = tamano_fijo or (_ANCHO_MAPA, _ALTO_MAPA)
        base = _exportar_capa(_ESRI_IMAGERY, bbox, tamano=tamano)
        if base is None:
            return None
        try:
            geologia = _exportar_capa(
                f"{_BASE}/SERV_GEOLOGIA_100K_INTEGRADA/MapServer", bbox, "show:6", tamano=tamano
            )
            if geologia is not None:
                r, g, b, a = geologia.split()
                # 40% de opacidad — un poco más marcada que el 25% en
                # reposo del mapa web, porque acá no hay hover para subirla.
                a = a.point(lambda p: int(p * 0.4))
                geologia.putalpha(a)
                base.alpha_composite(geologia)
        except requests.RequestException:
            pass
        if escala_fallas:
            try:
                servicio, capa, _campos = _CAPA_FALLAS_POR_ESCALA[escala_fallas]
                fallas = _exportar_capa(
                    f"{_BASE}/{servicio}/MapServer", bbox, f"show:{capa}", tamano=tamano
                )
                if fallas is not None:
                    base.alpha_composite(fallas)
            except requests.RequestException:
                pass
        try:
            catastro = _exportar_capa(
                f"{_BASE}/SERV_CATASTRO_MINERO_WGS84/MapServer", bbox, "show:0", tamano=tamano
            )
            if catastro is not None:
                base.alpha_composite(catastro)
        except requests.RequestException:
            pass

        # Borde cian de LA concesión de este proyecto (agosto 2026, pedido
        # explícito: "tienen que salir en todas las capas el polígono de
        # concesión"). La capa de catastro de INGEMMET dibuja TODAS las
        # concesiones de la zona con el mismo contorno azul -- sin esto no
        # había forma de saber cuál de todas es la del proyecto. Va antes
        # del pin para que el pin quede siempre encima.
        if con_borde:
            base = _con_borde_concesion(base, bbox, poligono)

        # Pin de la operación — interpolación lineal simple (bboxSR e
        # imageSR son ambos 4326, sin proyección de por medio).
        lat, lng = (float(p.strip()) for p in coords.split(","))
        xmin, ymin, xmax, ymax = bbox
        ancho, alto = tamano
        px = int((lng - xmin) / (xmax - xmin) * ancho)
        py = int((ymax - lat) / (ymax - ymin) * alto)
        dibujo = ImageDraw.Draw(base)
        radio = 9
        dibujo.ellipse(
            [px - radio, py - radio, px + radio, py + radio],
            fill=(225, 29, 72, 255),
            outline=(255, 255, 255, 255),
            width=3,
        )

        salida = BytesIO()
        base.convert("RGB").save(salida, format="JPEG", quality=87)
        return salida.getvalue()
    except (requests.RequestException, OSError, ValueError):
        return None


# Catálogo de capas individuales para la vista 3D (Mapa3D.tsx) — espejo de
# las capas que el mapa 2D (MapaGeocatmin.tsx) expone en su panel "Capas",
# para que el catálogo de la ficha sea el mismo en ambas vistas. Cada
# entrada: (servicio ArcGIS, `layers` de export). Mismo criterio de
# servicio/capa que los dynamicMapLayer/imageMapLayer del 2D.
_CAPAS_OVERLAY_3D = {
    "catastro": ("SERV_CATASTRO_MINERO_WGS84/MapServer", "show:0"),
    "geologia": ("SERV_GEOLOGIA_100K_INTEGRADA/MapServer", "show:6"),
    # Geología 1:50,000 (Litología) — espejo de la capa geologia50 del mapa
    # 2D (agosto 2026): SOLO donde INGEMMET tiene carta a esa escala, y la
    # vista 3D solo la pide dentro de la zona acotada (el frontend decide
    # por zoom/cámara cuál de las dos usa). Se exporta sobre el MISMO bbox
    # que geologia; donde no hay cobertura 50K el PNG sale transparente.
    "geologia_50k": ("SERV_GEOLOGIA_50K_INTEGRADA/MapServer", "show:7"),
    "aster_931": ("PRODUCTO_SATELITAL/MD_ASTER_931/ImageServer", None),
    "qicimi": ("PRODUCTO_SATELITAL/MD_QICIMI/ImageServer", None),
    "anomalia_espectral": ("SERV_ANOMALIA_ESPECTRAL/MapServer", "show:0"),
    "libre_denuncio": ("SERV_LIBREDENUNCIABILIDAD/MapServer", "show:0"),
    # Sedimentos de quebrada (geoquímica INGEMMET) — espejo de la capa
    # sedimentos_quebrada del mapa 2D (agosto 2026): se exporta con la
    # simbología por defecto del propio servicio, igual que el 2D la pide
    # como imagen (`f:"image"`). La ficha además ya lista las muestras
    # dentro del polígono / cercanas (ver consultar()).
    "sedimentos_quebrada": ("SERV_GEOQUIMICA_2022/MapServer", "show:0"),
}


def capa_overlay_3d(
    coords: Optional[str],
    poligono: Optional[list],
    capa: str,
    escala_fallas: Optional[str] = None,
) -> Optional[bytes]:
    """UNA capa de GEOCATMIN en PNG TRANSPARENTE, sobre el MISMO bbox
    ajustado al polígono que la galería de análisis
    (`_bbox_y_tamano_ajustado_poligono`) — para que la vista 3D de MapLibre
    (Mapa3D.tsx) replique el catálogo de capas del mapa 2D, superponiendo
    cada capa por separado sobre el terreno (MapLibre aplica la opacidad de
    cada capa por su cuenta vía `raster-opacity`, así que acá se exporta
    opacidad plena). `capa` ∈ catastro | geologia | geologia_50k | fallas |
    aster_931 | qicimi | anomalia_espectral | libre_denuncio |
    sedimentos_quebrada; "fallas"
    necesita `escala_fallas` (mismo criterio que el mapa 2D: solo se ofrece
    si de verdad hay una falla confirmada); "geologia_50k" se genera con
    el timeout propio de la 50K (`_TIMEOUT_50K`, servicio lento) y el
    frontend decide por cámara si usarla. Se genera al vuelo en cada pedido
    (llamadas gratis a ArcGIS) y el navegador lo cachea 24h. Best-effort:
    None si la capa no existe o falló (la vista 3D sigue con satélite +
    polígono)."""
    if _DESACTIVADO or not coords:
        return None
    if capa == "fallas":
        if not escala_fallas:
            return None
        servicio, layer, _campos = _CAPA_FALLAS_POR_ESCALA[escala_fallas]
        url = f"{_BASE}/{servicio}/MapServer"
        layers = f"show:{layer}"
    elif capa in _CAPAS_OVERLAY_3D:
        servicio, layers = _CAPAS_OVERLAY_3D[capa]
        url = f"{_BASE}/{servicio}"
    else:
        return None
    bbox, tamano = _bbox_y_tamano_ajustado_poligono(poligono, coords)
    if bbox is None:
        return None
    try:
        from io import BytesIO

        # La 50K es lenta (hasta ~25s verificado) — solo para ella se pasa
        # el timeout propio; el resto usa el default de `_exportar_capa`.
        kwargs = {"timeout": _TIMEOUT_50K} if capa == "geologia_50k" else {}
        imagen = _exportar_capa(url, bbox, layers, tamano=tamano, **kwargs)
        if imagen is None:
            return None
        salida = BytesIO()
        imagen.save(salida, format="PNG")
        return salida.getvalue()
    except (requests.RequestException, OSError, ValueError):
        return None


def imagen_analisis_catastro(
    coords: Optional[str], poligono: Optional[list], escala_fallas: Optional[str] = None
) -> Optional[bytes]:
    """La capa "Catastro, geología y fallas" de la galería de análisis
    satelital del PDF (agosto 2026) -- reusa toda la composición de
    `imagen_mapa_cotejo` (mismas 4 capas + pin) pero con el bbox Y el
    lienzo ajustados al aspecto real del polígono
    (`_bbox_y_tamano_ajustado_poligono`) en vez del panorámico
    centrado-en-el-pin que sí necesita la portada. Antes esta capa de la
    galería reusaba directamente la imagen de portada -- reportado en
    vivo con captura real que la concesión aparecía como un recuadro
    chico perdido en una esquina."""
    if _DESACTIVADO or not coords:
        return None
    bbox, tamano = _bbox_y_tamano_ajustado_poligono(poligono, coords)
    if bbox is None:
        return None
    return imagen_mapa_cotejo(
        coords,
        poligono,
        escala_fallas,
        bbox_fijo=bbox,
        tamano_fijo=tamano,
        # A diferencia de la portada, esta va en la galería junto a las otras
        # 8 capas -- todas llevan el mismo borde cian de la concesión.
        con_borde=True,
    )

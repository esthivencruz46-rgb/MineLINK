"""Consulta GEOCATMIN (INGEMMET) por punto: con las coordenadas del pin
que el minero declaró, trae datos OFICIALES de registros públicos:

- Catastro minero (SERV_CATASTRO_MINERO_WGS84, capa 0): la concesión en
  la que cae el punto — nombre, código único, titular registrado, estado
  (titulado / en trámite / extinguido) y hectáreas.
- Geología integrada 100K (SERV_GEOLOGIA_100K_INTEGRADA, capa 6): la
  unidad geológica y su litología en el punto.

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

import os
from datetime import date
from typing import Optional

import requests

# Los tests lo desactivan para no hacer llamadas externas reales.
_DESACTIVADO = os.environ.get("MINELINK_GEOCATMIN") == "0"

_BASE = "https://geocatmin.ingemmet.gob.pe/arcgis/rest/services"
_TIMEOUT = 12

# Cada cuántos días se vuelve a consultar aunque el pin no haya cambiado.
DIAS_REFRESCO = 30


def _query_punto(
    servicio: str,
    capa: int,
    lng: float,
    lat: float,
    out_fields: str,
    con_geometria: bool = False,
) -> Optional[dict]:
    """Primer polígono que contiene el punto ({attributes, geometry}), o None."""
    r = requests.get(
        f"{_BASE}/{servicio}/MapServer/{capa}/query",
        params={
            "geometry": '{"x":%s,"y":%s,"spatialReference":{"wkid":4326}}' % (lng, lat),
            "geometryType": "esriGeometryPoint",
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": out_fields,
            "returnGeometry": "true" if con_geometria else "false",
            "outSR": 4326,
            "f": "json",
        },
        timeout=_TIMEOUT,
    )
    r.raise_for_status()
    features = r.json().get("features") or []
    return features[0] if features else None


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
        # que los cachés viejos (sin polígono) se reconsulten solos.
        "v": 2,
        "coords": coords,
        "consultado_en": date.today().isoformat(),
        "concesion": None,
        "geologia": None,
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

    return resultado

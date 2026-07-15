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
# SERNANP publica sus ANP en su propio ArcGIS (verificado julio 2026):
# capa 0102/0 = ANP de administración nacional; 0214/0 = zonas de
# amortiguamiento. Campos: anp_nomb, anp_cate.
_SERNANP = "https://geoservicios.sernanp.gob.pe/arcgis/rest/services/servicios_ogc"
_TIMEOUT = 12
# La 50K es notablemente más lenta que el resto (verificado: hasta ~25s en
# algunas zonas) — se le da más margen porque es best-effort y el
# resultado queda cacheado 30 días, así que un primer load lento es
# aceptable a cambio de no perder el dato cuando sí existe.
_TIMEOUT_50K = 25

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
        # que los cachés viejos se reconsulten solos (v4: + geología 50K).
        "v": 4,
        "coords": coords,
        "consultado_en": date.today().isoformat(),
        "concesion": None,
        "geologia": None,
        "geologia_50k": None,
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
    except requests.RequestException:
        pass

    return resultado

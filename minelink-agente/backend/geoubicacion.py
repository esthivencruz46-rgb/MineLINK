"""Convierte un enlace de Google Maps (incluidos los cortos tipo
maps.app.goo.gl) en coordenadas "lat,lng", para poder incrustar un mapa
interactivo en la ficha pública del proyecto.

Es "best effort": si el enlace no se puede resolver (sin internet, formato
raro), devuelve None y la ficha simplemente muestra el botón de Maps sin
mapa incrustado. Nunca lanza excepción hacia el caller.
"""

import os
import re
import urllib.parse
from typing import Optional

import requests

# Los tests lo desactivan para no hacer llamadas externas reales.
_DESACTIVADO = os.environ.get("MINELINK_RESOLVER_MAPS") == "0"

# Validación de HOST real, no substring (hallazgo de auditoría, agosto
# 2026): con el substring "google.com/maps" se colaba un enlace tipo
# `https://google.com/maps@169.254.169.254/` (userinfo: el host real es la
# IP interna) o `https://maps.google.com.evil.com/` (host falso), y
# resolver_coordenadas hacía requests.get() con redirects contra ese host
# (SSRF ciego: escaneo de la red interna de Render). Solo se permite el
# host literal de Google Maps / goo.gl y sus subdominios.
_HOSTS_MAPS_PERMITIDOS_SUFIJO = (".google.com", ".goo.gl")
_HOSTS_MAPS_PERMITIDOS_EXACTOS = ("google.com", "goo.gl")


def es_enlace_google_maps_valido(enlace: str) -> bool:
    try:
        partes = urllib.parse.urlparse(enlace)
    except ValueError:
        return False
    if partes.scheme not in ("http", "https"):
        return False
    if partes.username or partes.password:
        return False
    host = (partes.hostname or "").lower().rstrip(".")
    return host in _HOSTS_MAPS_PERMITIDOS_EXACTOS or host.endswith(
        _HOSTS_MAPS_PERMITIDOS_SUFIJO
    )

# ORDEN IMPORTANTE: !3d!4d es el PIN real que marcó la persona; @lat,lng es
# solo el centro de la vista al momento de compartir (puede estar muy lejos
# del pin si el mapa estaba alejado) — se usa únicamente como último recurso.
_PATRONES = [
    re.compile(r"!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)"),      # pin real: ...!3d-11.5!4d-76.2...
    re.compile(r"[?&]q(?:uery)?=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)"),  # ?q=-11.5,-76.2
    # Formato nuevo de los enlaces cortos compartidos desde la app (2026):
    # google.com/maps/search/-11.965602,+-77.094409 — las coordenadas del
    # pin van en la RUTA (el "+" es un espacio URL-encodeado).
    re.compile(r"/maps/(?:search|place)/(-?\d{1,2}\.\d+),\s*\+?(-?\d{1,3}\.\d+)"),
    re.compile(r"@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)"),          # centro de vista (último recurso)
]


def _extraer(url: str) -> Optional[str]:
    for patron in _PATRONES:
        m = patron.search(url)
        if m:
            return f"{m.group(1)},{m.group(2)}"
    return None


def resolver_coordenadas(enlace_maps: Optional[str]) -> Optional[str]:
    if not enlace_maps or _DESACTIVADO:
        return None

    enlace = enlace_maps.strip()
    # Nunca hacer requests.get() contra un host que no sea Google Maps —
    # validar el HOST antes de seguir (defensa en profundidad, además del
    # validador de schemas.py; los seeds leen valores viejos de la BD).
    if not es_enlace_google_maps_valido(enlace):
        return None

    # 1) A veces el enlace ya trae las coordenadas
    coords = _extraer(enlace)
    if coords:
        return coords

    # 2) Enlaces cortos (maps.app.goo.gl): seguir la redirección para
    #    llegar a la URL completa, que sí trae coordenadas. Con User-Agent
    #    de navegador: al python-requests "pelado" Google a veces le
    #    responde una página de consentimiento sin coordenadas y el enlace
    #    quedaba guardado sin mapa (julio 2026).
    #
    #    Los redirects se siguen A MANO (allow_redirects=False) y el host de
    #    CADA salto se re-valida (hallazgo de auditoría, agosto 2026): con
    #    allow_redirects=True, un shortlink goo.gl apuntando a un host
    #    interno habría pasado la validación inicial y requests habría ido
    #    a ese host (SSRF ciego por redirect).
    url_actual = enlace
    for _ in range(5):
        try:
            r = requests.get(
                url_actual,
                allow_redirects=False,
                timeout=10,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
                    ),
                    "Accept-Language": "es-PE,es;q=0.9",
                },
            )
        except requests.RequestException:
            return None
        if r.is_redirect or r.is_permanent_redirect:
            destino = r.headers.get("Location")
            if not destino or not es_enlace_google_maps_valido(
                urllib.parse.urljoin(url_actual, destino)
            ):
                return None
            url_actual = urllib.parse.urljoin(url_actual, destino)
            continue
        return _extraer(r.url) or _extraer(r.text[:200000])
    return None

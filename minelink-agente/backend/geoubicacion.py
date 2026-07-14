"""Convierte un enlace de Google Maps (incluidos los cortos tipo
maps.app.goo.gl) en coordenadas "lat,lng", para poder incrustar un mapa
interactivo en la ficha pública del proyecto.

Es "best effort": si el enlace no se puede resolver (sin internet, formato
raro), devuelve None y la ficha simplemente muestra el botón de Maps sin
mapa incrustado. Nunca lanza excepción hacia el caller.
"""

import os
import re
from typing import Optional

import requests

# Los tests lo desactivan para no hacer llamadas externas reales.
_DESACTIVADO = os.environ.get("MINELINK_RESOLVER_MAPS") == "0"

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

    # 1) A veces el enlace ya trae las coordenadas
    coords = _extraer(enlace_maps)
    if coords:
        return coords

    # 2) Enlaces cortos (maps.app.goo.gl): seguir la redirección para
    #    llegar a la URL completa, que sí trae coordenadas. Con User-Agent
    #    de navegador: al python-requests "pelado" Google a veces le
    #    responde una página de consentimiento sin coordenadas y el enlace
    #    quedaba guardado sin mapa (julio 2026).
    try:
        r = requests.get(
            enlace_maps,
            allow_redirects=True,
            timeout=10,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
                ),
                "Accept-Language": "es-PE,es;q=0.9",
            },
        )
        return _extraer(r.url) or _extraer(r.text[:200000])
    except requests.RequestException:
        return None

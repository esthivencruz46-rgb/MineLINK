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
    #    llegar a la URL completa, que sí trae coordenadas
    try:
        r = requests.get(enlace_maps, allow_redirects=True, timeout=10)
        return _extraer(r.url) or _extraer(r.text[:200000])
    except requests.RequestException:
        return None

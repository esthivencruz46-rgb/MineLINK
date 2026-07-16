"""Verificación automática del código REINFO contra el buscador oficial
del MINEM (pad.minem.gob.pe/REINFO_WEB) — el mismo que Esthiven consultaba
a mano. MINEM no tiene API pública: es un WebForms clásico, así que se
simula el postback (GET para los campos ocultos __VIEWSTATE, POST con el
código en "Código Derecho" y listado "Todas" para atrapar también los
suspendidos).

Best-effort como todos los servicios externos: si MINEM no responde o
cambió el HTML, devuelve None y el caller conserva lo último cacheado —
nunca rompe una lectura. El resultado se cachea en la operación (ver
routers/proyectos.py) porque el padrón cambia poco.

El estado devuelto es el del padrón (VIGENTE / SUSPENDIDO) o
"no_encontrado" si el código no existe — este último SÍ es cacheable
(no es un fallo de red, es la respuesta real del padrón).
"""

import os
import re
from datetime import date
from typing import Optional

import requests

# Confirmado (julio 2026, sesión de trazado con navegador real) que
# `requests` NO dispara el evento onchange/blur que el WebForms del MINEM
# necesita antes del postback de búsqueda: toda consulta CON código o RUC
# vuelve "no_encontrado" aunque el código sea real y esté vigente — un falso
# negativo, peor que no mostrar nada. Mientras no se reemplace por un
# navegador real (Playwright, más pesado — decisión pendiente de Esthiven),
# queda DESACTIVADO por defecto; Esthiven verifica el código a mano y lo
# marca en el admin (Operacion.reinfo_verificado_manual). Activar de nuevo
# con MINELINK_REINFO=1 si se reemplaza el mecanismo.
_DESACTIVADO = os.environ.get("MINELINK_REINFO") != "1"

_URL = "https://pad.minem.gob.pe/REINFO_WEB/Index.aspx"
_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
_TIMEOUT = 25

# Cada cuántos días se vuelve a consultar el mismo código.
DIAS_REFRESCO = 7


def consultar_reinfo(codigo: Optional[str]) -> Optional[dict]:
    """Busca el código de derecho minero en el padrón REINFO. Devuelve
    {codigo, consultado_en, estado, declarante, derecho, distrito} o None
    si la consulta falló (no cachear un fallo de red)."""
    if _DESACTIVADO or not codigo or not codigo.strip():
        return None
    codigo = codigo.strip()

    try:
        s = requests.Session()
        r = s.get(_URL, headers=_HEADERS, timeout=_TIMEOUT)
        r.raise_for_status()
        ocultos = dict(
            re.findall(r'<input type="hidden" name="([^"]+)"[^>]*? value="([^"]*)"', r.text)
        )
        data = dict(ocultos)
        data.update(
            {
                "txtpagina": "1",
                "txttotal": "0",
                "txtruc": "",
                "txtdeclarante": "",
                "txtidunidad": codigo,
                "txtnomderecho": "",
                "ddllistado": "9",  # Todas (vigentes + suspendidos)
                "ddltipersona": "99",
                "ddldepartamento": "0",
                "ddlprovincia": "0",
                "ddldistrito": "0",
                "ddlordenado": "0",
                "ddlforma": "0",
                "btnBuscar": "Buscar",
            }
        )
        r2 = s.post(_URL, data=data, headers=_HEADERS, timeout=_TIMEOUT)
        r2.raise_for_status()
    except requests.RequestException:
        return None

    resultado: dict = {
        # Versión del formato del caché: subir cuando cambie el shape para
        # que los cachés viejos se reconsulten solos (v2: + ruc/dpto/provincia).
        "v": 2,
        "codigo": codigo,
        "consultado_en": date.today().isoformat(),
        "estado": "no_encontrado",
        "declarante": None,
        "derecho": None,
        "distrito": None,
        # Datos adicionales del padrón (julio 2026, a pedido de Esthiven):
        # el mismo Código Único ya trae el RUC del declarante y su
        # ubicación completa — antes se leían del grid y se descartaban.
        "ruc": None,
        "departamento": None,
        "provincia": None,
    }
    # Filas del grid: [n, RUC, declarante, código derecho, nombre derecho,
    # dpto, provincia, distrito, ESTADO]
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", r2.text, re.S):
        tds = [
            re.sub(r"<[^>]+>", "", c).strip()
            for c in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)
        ]
        if len(tds) >= 9 and tds[3] == codigo:
            resultado.update(
                {
                    "estado": tds[8].upper() or "no_encontrado",
                    "ruc": tds[1] or None,
                    "declarante": tds[2] or None,
                    "derecho": tds[4] or None,
                    "departamento": tds[5] or None,
                    "provincia": tds[6] or None,
                    "distrito": tds[7] or None,
                }
            )
            break
    return resultado

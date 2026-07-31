"""Interpretación en lenguaje natural de las capas de anomalías espectrales
de Copernicus (julio 2026, pedido explícito de Esthiven, "para mi propio
uso"): las 6 imágenes que genera copernicus.py son manchas de color sin
ningún texto ni cifra detrás. A diferencia de GEOCATMIN (catastro,
geología, fallas), que YA llega como datos estructurados y el backend ya
arma en texto exacto sin que nadie tenga que "mirar" una imagen, acá sí
hace falta: alguien (o algo) tiene que leer el mapa de colores y decir
qué significa. Por eso este módulo interpreta SOLO las capas de
Copernicus — catastro/geología/fallas se quedan como texto ya generado,
sin tocar (decisión explícita, julio 2026).

Usa Gemini (mismo proveedor y misma API key que asesor.py, GEMINI_API_KEY
— el único de los proveedores ya conectados con soporte real de imágenes
en su nivel gratis) con las 6 PNG de copernicus.generar_capas() como
entrada visual + mineral/región del proyecto como contexto de texto. No
reutiliza la cadena de respaldo entre proveedores de asesor.py (pensada
para texto puro) porque hoy solo Gemini está confirmado con capacidad de
visión — evita construir una abstracción multi-proveedor para una sola
implementación real.

Reglas duras del prompt (acordadas con Esthiven, julio 2026): nunca
afirma presencia de mineral ni ley (solo "señal a investigar"), nunca
hace una clasificación fina de alteración hidrotermal (propilítica/
argílica/filítica — Sentinel-2 no tiene las bandas SWIR para eso, mismo
límite ya documentado en copernicus.py), siempre en tono de hipótesis a
verificar en campo. Si "coincidencias" tiene algo pintado, se le pide
destacarlo explícitamente — es la señal más fuerte de las 6 (2+ índices
independientes de acuerdo en el mismo píxel).

Solo para uso del admin (decisión explícita, julio 2026) — NO se muestra
en la ficha pública ni en el PDF que descarga un inversionista. Si algún
día eso cambia, el disclaimer tendría que ser mucho más visible que hoy
(letra chica no alcanza para algo que puede sonar a "hay mineral acá").

DESACTIVADO por defecto, activar con
MINELINK_INTERPRETACION_UBICACION=1 (además de MINELINK_COPERNICUS=1,
del que depende — sin capas que interpretar no hay nada que hacer) —
llamada extra a Gemini con imágenes (más cara que una pregunta de texto
del asesor), mejor que se prenda a propósito una vez que Esthiven
confirme que la calidad de la interpretación le sirve.

Mismo patrón "mejor esfuerzo" que geocatmin.py/copernicus.py: cualquier
fallo (sin API key, cuota agotada, error de red) devuelve None y el
caller conserva lo último cacheado — nunca rompe nada."""
import base64
import os

import requests

_DESACTIVADO = os.environ.get("MINELINK_INTERPRETACION_UBICACION") != "1"

_MODELO = os.environ.get("MINELINK_INTERPRETACION_MODELO", "gemini-3.5-flash-lite")
# Tiene que mandar y procesar 6 imágenes -- más lento que una pregunta de
# texto del asesor (8s ahí), pero esto corre en un BackgroundTask, nunca
# bloqueando una visita real a la ficha (ver routers/proyectos.py).
_TIMEOUT = 25

_TITULOS_CAPAS = {
    "oxidos_de_hierro": "Óxidos de hierro",
    "arcillas": "Arcillas",
    "hierro_ferroso": "Hierro ferroso",
    "arcilla_sulfatos_mica": "Arcilla / sulfatos / mica",
    "combinado": "Combinado (las 4 anteriores superpuestas)",
    "coincidencias": "Coincidencias (zonas donde 2 o más índices están de acuerdo)",
}

_SYSTEM = """Eres un asistente que ayuda a un operador de una plataforma minera peruana \
a interpretar mapas de anomalías espectrales generados con imágenes satelitales \
Sentinel-2, para uso INTERNO (nunca se muestra tal cual a un inversionista).

Te doy varias imágenes superpuestas sobre el mismo mapa de una concesión minera. \
Cada una es TRANSPARENTE salvo donde el índice correspondiente detectó una anomalía \
(el 10% más alto de ese índice dentro de la concesión) -- las zonas de color son lo \
único que importa, el resto de cada imagen no tiene información.

Reglas que debes seguir siempre, sin excepción:
1. Nunca afirmes que hay un mineral presente, ni des una ley o cantidad -- solo "zona \
candidata a revisar" o "señal a investigar con muestreo en campo", nunca un hallazgo \
confirmado.
2. Nunca hagas una clasificación fina de alteración hidrotermal (propilítica, \
argílica, filítica) -- Sentinel-2 no tiene las bandas necesarias para eso. Usa \
únicamente los nombres de índice tal como te los doy.
3. Si "Coincidencias" tiene algo pintado, dedícale una mención explícita -- ahí 2 o \
más índices independientes coinciden en el mismo punto, es la señal más fuerte de \
todas.
4. Si una capa sale prácticamente vacía, dilo así ("sin anomalía relevante en X") en \
vez de forzar una lectura interesante donde no la hay.
5. Responde en español, en un solo párrafo de 3 a 5 oraciones, tono profesional y \
directo, sin adjetivos de venta."""


def _imagen_a_parte(contenido: bytes) -> dict:
    return {
        "inlineData": {
            "mimeType": "image/png",
            "data": base64.b64encode(contenido).decode("ascii"),
        }
    }


def generar_interpretacion(
    capas: dict[str, bytes], mineral: str, region: str
) -> str | None:
    """`capas`: mismo dict que devuelve copernicus.generar_capas()["capas"]
    (nombre de índice -> bytes PNG). None si está desactivado, falta la
    API key, no hay capas, o falla la llamada (mejor esfuerzo)."""
    if _DESACTIVADO or not capas:
        return None
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None

    partes: list[dict] = [
        {
            "text": (
                f"Proyecto minero de {mineral or 'mineral no especificado'} en "
                f"{region or 'región no especificada'}, Perú. A continuación, las "
                f"capas de anomalías espectrales sobre su concesión:"
            )
        }
    ]
    for nombre, contenido in capas.items():
        partes.append({"text": f"{_TITULOS_CAPAS.get(nombre, nombre)}:"})
        partes.append(_imagen_a_parte(contenido))

    try:
        resp = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{_MODELO}:generateContent",
            params={"key": api_key},
            json={
                "systemInstruction": {"parts": [{"text": _SYSTEM}]},
                "contents": [{"role": "user", "parts": partes}],
            },
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        texto = "".join(
            p.get("text", "") for p in data["candidates"][0]["content"]["parts"]
        )
        return texto.strip() or None
    except (requests.RequestException, KeyError, IndexError, ValueError):
        return None

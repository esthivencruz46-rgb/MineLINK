"""Interpretación en lenguaje natural de la información de ubicación de una
concesión (julio 2026, pedido explícito de Esthiven, "para mi propio
uso"; ampliado agosto 2026 -- ver más abajo). Las 6 imágenes que genera
copernicus.py son manchas de color sin ningún texto ni cifra detrás:
alguien (o algo) tiene que leer el mapa de colores y decir qué significa.

Ampliado agosto 2026 (pedido explícito de Esthiven, con la metodología de
análisis que él mismo definió) para cruzar TRES fuentes más, no solo
Copernicus:
1. Litología y fallas geológicas de GEOCATMIN -- estos SÍ llegan ya como
   datos estructurados (geocatmin.resumen_para_ia), así que viajan como
   TEXTO, nunca como imagen para "leer".
2. ASTER 9-3-1 de GEOCATMIN (imagen) -- para distinguir roca expuesta de
   vegetación: una anomalía espectral sobre roca expuesta es una señal
   más confiable que la misma anomalía sobre vegetación (el follaje
   contamina la lectura del suelo).
3. La capa oficial de Anomalías Espectrales de GEOCATMIN (imagen,
   polígonos ya clasificados por INGEMMET) -- para decir si algo de eso
   cae dentro de la concesión, además de lo que ya calcula Copernicus.

Usa Gemini (mismo proveedor y misma API key que asesor.py, GEMINI_API_KEY
— el único de los proveedores ya conectados con soporte real de imágenes
en su nivel gratis) con las imágenes de copernicus.generar_capas() +
geocatmin.imagenes_analisis_ia() como entrada visual, más el texto de
geocatmin.resumen_para_ia() y mineral/región del proyecto como contexto.
No reutiliza la cadena de respaldo entre proveedores de asesor.py
(pensada para texto puro) porque hoy solo Gemini está confirmado con
capacidad de visión — evita construir una abstracción multi-proveedor
para una sola implementación real.

Reglas duras del prompt (acordadas con Esthiven): nunca afirma presencia
de mineral ni ley (solo "señal a investigar"), nunca hace una
clasificación fina de alteración hidrotermal (propilítica/argílica/
filítica — ni Sentinel-2 ni ASTER 9-3-1 tal como se usan acá tienen las
bandas para eso, mismo límite ya documentado en copernicus.py), siempre
cruza cada anomalía contra la lectura roca/vegetación de ASTER, siempre
en tono de hipótesis a verificar en campo. Si "coincidencias" tiene algo
pintado, se le pide destacarlo explícitamente — es la señal más fuerte de
las 6 capas de Copernicus (2+ índices independientes de acuerdo en el
mismo píxel).

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
# Tiene que mandar y procesar hasta 8 imágenes (6 de Copernicus + 2 de
# GEOCATMIN) -- más lento que una pregunta de texto del asesor (8s ahí),
# pero esto corre en un BackgroundTask, nunca bloqueando una visita real
# a la ficha (ver routers/proyectos.py).
_TIMEOUT = 30

# Sube cada vez que cambia la METODOLOGÍA del análisis (el prompt, qué
# fuentes cruza) sin que cambien las capas de Copernicus en sí -- así
# routers.proyectos._interpretacion_necesita_refresco() puede detectar
# "hay una interpretación vieja con el método anterior" y regenerarla
# leyendo los PNG ya guardados, SIN gastar créditos de Sentinel Hub de
# nuevo (que sí depende de copernicus.VERSION_CACHE, algo distinto).
VERSION_INTERPRETACION = 2

_TITULOS_CAPAS = {
    "oxidos_de_hierro": "Óxidos de hierro",
    "arcillas": "Arcillas",
    "hierro_ferroso": "Hierro ferroso",
    "arcilla_sulfatos_mica": "Arcilla / sulfatos / mica",
    "combinado": "Combinado (las 4 anteriores superpuestas)",
    "coincidencias": "Coincidencias (zonas donde 2 o más índices están de acuerdo)",
}

_TITULOS_IMAGENES_GEOCATMIN = {
    "aster_931": (
        "ASTER 9-3-1 de GEOCATMIN (falso color -- NO es un índice mineral 1:1, "
        "úsala solo para distinguir roca expuesta de vegetación densa)"
    ),
    "anomalia_espectral": (
        "Anomalías Espectrales oficiales de GEOCATMIN (polígonos ya clasificados "
        "por INGEMMET: óxidos en rojo, arcillas en verde, óxidos y arcillas juntos "
        "en amarillo)"
    ),
}

_SYSTEM = """Eres un asistente que ayuda a un operador de una plataforma minera peruana \
a interpretar la información de ubicación de una concesión minera, para uso INTERNO \
(nunca se muestra tal cual a un inversionista).

Te doy, en este orden:
1. Datos de catastro y geología YA VERIFICADOS por GEOCATMIN, en texto -- no hace \
falta "leer" nada para esto: en qué unidad litológica cae la concesión (a escala \
1:50,000 si INGEMMET tiene carta ahí, si no a 1:100,000 -- te digo cuál se usó) y si \
hay fallas geológicas mapeadas cerca.
2. ASTER 9-3-1 de GEOCATMIN (imagen, falso color): úsala SOLO para juzgar si el área \
muestra roca expuesta o vegetación densa. Esto pesa todo lo demás: una anomalía \
espectral (de GEOCATMIN o de Copernicus) que cae sobre ROCA EXPUESTA es una señal más \
confiable; la misma anomalía sobre VEGETACIÓN es menos confiable (el follaje \
contamina la lectura espectral del suelo).
3. La capa oficial de Anomalías Espectrales de GEOCATMIN (imagen, polígonos ya \
clasificados por INGEMMET) -- di explícitamente si algo de esto cae dentro de la \
concesión (tiene su borde dibujado en la imagen) o no.
4. Hasta 6 capas de Copernicus/Sentinel-2 (óxidos de hierro, arcillas, hierro \
ferroso, arcilla/sulfatos/mica, combinado, coincidencias), cada una TRANSPARENTE \
salvo donde ese índice detectó una anomalía (el 10% más alto dentro de la concesión) \
-- las zonas de color son lo único que importa, el resto no tiene información.

Reglas que debes seguir siempre, sin excepción:
1. Nunca afirmes que hay un mineral presente, ni des una ley o cantidad -- solo "zona \
candidata a revisar" o "señal a investigar con muestreo en campo", nunca un hallazgo \
confirmado.
2. Nunca hagas una clasificación fina de alteración hidrotermal (propilítica, \
argílica, filítica) -- ni Sentinel-2 ni ASTER 9-3-1 tal como se usan acá tienen las \
bandas necesarias para eso. Usa únicamente los nombres de índice/capa tal como te los \
doy.
3. Cruza SIEMPRE las anomalías (de GEOCATMIN o de Copernicus) contra la lectura de \
ASTER 9-3-1: si una zona con anomalía es roca expuesta, dilo como señal más fuerte; \
si cae sobre vegetación, acláralo como señal más débil o no verificable ahí desde el \
satélite.
4. Si distintos índices de Copernicus aparecen en zonas DISTINTAS de la concesión (no \
superpuestos entre sí), menciónalo explícitamente -- por ejemplo "óxidos de hierro al \
norte y arcillas al sur" -- es información útil, sin forzar una interpretación \
geológica fina que estos datos no permiten.
5. Si "Coincidencias" tiene algo pintado, dedícale una mención explícita -- ahí 2 o \
más índices de Copernicus coinciden en el mismo punto, es la señal más fuerte de \
todas.
6. Si una capa o dato sale vacío o sin novedad, dilo así ("sin fallas cercanas \
verificadas", "sin anomalía relevante en X") en vez de forzar una lectura interesante \
donde no la hay.
7. Responde en español, en 1 o 2 párrafos cortos (hasta 8 oraciones en total), tono \
profesional y directo, sin adjetivos de venta."""


def _texto_contexto_geocatmin(contexto: dict | None) -> str:
    """Arma en una sola oración el resumen de geocatmin.resumen_para_ia()
    para dárselo a Gemini como texto -- litología/fallas ya son dato
    verificado, no algo que la IA deba "leer" de una imagen."""
    if not contexto:
        return "No hay datos de catastro/geología de GEOCATMIN disponibles para esta concesión."
    partes = []
    if contexto.get("concesion_nombre"):
        hectareas = (
            f" ({contexto['concesion_hectareas']} ha)" if contexto.get("concesion_hectareas") else ""
        )
        partes.append(f'Concesión "{contexto["concesion_nombre"]}"{hectareas}.')
    if contexto.get("litologia"):
        partes.append(
            f"Litología (carta {contexto.get('escala_litologia') or '1:100,000'}): "
            f"{contexto['litologia']}."
        )
    else:
        partes.append("Sin dato de litología disponible en GEOCATMIN para este punto.")
    if contexto.get("fallas_items"):
        escala = contexto.get("fallas_escala") or "verificada"
        partes.append(
            f"Fallas geológicas cercanas (carta {escala}): " + ", ".join(contexto["fallas_items"]) + "."
        )
    elif contexto.get("fallas_escala"):
        partes.append(f"Sin fallas geológicas cercanas verificadas (carta {contexto['fallas_escala']}).")
    return " ".join(partes)


def _imagen_a_parte(contenido: bytes) -> dict:
    return {
        "inlineData": {
            "mimeType": "image/png",
            "data": base64.b64encode(contenido).decode("ascii"),
        }
    }


def generar_interpretacion(
    capas: dict[str, bytes],
    mineral: str,
    region: str,
    contexto_geocatmin: dict | None = None,
    imagenes_geocatmin: dict[str, bytes] | None = None,
) -> str | None:
    """`capas`: mismo dict que devuelve copernicus.generar_capas()["capas"]
    (nombre de índice -> bytes PNG). `contexto_geocatmin`:
    geocatmin.resumen_para_ia() (litología/fallas, texto). `imagenes_geocatmin`:
    geocatmin.imagenes_analisis_ia() (ASTER 9-3-1 + Anomalías Espectrales,
    bytes PNG) -- ambos opcionales, la interpretación sigue funcionando
    solo con Copernicus si GEOCATMIN no tiene nada para esta concesión.
    None si está desactivado, falta la API key, no hay capas de
    Copernicus, o falla la llamada (mejor esfuerzo)."""
    if _DESACTIVADO or not capas:
        return None
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None

    partes: list[dict] = [
        {
            "text": (
                f"Proyecto minero de {mineral or 'mineral no especificado'} en "
                f"{region or 'región no especificada'}, Perú.\n\n"
                "Datos de catastro/geología de GEOCATMIN (ya verificados, texto):\n"
                f"{_texto_contexto_geocatmin(contexto_geocatmin)}"
            )
        }
    ]
    for nombre, contenido in (imagenes_geocatmin or {}).items():
        partes.append({"text": f"{_TITULOS_IMAGENES_GEOCATMIN.get(nombre, nombre)}:"})
        partes.append(_imagen_a_parte(contenido))
    partes.append(
        {"text": "Capas de anomalías espectrales de Copernicus/Sentinel-2 sobre la concesión:"}
    )
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

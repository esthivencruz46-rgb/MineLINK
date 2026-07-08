"""Protecciones básicas contra abuso: límite de intentos de login por IP
y verificación de que el contenido real de un archivo subido coincide con
el tipo que declara (magic bytes), para que no se pueda subir un ejecutable
disfrazado de PDF o de imagen."""

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

# --- Límite de intentos de login (anti fuerza bruta) ---
# En memoria por proceso: suficiente para un solo uvicorn; si algún día se
# corre con varios workers o varias máquinas, migrar a Redis o similar.
MAX_INTENTOS = 8
VENTANA_SEGUNDOS = 5 * 60

_intentos_por_ip: dict[str, deque] = defaultdict(deque)


def limitar_intentos_login(request: Request) -> None:
    ip = request.client.host if request.client else "desconocida"
    ahora = time.monotonic()
    cola = _intentos_por_ip[ip]
    while cola and ahora - cola[0] > VENTANA_SEGUNDOS:
        cola.popleft()
    if len(cola) >= MAX_INTENTOS:
        raise HTTPException(
            status_code=429,
            detail="Demasiados intentos. Espera unos minutos y vuelve a intentarlo.",
        )
    cola.append(ahora)


# --- Intentos de la pregunta de seguridad (recuperación de contraseña) ---
# A diferencia del límite de login (por IP), este es por CUENTA: 4
# intentos y se acabó, sin importar desde qué IP se pruebe. En memoria por
# proceso, igual que el límite de login (mismo comentario de escalado).
MAX_INTENTOS_RECUPERACION = 4
_intentos_recuperacion: dict[str, int] = defaultdict(int)


def intentos_recuperacion_restantes(clave: str) -> int:
    return max(0, MAX_INTENTOS_RECUPERACION - _intentos_recuperacion[clave])


def limitar_intentos_recuperacion(clave: str) -> None:
    if _intentos_recuperacion[clave] >= MAX_INTENTOS_RECUPERACION:
        raise HTTPException(
            status_code=429,
            detail=(
                "Superaste los 4 intentos permitidos. Escríbenos por "
                "WhatsApp para restablecer tu contraseña."
            ),
        )


def registrar_intento_fallido_recuperacion(clave: str) -> None:
    _intentos_recuperacion[clave] += 1


def resetear_intentos_recuperacion(clave: str) -> None:
    _intentos_recuperacion.pop(clave, None)


# --- Verificación de firma real del archivo (magic bytes) ---
def contenido_coincide_con_tipo(contenido: bytes, content_type: str) -> bool:
    if content_type == "application/pdf":
        return contenido.startswith(b"%PDF")
    if content_type == "image/jpeg":
        return contenido.startswith(b"\xff\xd8\xff")
    if content_type == "image/png":
        return contenido.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type == "image/webp":
        return contenido[:4] == b"RIFF" and contenido[8:12] == b"WEBP"
    return False

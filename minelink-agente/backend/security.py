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

# Cada cuántas peticiones se barren las IPs cuya ventana ya venció — sin
# esto, cada IP que alguna vez intentó loguearse quedaba como clave
# permanente del dict (fuga de memoria lenta pero indefinida en un proceso
# de larga duración; hallazgo de auditoría, julio 2026). El barrido es
# O(n) pero amortizado: corre una vez cada _CADA_CUANTO_BARRER llamadas.
_CADA_CUANTO_BARRER = 500
_llamadas_desde_barrido = 0


def _barrer_si_toca(registro: dict[str, deque], ventana: float) -> None:
    global _llamadas_desde_barrido
    _llamadas_desde_barrido += 1
    if _llamadas_desde_barrido < _CADA_CUANTO_BARRER:
        return
    _llamadas_desde_barrido = 0
    ahora = time.monotonic()
    vencidas = [
        clave for clave, cola in registro.items() if not cola or ahora - cola[-1] > ventana
    ]
    for clave in vencidas:
        del registro[clave]


def _ip_real(request: Request) -> str:
    """`request.client.host` es la IP del último salto TCP antes de
    llegar a uvicorn -- en producción eso es el proxy interno de Render
    (con Cloudflare por delante), NO el visitante real (julio 2026,
    hallazgo al revisar el asesor a fondo: nunca se verificó esto). Si
    TODOS los visitantes comparten esa misma IP de proxy, un límite "por
    IP" como MAX_PREGUNTAS_ASESOR_HORA en realidad se reparte entre TODOS
    los visitantes combinados -- con tráfico normal (15-20 personas
    distintas preguntando algo en una hora), cualquiera podía toparse con
    un 429 "demasiadas preguntas desde esta conexión" sin haber preguntado
    más de una vez él mismo. `CF-Connecting-IP` lo pone Cloudflare en su
    borde y no se puede falsificar desde el navegador (más confiable que
    X-Forwarded-For, que en teoría el cliente podría intentar mandar
    armado); si no está (ej. desarrollo local, sin Cloudflare por medio),
    cae a X-Forwarded-For (primer valor = IP original) y por último al
    host de la conexión directa."""
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip:
        return cf_ip.strip()
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "desconocida"


def _limitar_por_ip(
    request: Request,
    registro: dict[str, deque],
    maximo: int,
    ventana: float,
    detalle: str,
) -> None:
    ip = _ip_real(request)
    ahora = time.monotonic()
    _barrer_si_toca(registro, ventana)
    cola = registro[ip]
    while cola and ahora - cola[0] > ventana:
        cola.popleft()
    if len(cola) >= maximo:
        raise HTTPException(status_code=429, detail=detalle)
    cola.append(ahora)


def limitar_intentos_login(request: Request) -> None:
    _limitar_por_ip(
        request,
        _intentos_por_ip,
        MAX_INTENTOS,
        VENTANA_SEGUNDOS,
        "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.",
    )


# --- Límite de registros públicos (anti spam de cuentas/postulaciones) ---
# POST /proyectos/{id}/interes y /consultores/postular crean registros sin
# autenticación previa — sin este freno se podían spamear cuentas de
# inversionista o postulaciones falsas sin fricción (hallazgo de auditoría,
# julio 2026). Tope generoso para no molestar a nadie real: nadie legítimo
# deja más de 10 intereses/postulaciones en una hora desde la misma IP.
MAX_CREACIONES_PUBLICAS = 10
VENTANA_CREACIONES = 60 * 60

_creaciones_por_ip: dict[str, deque] = defaultdict(deque)


def limitar_creaciones_publicas(request: Request) -> None:
    _limitar_por_ip(
        request,
        _creaciones_por_ip,
        MAX_CREACIONES_PUBLICAS,
        VENTANA_CREACIONES,
        "Demasiadas solicitudes desde esta conexión. Intenta de nuevo en una hora.",
    )


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


# --- Preguntas al asesor conversacional PÚBLICO (julio 2026) ---
# Cada pregunta le cuesta dinero real a Esthiven (API externa de pago) —
# sin este tope, un bug del frontend o un uso malicioso generaría gasto
# sin control. Es un endpoint público sin cuenta (decisión explícita del
# dueño: "cualquier persona sin registrarse"), así que el límite es por
# IP — mismo patrón que limitar_creaciones_publicas.
MAX_PREGUNTAS_ASESOR_HORA = 15
VENTANA_ASESOR = 60 * 60

_preguntas_asesor_por_ip: dict[str, deque] = defaultdict(deque)


def limitar_preguntas_asesor(request: Request) -> None:
    _limitar_por_ip(
        request,
        _preguntas_asesor_por_ip,
        MAX_PREGUNTAS_ASESOR_HORA,
        VENTANA_ASESOR,
        "Demasiadas preguntas desde esta conexión. Intenta de nuevo en una hora.",
    )


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

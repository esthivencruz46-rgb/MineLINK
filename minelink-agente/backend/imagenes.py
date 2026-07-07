"""Compresión automática de imágenes subidas, para cuidar el 1 GB gratuito
de Supabase Storage: una foto de celular de 5 MB queda en ~300 KB sin
pérdida visible para ver la mina (se redimensiona a máx. 1600px y se
guarda como JPEG calidad 80).

Best-effort: si la imagen no se puede procesar, se guarda tal cual llegó
(nunca se rechaza por esto — la validación de firma ya pasó antes).
"""

from io import BytesIO
from typing import Optional

from PIL import Image

LADO_MAXIMO = 1600
CALIDAD_JPEG = 80


def comprimir_si_es_imagen(
    contenido: bytes, content_type: str
) -> tuple[bytes, str, Optional[str]]:
    """Devuelve (contenido, content_type, extension_forzada).
    Si no es imagen o no conviene comprimir, devuelve lo original con
    extension_forzada=None."""
    if not content_type.startswith("image/"):
        return contenido, content_type, None
    try:
        imagen = Image.open(BytesIO(contenido))
        imagen = imagen.convert("RGB")
        imagen.thumbnail((LADO_MAXIMO, LADO_MAXIMO))
        salida = BytesIO()
        imagen.save(salida, "JPEG", quality=CALIDAD_JPEG, optimize=True)
        comprimido = salida.getvalue()
        # Solo usar la versión comprimida si de verdad pesa menos
        if len(comprimido) < len(contenido):
            return comprimido, "image/jpeg", "jpg"
        return contenido, content_type, None
    except Exception:
        return contenido, content_type, None

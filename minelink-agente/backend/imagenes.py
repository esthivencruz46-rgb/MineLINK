"""Compresión automática de imágenes subidas, para cuidar el 1 GB gratuito
de Supabase Storage: una foto de celular de 5 MB queda en ~300 KB sin
pérdida visible para ver la mina (se redimensiona a máx. 1600px y se
guarda como JPEG calidad 80).

Best-effort: si la imagen no se puede procesar, se guarda tal cual llegó
(nunca se rechaza por esto — la validación de firma ya pasó antes).
"""

from io import BytesIO
from typing import Optional

import fitz  # PyMuPDF
from PIL import Image

LADO_MAXIMO = 1600
CALIDAD_JPEG = 80
ESCALA_PDF_A_IMAGEN = 2.0  # ~144 DPI, legible sin pesar demasiado


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


def convertir_pdf_a_imagen(contenido: bytes) -> Optional[bytes]:
    """Renderiza la primera hoja de un PDF como foto JPEG. En
    'Documentación' todo se muestra como foto, nunca se embebe un PDF
    crudo — el caller debe pasar el resultado por `comprimir_si_es_imagen`
    igual que cualquier otra foto subida. Devuelve None si el PDF no se
    pudo leer (ej. corrupto) — el caller decide qué hacer en ese caso."""
    try:
        with fitz.open(stream=contenido, filetype="pdf") as doc:
            if doc.page_count == 0:
                return None
            pagina = doc.load_page(0)
            pixmap = pagina.get_pixmap(matrix=fitz.Matrix(ESCALA_PDF_A_IMAGEN, ESCALA_PDF_A_IMAGEN))
            return pixmap.tobytes("jpeg")
    except Exception:
        return None

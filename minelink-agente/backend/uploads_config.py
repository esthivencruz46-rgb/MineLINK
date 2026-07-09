from pathlib import Path

from scoring import ESTUDIO_POR_PREGUNTA

UPLOADS_DIR = Path(__file__).parent / "uploads" / "cvs"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

CV_TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024  # 5 MB

# Documentos que el minero sube desde /mi-cuenta (fotos de la mina, leyes,
# catastro, etc.) — preparación para un futuro nivel de "conectar con
# inversiones", que todavía NO existe como funcionalidad.
DOCUMENTOS_MINERO_DIR = Path(__file__).parent / "uploads" / "documentos_mineros"
DOCUMENTOS_MINERO_DIR.mkdir(parents=True, exist_ok=True)

DOCUMENTO_TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024  # 10 MB

# Fotos de la mina: mínimo 3 para que el proyecto se vea completo ante
# inversionistas (checklist de /mi-cuenta), máximo 5 por operación.
FOTOS_MINA_MAXIMO = 5

# categoría → (tipos de contenido aceptados, etiqueta legible)
# Los documentos legales aceptan PDF O una foto del documento (imagen) —
# muchos mineros no tienen un escaneo, solo pueden fotografiarlo con el
# celular. Distinto del CV de consultores (postulación), que sigue siendo
# solo PDF (ver routers/empresas.py).
_PDF_O_IMAGEN = ("application/pdf", "image/jpeg", "image/png", "image/webp")

CATEGORIAS_DOCUMENTO = {
    "fotos_mina": (("image/jpeg", "image/png", "image/webp"), "Fotos de la mina"),
    "informe_leyes": (_PDF_O_IMAGEN, "Informe de leyes / ensayes"),
    "catastro": (_PDF_O_IMAGEN, "Catastro / plano de ubicación"),
    "ruc": (_PDF_O_IMAGEN, "RUC escaneado"),
    "contrato_explotacion": (_PDF_O_IMAGEN, "Contrato de explotación"),
    "titulo_concesion": (_PDF_O_IMAGEN, "Título de concesión"),
}

# El diagnóstico Sí/No declara el estado de formalización, pero esa
# declaración por sí sola no se puede comprobar. Además de los documentos
# fijos de arriba, el minero puede subir una foto de respaldo por cada
# estudio/trámite del catálogo (REINFO, IPERC, IGAFOM, etc. — ver
# scoring.ESTUDIO_POR_PREGUNTA), sea cual haya sido su respuesta. Mismos
# tipos aceptados que los documentos legales (PDF o foto, se convierte a
# foto al subir — ver imagenes.convertir_pdf_a_imagen).
TIPOS_PDF_O_IMAGEN = _PDF_O_IMAGEN
CATEGORIAS_ESTUDIO: set[str] = set(ESTUDIO_POR_PREGUNTA.values())

from pathlib import Path

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
# inversionistas (checklist de /mi-cuenta), máximo 10 por operación.
FOTOS_MINA_MAXIMO = 10

# categoría → (tipos de contenido aceptados, etiqueta legible)
CATEGORIAS_DOCUMENTO = {
    "fotos_mina": (("image/jpeg", "image/png", "image/webp"), "Fotos de la mina"),
    "informe_leyes": (("application/pdf",), "Informe de leyes / ensayes"),
    "catastro": (("application/pdf",), "Catastro / plano de ubicación"),
    "ruc": (("application/pdf",), "RUC escaneado"),
    "contrato_explotacion": (("application/pdf",), "Contrato de explotación"),
    "titulo_concesion": (("application/pdf",), "Título de concesión"),
}

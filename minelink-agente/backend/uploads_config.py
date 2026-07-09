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

# Varios estudios del catálogo piden, en la práctica, LA MISMA foto/documento
# que ya se pide en "Documentos legales" (los 5 fijos) u otro estudio —
# antes se mostraban como slots de "Respalda tu declaración" separados,
# duplicando el pedido y confundiendo al minero (ej. "Título de concesión"
# fijo Y "Ser titular de tu concesión" como estudio aparte, pidiendo la
# misma foto dos veces). Este mapeo dice, para cada estudio redundante,
# cuál es la categoría que YA lo cubre: no se muestra como slot aparte
# (ver `_estudios_aplicables` en routers/mineros.py) y basta con subir la
# categoría equivalente para que el estudio quede verificado también
# (ver `brechas_verificadas` en routers/proyectos.py).
_EQUIVALENCIAS_ESTUDIO: dict[str, str] = {
    "titularidad_concesion": "titulo_concesion",  # L2: mismo papel que el título
    "vigencia_concesion": "titulo_concesion",  # L6: la vigencia consta en el mismo título
    "tramite_sunat": "ruc",  # L4: activar el RUC = el mismo RUC escaneado
    "levantamiento_georreferenciado": "catastro",  # L5: mismo plano/GPS que el catastro
    "levantamiento_topografico": "catastro",  # T5: topografía = plano de ubicación
    "instrumento_ambiental_vigente": "igafom_aprobado",  # A2: vigencia consta en el mismo IGAFOM
    "puesta_en_produccion": "fotos_mina",  # O1: foto de la mina operando = fotos de la mina
    "analisis_laboratorio": "informe_leyes",  # T3: análisis de laboratorio = informe de leyes/ensayes
    "contrato_explotacion": "contrato_explotacion",  # L3: mismo nombre en ambos catálogos
}


def categoria_equivalente(categoria: str, situacion: str) -> str | None:
    """Si `categoria` en la práctica pide la misma foto que otra categoría
    ya existente, devuelve esa categoría equivalente (None si es genuinamente
    distinta). T7 ("documentar tu operación con fotos") solo equivale a
    "fotos_mina" en Ruta 1 — en Ruta 2 pide un estudio de prefactibilidad,
    no fotos de una mina que todavía no opera."""
    if categoria == "documentacion_operacion" and situacion == "minero_artesanal":
        return "fotos_mina"
    return _EQUIVALENCIAS_ESTUDIO.get(categoria)

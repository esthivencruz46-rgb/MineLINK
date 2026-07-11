from pathlib import Path

from catalogo_diagnostico import ESTUDIOS_DIAGNOSTICO, ESTUDIOS_LEGACY

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
# inversionistas (checklist de /mi-cuenta), máximo 10 por operación
# (subido de 5 en julio 2026 — un solo álbum genérico se quedaba corto
# una vez que se sumaron las fotos específicas de mineral/acceso/agua/
# energía, ver CATEGORIAS_FOTO_PERFIL).
FOTOS_MINA_MAXIMO = 10

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
    # Solo para mineros con estado_formalizacion == "formal": la foto de su
    # autorización de inicio/reinicio de actividades es EL respaldo de la
    # insignia "Formal" en la vitrina (el gate se valida al subir, ver
    # routers/mineros.py).
    "autorizacion_drem": (_PDF_O_IMAGEN, "Autorización de inicio de actividades (DREM/GREM)"),
}

# El diagnóstico Sí/No declara el estado de formalización, pero esa
# declaración por sí sola no se puede comprobar. Además de los documentos
# fijos de arriba, el minero puede subir una foto de respaldo por cada
# estudio/trámite del catálogo (REINFO, IPERC, IGAFOM, etc. — ver
# scoring.ESTUDIO_POR_PREGUNTA), sea cual haya sido su respuesta. Mismos
# tipos aceptados que los documentos legales (PDF o foto, se convierte a
# foto al subir — ver imagenes.convertir_pdf_a_imagen).
TIPOS_PDF_O_IMAGEN = _PDF_O_IMAGEN
# Estudios del catálogo nuevo (perfiles A/B/C/D) + los del modelo anterior
# (se conservan para seguir sirviendo documentos ya subidos y porque las
# empresas pueden seguir ofreciéndolos).
CATEGORIAS_ESTUDIO: set[str] = ESTUDIOS_DIAGNOSTICO | ESTUDIOS_LEGACY

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
    # vigencia_concesion tiene slot PROPIO (no equivale al título): el
    # comprobante de pago de vigencia es un recibo/constancia que se
    # renueva cada año, distinto del título que se emite una sola vez.
    "tramite_sunat": "ruc",  # L4: activar el RUC = el mismo RUC escaneado
    "levantamiento_georreferenciado": "catastro",  # L5: mismo plano/GPS que el catastro
    "puesta_en_produccion": "fotos_mina",  # O1: foto de la mina operando = fotos de la mina
    "analisis_laboratorio": "informe_leyes",  # T3: análisis de laboratorio = informe de leyes/ensayes
    "contrato_explotacion": "contrato_explotacion",  # L3: mismo nombre en ambos catálogos
    # Los estudios nuevos del pipeline (acreditacion_terreno, dj_arqueologica,
    # expediente_tecnico, declaracion_produccion_semestral) tienen slot
    # propio — no equivalen a ningún documento fijo.
}


# Fotos condicionadas al PERFIL informativo (no al Sí/No de formalización):
# solo se piden si el minero declaró el dato correspondiente, con una
# etiqueta que usa su propia respuesta para que sepa exactamente qué foto
# es (ej. "Foto del mineral que extraes (Cobre)") — así se reemplaza el
# recordatorio en texto plano por un pedido de foto concreto y accionable.
CATEGORIAS_FOTO_PERFIL = {
    "foto_mineral": (("image/jpeg", "image/png", "image/webp"), "Foto del mineral"),
    "foto_acceso": (("image/jpeg", "image/png", "image/webp"), "Foto del camino de acceso"),
    "foto_agua": (("image/jpeg", "image/png", "image/webp"), "Foto de tu fuente de agua"),
    "foto_energia": (("image/jpeg", "image/png", "image/webp"), "Foto de tu fuente de energía"),
}

_ETIQUETAS_ACCESO_LOGISTICO = {
    "carretera_asfaltada": "Carretera asfaltada",
    "camino_afirmado": "Camino afirmado",
    "trocha": "Trocha",
    "muy_remoto": "Acceso remoto",
}


def categorias_perfil_foto_aplicables(operacion) -> list[tuple[str, str]]:
    """Exclusivo de Ruta 1 (minero_artesanal) — Ruta 2 todavía no opera, no
    tiene un camino/fuente de agua/energía real de su propia labor que
    fotografiar. Devuelve (categoria, etiqueta) solo para lo que el minero
    efectivamente declaró en el perfil, con su propia respuesta en la
    etiqueta."""
    if (getattr(operacion, "situacion", None) or "minero_artesanal") != "minero_artesanal":
        return []

    categorias: list[tuple[str, str]] = []

    mineral = getattr(operacion, "mineral", None)
    if mineral and mineral != "no especificado":
        categorias.append(("foto_mineral", f"Foto del mineral que extraes ({mineral.title()})"))

    acceso_logistico = getattr(operacion, "acceso_logistico", None)
    if acceso_logistico:
        etiqueta_acceso = _ETIQUETAS_ACCESO_LOGISTICO.get(acceso_logistico, acceso_logistico)
        categorias.append(("foto_acceso", f"Foto del camino de acceso ({etiqueta_acceso})"))

    acceso_agua = getattr(operacion, "acceso_agua", None)
    if acceso_agua and acceso_agua != "no_disponible":
        categorias.append(("foto_agua", "Foto de tu fuente de agua"))

    acceso_energia = getattr(operacion, "acceso_energia", None)
    if acceso_energia and acceso_energia != "no":
        categorias.append(("foto_energia", "Foto de tu fuente de energía"))

    return categorias


def categoria_equivalente(categoria: str, situacion: str) -> str | None:
    """Si `categoria` en la práctica pide la misma foto que otra categoría
    ya existente, devuelve esa categoría equivalente (None si es genuinamente
    distinta). T7 ("documentar tu operación con fotos") solo equivale a
    "fotos_mina" en Ruta 1 — en Ruta 2 pide un estudio de prefactibilidad,
    no fotos de una mina que todavía no opera."""
    if categoria == "documentacion_operacion" and situacion == "minero_artesanal":
        return "fotos_mina"
    return _EQUIVALENCIAS_ESTUDIO.get(categoria)

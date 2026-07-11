"""⏸️ EN PAUSA (julio 2026) — scoring del diagnóstico ANTERIOR.

Contiene el MineScore por dimensiones (22 preguntas Sí/No), el modelo
intermedio de 5 estados (nunca llegó a producción) y el Score de Atractivo
de Inversión. Fue reemplazado por el sistema de perfiles A/B/C/D con dos
semáforos (ver context/diagnostico_formalizacion.md y scoring.py).

NO BORRAR: Esthiven pidió conservarlo para decidir más adelante si algo se
reincorpora. Ningún módulo activo debe importar de aquí.
"""

# Puntos por pregunta — copiado de context/criterios_score.md
# Seguridad depende de tipo_mina: S5 (ventilación) solo aplica en
# minería subterránea; en tajo abierto sus 25 pts se reparten entre
# las otras 4 preguntas (6/6/6/7) para que la dimensión siga sumando 25.
# El score siempre se normaliza a 0-100 sobre el máximo aplicable, así que
# el valor absoluto de cada pregunta importa menos que su proporción.
PUNTOS_BASE = {
    # Etapa 0 — requisitos de inscripción REINFO (estados sin_tramite /
    # reinfo_en_tramite). Todos mapean al estudio "tramite_reinfo".
    "E1": 5, "E2": 5, "E3": 5, "E4": 5, "E5": 5, "E6": 5,
    # Los 7 documentos de formalización (estados reinfo_vigente /
    # en_formalizacion) + L5 (georreferenciación, acompaña al sinceramiento)
    "L2": 5, "L3": 5,        # doc 3: titularidad / cesión o contrato
    "L4": 5,                  # doc 6: RUC activo en renta 3ª categoría
    "L5": 5,                  # coordenadas georreferenciadas
    "D2": 5,                  # doc 2: acreditación de terreno superficial
    "D4": 5,                  # doc 4: DJ de inexistencia de restos arqueológicos
    "D7": 5,                  # doc 7: declaración de producción semestral
    "A1": 5,                  # doc 1: IGAFOM/IGAC aprobado y vigente
    "D5": 5,                  # doc 5: expediente técnico (dimensión técnico)
    # Preparación técnica y de seguridad (no son requisitos para
    # formalizarse — son lo que mira un inversionista; aplican a TODOS
    # los estados, incluido "formal")
    "L6": 5,                  # vigencia de concesión (solo Ruta 2)
    "A4": 5,                  # plan de manejo de residuos (condicional)
    "O1": 5,                  # produce mineral actualmente
    "T1": 5, "T3": 5, "T6": 5, "T7": 5,
    "R1": 5,                  # conflictividad social (solo Ruta 2)
}

PUNTOS_SEGURIDAD_SUBTERRANEA = {"S1": 5, "S2": 5, "S3": 5, "S4": 5, "S5": 5}
PUNTOS_SEGURIDAD_TAJO_ABIERTO = {"S1": 6, "S2": 6, "S3": 6, "S4": 7}

TIPOS_MINA = ("subterranea", "tajo_abierto")

# El estado de formalización (pregunta de apertura del diagnóstico, 5
# opciones) decide QUÉ preguntas legales aplican — sigue el pipeline real
# peruano: Etapa 0 (inscripción REINFO, 6 requisitos) → los 7 documentos
# de formalización → autorización DREM/GREM = formal.
ESTADOS_FORMALIZACION = (
    "sin_tramite",        # solo tiene la concesión / no inició trámites
    "reinfo_en_tramite",  # inscripción REINFO en trámite
    "reinfo_vigente",     # REINFO vigente, aún sin iniciar los 7 documentos
    "en_formalizacion",   # REINFO + trámites de formalización en curso
    "formal",             # autorización DREM/GREM emitida
)

IDS_ETAPA0 = {"E1", "E2", "E3", "E4", "E5", "E6"}
IDS_DOCUMENTOS = {"A1", "D2", "L2", "L3", "D4", "D5", "L4", "D7", "L5"}

LEGAL_POR_ESTADO = {
    # Estados 1-2 responden los requisitos de inscripción (para el que está
    # en trámite funcionan como chequeo de riesgo de rechazo).
    "sin_tramite": IDS_ETAPA0,
    "reinfo_en_tramite": IDS_ETAPA0,
    # Estados 3-4 responden los 7 documentos (qué tienen / qué les falta).
    "reinfo_vigente": IDS_DOCUMENTOS,
    "en_formalizacion": IDS_DOCUMENTOS,
    # Ya formal: nada legal que preguntar — todo cumplido por definición.
    "formal": set(),
}

# Bloque de preparación técnica/seguridad por ruta (aplica a todos los
# estados). Ruta 2 (concesionario, solo alcanzable en estado sin_tramite
# cuando aún no saca mineral) mantiene su set reducido de diligencia.
TECNICO_POR_SITUACION = {
    "minero_artesanal": {"O1", "T1", "T3", "T6", "T7", "A4", "S1", "S2", "S3", "S4", "S5"},
    "concesionario": {"L6", "T1", "T3", "T6", "T7", "R1"},
}

# Nombre legado, conservado porque tests/documentación viejos lo referencian
# como el set de situaciones válidas.
SITUACIONES = TECNICO_POR_SITUACION

DIMENSIONES_BASE = {
    "legal": ["E1", "E2", "E3", "E4", "E5", "E6", "L2", "L3", "L4", "L5", "L6", "D2", "D4", "D7"],
    "ambiental": ["A1", "A4"],
    "operativo": ["O1"],
    "tecnico": ["D5", "T1", "T3", "T6", "T7"],
    "social": ["R1"],
}

# brecha (respuesta NO) → etiqueta de estudio del catálogo.
# OJO: ya NO es biyectivo — los 6 requisitos de Etapa 0 mapean todos al
# mismo estudio "tramite_reinfo" (una sola brecha: "necesita ayuda con su
# inscripción REINFO"), ver PREGUNTAS_POR_ESTUDIO más abajo.
ESTUDIO_POR_PREGUNTA = {
    "E1": "tramite_reinfo",
    "E2": "tramite_reinfo",
    "E3": "tramite_reinfo",
    "E4": "tramite_reinfo",
    "E5": "tramite_reinfo",
    "E6": "tramite_reinfo",
    "L2": "titularidad_concesion",
    "L3": "contrato_explotacion",
    "L4": "tramite_sunat",
    "L5": "levantamiento_georreferenciado",
    "L6": "vigencia_concesion",
    "A1": "igafom_aprobado",
    "A4": "plan_manejo_residuos",
    "D2": "acreditacion_terreno",
    "D4": "dj_arqueologica",
    "D5": "expediente_tecnico",
    "D7": "declaracion_produccion_semestral",
    "O1": "puesta_en_produccion",
    "T1": "informe_geologico",
    "T3": "analisis_laboratorio",
    "T6": "estimacion_recursos",
    "T7": "documentacion_operacion",
    "S1": "iperc",
    "S2": "sctr",
    "S3": "plan_seguridad",
    "S4": "evaluacion_geomecanica",
    "S5": "estudio_ventilacion",
    "R1": "gestion_conflictividad_social",
}


def puntos_para(tipo_mina: str) -> dict[str, int]:
    puntos_seguridad = (
        PUNTOS_SEGURIDAD_SUBTERRANEA
        if tipo_mina == "subterranea"
        else PUNTOS_SEGURIDAD_TAJO_ABIERTO
    )
    return {**PUNTOS_BASE, **puntos_seguridad}


def ids_esperados_para(
    tipo_mina: str,
    situacion: str = "minero_artesanal",
    perfil: dict | None = None,
    estado_formalizacion: str | None = None,
) -> set[str]:
    """Set exacto de preguntas aplicables = preguntas legales del estado de
    formalización + bloque de preparación técnica/seguridad de la ruta.

    `estado_formalizacion=None` (filas anteriores a la reestructura de julio
    2026) se trata como "sin_tramite" — sus respuestas guardadas usan ids del
    catálogo viejo, así que `calcular_diagnostico` lanzará ValueError y
    `estado_seguimiento` caerá al score almacenado, como siempre.

    `perfil` resuelve condicionales que dependen del perfil informativo —
    hoy solo A4 (plan de manejo de residuos), que aplica únicamente si el
    minero declaró que usa mercurio/cianuro o genera relaves."""
    estado = estado_formalizacion or "sin_tramite"
    if estado not in LEGAL_POR_ESTADO:
        raise ValueError(f"estado_formalizacion debe ser uno de {ESTADOS_FORMALIZACION}")

    tecnico = TECNICO_POR_SITUACION.get(situacion)
    if tecnico is None:
        raise ValueError(f"situacion debe ser una de {sorted(TECNICO_POR_SITUACION)}")

    disponibles = set(puntos_para(tipo_mina).keys())
    resultado = (LEGAL_POR_ESTADO[estado] | tecnico) & disponibles

    perfil = perfil or {}
    usa_sustancias_toxicas = perfil.get("sustancias_toxicas") not in (None, "no")
    if "A4" in resultado and not usa_sustancias_toxicas:
        resultado = resultado - {"A4"}

    return resultado


# estudio → lista de preguntas que lo generan. Ya NO es biyectivo: los 6
# requisitos de Etapa 0 (E1-E6) comparten el estudio "tramite_reinfo" —
# cuando el admin resuelve esa brecha, se voltean TODAS sus preguntas.
PREGUNTAS_POR_ESTUDIO: dict[str, list[str]] = {}
for _pregunta, _estudio in ESTUDIO_POR_PREGUNTA.items():
    PREGUNTAS_POR_ESTUDIO.setdefault(_estudio, []).append(_pregunta)


def estado_seguimiento(operacion) -> dict:
    """Recalcula score/bloqueo a partir de brechas_resueltas_json, SIN tocar
    la declaración original (respuestas_json/brechas_json/score_total).
    Recibe cualquier objeto con esos atributos (Operacion de SQLAlchemy)."""
    pendientes = sorted(set(operacion.brechas_json) - set(operacion.brechas_resueltas_json))
    perfil = {"sustancias_toxicas": getattr(operacion, "sustancias_toxicas", None)}
    try:
        resultado = aplicar_brechas_resueltas(
            operacion.respuestas_json,
            operacion.tipo_mina,
            operacion.brechas_resueltas_json,
            getattr(operacion, "situacion", None) or "minero_artesanal",
            perfil,
            getattr(operacion, "estado_formalizacion", None),
        )
        score_actual = resultado["score_total"]
        bloqueado_actual = resultado["bloqueado"]
        dimensiones = resultado["dimensiones"]
    except ValueError:
        # Diagnóstico de un formato de preguntas anterior (ya no calza con
        # el catálogo actual): no se puede recalcular, se muestra el
        # original tal cual en vez de romper el listado completo.
        score_actual = operacion.score_total
        bloqueado_actual = operacion.bloqueado
        dimensiones = None

    return {
        "brechas_resueltas": sorted(operacion.brechas_resueltas_json),
        "brechas_pendientes": pendientes,
        "score_actual": score_actual,
        "bloqueado_actual": bloqueado_actual,
        "dimensiones": dimensiones,
    }


def aplicar_brechas_resueltas(
    respuestas: dict[str, bool],
    tipo_mina: str,
    brechas_resueltas: list[str],
    situacion: str = "minero_artesanal",
    perfil: dict | None = None,
    estado_formalizacion: str | None = None,
) -> dict:
    """Recalcula el diagnóstico marcando como SÍ las preguntas cuyas brechas
    ya fueron resueltas (seguimiento del admin), SIN modificar `respuestas`
    original — se opera sobre una copia. Un estudio puede venir de VARIAS
    preguntas (tramite_reinfo ← E1-E6): se voltean todas. Reutiliza
    calcular_diagnostico para no duplicar la lógica de puntaje."""
    respuestas_actualizadas = dict(respuestas)
    for estudio in brechas_resueltas:
        for pregunta_id in PREGUNTAS_POR_ESTUDIO.get(estudio, []):
            if pregunta_id in respuestas_actualizadas:
                respuestas_actualizadas[pregunta_id] = True
    return calcular_diagnostico(
        respuestas_actualizadas, tipo_mina, situacion, perfil, estado_formalizacion
    )


def calcular_diagnostico(
    respuestas: dict[str, bool],
    tipo_mina: str,
    situacion: str = "minero_artesanal",
    perfil: dict | None = None,
    estado_formalizacion: str | None = None,
) -> dict:
    """respuestas: exactamente los ids aplicables según tipo_mina, situacion,
    estado_formalizacion Y perfil (formulario dinámico — `perfil` solo
    resuelve condicionales como A4, ver `ids_esperados_para`). El score
    siempre se normaliza a 0-100 sobre el máximo aplicable, así estados con
    menos preguntas puntúan justo. Lógica pura, sin BD."""
    if tipo_mina not in TIPOS_MINA:
        raise ValueError(f"tipo_mina debe ser uno de {TIPOS_MINA}")

    estado = estado_formalizacion or "sin_tramite"

    puntos = puntos_para(tipo_mina)
    puntos_seguridad = (
        PUNTOS_SEGURIDAD_SUBTERRANEA
        if tipo_mina == "subterranea"
        else PUNTOS_SEGURIDAD_TAJO_ABIERTO
    )
    dimensiones_ids = {**DIMENSIONES_BASE, "seguridad": list(puntos_seguridad.keys())}

    ids_esperados = ids_esperados_para(tipo_mina, situacion, perfil, estado)
    if set(respuestas.keys()) != ids_esperados:
        raise ValueError(
            "Deben venir exactamente los ids de pregunta aplicables a "
            "tipo_mina, situacion y estado_formalizacion"
        )

    # Solo se puntúan/muestran las dimensiones con preguntas aplicables
    por_dimension = {}
    for dim, ids in dimensiones_ids.items():
        aplicables = [i for i in ids if i in ids_esperados]
        if not aplicables:
            continue
        obtenido = sum(puntos[i] for i in aplicables if respuestas[i])
        maximo = sum(puntos[i] for i in aplicables)
        por_dimension[dim] = {"puntaje": obtenido, "maximo": maximo}

    brechas = sorted({
        ESTUDIO_POR_PREGUNTA[i]
        for i, ok in respuestas.items() if not ok
    })

    obtenido_total = sum(d["puntaje"] for d in por_dimension.values())
    maximo_total = sum(d["maximo"] for d in por_dimension.values())

    return {
        # Normalizado a 0-100 sobre el máximo aplicable. Un estado "formal"
        # sin preguntas legales puntúa solo sobre su preparación técnica.
        "score_total": round(100 * obtenido_total / maximo_total) if maximo_total else 100,
        "dimensiones": por_dimension,
        # "bloqueado" = todavía no tiene REINFO vigente (deriva del estado
        # de formalización declarado, ya no de una pregunta L1). Es solo
        # informativo: NO filtra la vitrina pública (ver proyectos.py).
        "bloqueado": estado in ("sin_tramite", "reinfo_en_tramite"),
        "brechas": brechas,
    }


# ==========================================================================
# Score de Atractivo de Inversión (Fase 2, julio 2026)
#
# Distinto del MineScore de formalización de arriba: mide qué tan atractivo
# es el proyecto para un inversionista (escala, viabilidad técnica, riesgo,
# equipo, claridad de la oportunidad), reutilizando la formalización como
# UN ingrediente más, no como el resultado. Se calcula a partir de las
# preguntas informativas del perfil (Fase 1), NUNCA de las preguntas Sí/No.
# Público, visible al inversionista en la ficha del proyecto — ver
# routers/proyectos.py.
# ==========================================================================

PESOS_INVERSION = {
    "minero_artesanal": {
        "formalizacion": 0.20,
        "escala_economica": 0.25,
        "viabilidad_tecnica": 0.15,
        "riesgo_ambiental_social": 0.15,
        "capacidad_equipo": 0.10,
        "claridad_oportunidad": 0.15,
    },
    "concesionario": {
        "formalizacion": 0.15,
        "escala_economica": 0.30,
        "viabilidad_tecnica": 0.20,
        "riesgo_ambiental_social": 0.15,
        "capacidad_equipo": 0.10,
        "claridad_oportunidad": 0.10,
    },
}


def _bucket(valor, tabla: dict, default: int = 0) -> int:
    """Traduce una respuesta de opción única a puntos 0-100 según `tabla`.
    Si el valor es None o no está en la tabla, devuelve `default`."""
    if valor is None:
        return default
    return tabla.get(valor, default)


def _presente(valor) -> int:
    """100 si el campo tiene un valor no vacío, 0 si está ausente."""
    if valor is None:
        return 0
    if isinstance(valor, str) and not valor.strip():
        return 0
    return 100


def _promedio(señales: list[int]) -> int:
    return round(sum(señales) / len(señales)) if señales else 0


_TABLA_PRODUCCION_OBJETIVO = {"igual": 25, "2-3x": 60, "5x+": 100, "no_se": 0}
_TABLA_TRES_NIVELES_ASC = {"no": 0, "parcial": 50, "completo": 100}
_TABLA_RIESGO_CONFLICTIVIDAD = {"no": 100, "percibida": 50, "activa": 0}
_TABLA_EXPERIENCIA_OPERADOR = {"< 2 años": 20, "2-5 años": 50, "5-10 años": 80, "> 10 años": 100}
_TABLA_CAPACITACION_OPERADOR = {
    "ninguna": 0, "cursos_tecnicos": 40, "otro_profesional": 70,
    "cip": 100, "ing_geologo": 100,
}
_TABLA_TONELADAS = {
    "< 100k t": 20, "100k-1M": 40, "1M-10M": 60, "10M-50M": 80,
    "50M-500M": 90, "500M+": 100, "No sé": 0,
}
_TABLA_PRODUCCION_OBJETIVO_ANUAL = {
    "< 1k t/año": 15, "1-10k": 35, "10-50k": 55, "50-100k": 70,
    "100-500k": 85, "500k+": 100, "No definida": 0,
}
_TABLA_ESTUDIO_PREVIO = {
    "no": 0, "interno_preliminar": 40, "externo_parcial": 70, "externo_completo": 100,
}
_TABLA_PASIVOS_AMBIENTALES = {"no": 100, "desconozco": 40, "menor": 60, "mayor": 0}
_TABLA_RIESGO_CONFLICTIVIDAD_CON_DESCONOZCO = {
    "no": 100, "percibida": 50, "desconozco": 40, "activa": 0,
}
_TABLA_EXPERIENCIA_TITULAR = {
    "individual_sin_experiencia": 20, "empresa_nueva": 50,
    "individual_con_experiencia": 60, "empresa_con_trayectoria": 100,
}
_TABLA_CAPITAL_DISPONIBLE = {"no_tengo": 0, "buscando": 30, "parcial": 60, "completo": 100}


def _subscores_ruta1(o) -> dict[str, int]:
    # "conoce_ley" es una pregunta de gate del frontend, no se persiste —
    # `ley_promedio` solo tiene valor si el minero dijo que sí la conocía
    # y la llenó, así que su sola presencia ya es la señal completa.
    return {
        "escala_economica": _promedio([
            _presente(o.produccion_mensual),
            _presente(o.ley_promedio),
            _bucket(o.produccion_objetivo, _TABLA_PRODUCCION_OBJETIVO),
        ]),
        "viabilidad_tecnica": _promedio([
            _bucket(o.tiene_resultados_laboratorio, _TABLA_TRES_NIVELES_ASC),
            _bucket(o.documentacion_disponible, {
                "no": 0, "fotos_basicas": 50, "reportes_tecnicos": 75, "ambos": 100,
            }),
        ]),
        "riesgo_ambiental_social": _promedio([
            100 if not o.sustancias_toxicas or o.sustancias_toxicas == "no"
            else (60 if o.gestion_sustancias and o.gestion_sustancias != "no_se_gestiona" else 0),
            _bucket(o.conflictividad_social, _TABLA_RIESGO_CONFLICTIVIDAD),
            _bucket(o.permisos_comunitarios, {
                "formales": 100, "en_tramite": 60, "informales": 30, "no": 0,
            }),
        ]),
        "capacidad_equipo": _promedio([
            _bucket(o.experiencia_operador, _TABLA_EXPERIENCIA_OPERADOR),
            _bucket(o.capacitacion_operador, _TABLA_CAPACITACION_OPERADOR),
        ]),
        "claridad_oportunidad": _promedio([
            _presente(o.monto_requerido),
            _presente(o.plazo_capital) if o.plazo_capital != "No definido" else 0,
            _presente(o.motivo_capital),
        ]),
    }


def _subscores_ruta2(o) -> dict[str, int]:
    return {
        "escala_economica": _promedio([
            _bucket(o.toneladas_estimadas, _TABLA_TONELADAS),
            _presente(o.ley_esperada),
            _bucket(o.produccion_objetivo, _TABLA_PRODUCCION_OBJETIVO_ANUAL),
        ]),
        "viabilidad_tecnica": _promedio([
            _bucket(o.info_geologica_disponible, _TABLA_TRES_NIVELES_ASC),
            _bucket(o.tiene_resultados_laboratorio, _TABLA_TRES_NIVELES_ASC),
            _bucket(o.estudio_previo, _TABLA_ESTUDIO_PREVIO),
        ]),
        "riesgo_ambiental_social": _promedio([
            _bucket(o.pasivos_ambientales, _TABLA_PASIVOS_AMBIENTALES),
            _bucket(o.conflictividad_social, _TABLA_RIESGO_CONFLICTIVIDAD_CON_DESCONOZCO),
        ]),
        "capacidad_equipo": _promedio([
            _bucket(o.experiencia_titular, _TABLA_EXPERIENCIA_TITULAR),
            _bucket(o.equipo_tecnico, _TABLA_TRES_NIVELES_ASC),
        ]),
        "claridad_oportunidad": _promedio([
            _presente(o.monto_requerido),
            _bucket(o.capital_disponible, _TABLA_CAPITAL_DISPONIBLE),
            _presente(o.timeline_operacion) if o.timeline_operacion != "indefinido" else 0,
        ]),
    }


def calcular_score_inversion(operacion, score_formalizacion: int) -> dict:
    """Score de Atractivo de Inversión (0-100) — combina `score_formalizacion`
    (el MineScore ya calculado, se le pasa hecho para no recalcularlo dos
    veces) con 5 subscores nuevos sacados del perfil informativo. `operacion`
    es cualquier objeto con los atributos del perfil (Operacion de
    SQLAlchemy). Nunca lanza excepción: campos ausentes puntúan 0 en esa
    señal, no rompen el cálculo."""
    situacion = getattr(operacion, "situacion", None) or "minero_artesanal"
    pesos = PESOS_INVERSION.get(situacion, PESOS_INVERSION["minero_artesanal"])
    subscores = _subscores_ruta2(operacion) if situacion == "concesionario" else _subscores_ruta1(operacion)
    subscores["formalizacion"] = score_formalizacion

    score_total = round(sum(pesos[dim] * subscores[dim] for dim in pesos))
    dimensiones = {dim: {"puntaje": subscores[dim], "maximo": 100} for dim in pesos}

    return {"score_total": score_total, "dimensiones": dimensiones}

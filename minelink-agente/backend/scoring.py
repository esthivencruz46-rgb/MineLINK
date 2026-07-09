# Puntos por pregunta — copiado de context/criterios_score.md
# Seguridad depende de tipo_mina: S5 (ventilación) solo aplica en
# minería subterránea; en tajo abierto sus 25 pts se reparten entre
# las otras 4 preguntas (6/6/6/7) para que la dimensión siga sumando 25.
PUNTOS_BASE = {
    "L1": 5, "L2": 5, "L3": 5, "L4": 5, "L5": 5,            # Legal 25 (Ruta 1)
    "L6": 5,                                                  # Vigencia de concesión (solo Ruta 2)
    "A1": 5, "A2": 5, "A3": 5, "A4": 5,                       # Ambiental 15-20 (Ruta 1; A4 condicional)
    "O1": 5,                                                  # Operativo 5
    "T1": 5, "T2": 5, "T3": 5, "T4": 5, "T5": 5, "T6": 5, "T7": 5,  # Técnico 30-35
    "R1": 5,                                                  # Social (solo Ruta 2)
}

PUNTOS_SEGURIDAD_SUBTERRANEA = {"S1": 5, "S2": 5, "S3": 5, "S4": 5, "S5": 5}
PUNTOS_SEGURIDAD_TAJO_ABIERTO = {"S1": 6, "S2": 6, "S3": 6, "S4": 7}

TIPOS_MINA = ("subterranea", "tajo_abierto")

# Situaciones del usuario (formulario dinámico): "no todos los proyectos
# mineros son iguales; primero se identifica la situación y luego se
# construye un cuestionario con solo las preguntas que corresponden".
# Misma filosofía que tipo_mina/S5, generalizada.
#   - None      = aplican todas las preguntas
#   - "excluir" = todas menos esas
#   - "solo"    = únicamente esas
SITUACIONES = {
    # Ruta 1 — minero con operación activa: el cuestionario original
    # completo. L6 (vigencia de concesión) y R1 (Social) son solo de Ruta 2.
    # A4 (plan de manejo de residuos) es condicional dentro de esta misma
    # ruta — ver `ids_esperados_para`, no se resuelve con "excluir" fijo.
    "minero_artesanal": {"excluir": {"L6", "R1"}},
    # Ruta 2 — titular de concesión que recién inicia: no opera todavía,
    # así que no aplican Operativo/Seguridad ni la mayoría de lo Técnico.
    # Legal básico + 2 preguntas ambientales de diligencia (pasivos
    # heredados, plan preliminar) + 4 técnicas de exploración + 1 social
    # (conflictividad comunitaria).
    "concesionario": {
        "solo": {"L1", "L2", "L3", "L4", "L6", "A1", "A2", "T1", "T3", "T6", "T7", "R1"}
    },
}

DIMENSIONES_BASE = {
    "legal": ["L1", "L2", "L3", "L4", "L5", "L6"],
    "ambiental": ["A1", "A2", "A3", "A4"],
    "operativo": ["O1"],
    "tecnico": ["T1", "T2", "T3", "T4", "T5", "T6", "T7"],
    "social": ["R1"],
}

# brecha (respuesta NO) → etiqueta de estudio del catálogo
ESTUDIO_POR_PREGUNTA = {
    "L1": "tramite_reinfo",
    "L2": "titularidad_concesion",
    "L3": "contrato_explotacion",
    "L4": "tramite_sunat",
    "L5": "levantamiento_georreferenciado",
    "L6": "vigencia_concesion",
    "A1": "igafom_aprobado",
    "A2": "instrumento_ambiental_vigente",
    "A3": "sin_clausura_ambiental",
    "A4": "plan_manejo_residuos",
    "O1": "puesta_en_produccion",
    "T1": "informe_geologico",
    "T2": "muestreo_geoquimico",
    "T3": "analisis_laboratorio",
    "T4": "planos_geologicos",
    "T5": "levantamiento_topografico",
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
    tipo_mina: str, situacion: str = "minero_artesanal", perfil: dict | None = None
) -> set[str]:
    """`perfil` resuelve preguntas condicionales que no dependen de
    tipo_mina/situacion sino de una respuesta previa del perfil informativo
    — hoy solo A4 (plan de manejo de residuos), que aplica en Ruta 1
    únicamente si el minero declaró que usa mercurio/cianuro o genera
    relaves (`sustancias_toxicas`)."""
    ids = set(puntos_para(tipo_mina).keys())
    regla = SITUACIONES.get(situacion)
    if regla is None:
        resultado = ids
    elif "excluir" in regla:
        resultado = ids - regla["excluir"]
    else:
        resultado = ids & regla["solo"]

    perfil = perfil or {}
    usa_sustancias_toxicas = perfil.get("sustancias_toxicas") not in (None, "no")
    if "A4" in resultado and not usa_sustancias_toxicas:
        resultado = resultado - {"A4"}

    return resultado


PREGUNTA_POR_ESTUDIO = {estudio: pregunta for pregunta, estudio in ESTUDIO_POR_PREGUNTA.items()}


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
) -> dict:
    """Recalcula el diagnóstico marcando como SÍ las preguntas cuyas brechas
    ya fueron resueltas (seguimiento del admin), SIN modificar `respuestas`
    original — se opera sobre una copia. Reutiliza calcular_diagnostico para
    no duplicar la lógica de puntaje."""
    respuestas_actualizadas = dict(respuestas)
    for estudio in brechas_resueltas:
        pregunta_id = PREGUNTA_POR_ESTUDIO.get(estudio)
        if pregunta_id in respuestas_actualizadas:
            respuestas_actualizadas[pregunta_id] = True
    return calcular_diagnostico(respuestas_actualizadas, tipo_mina, situacion, perfil)


def calcular_diagnostico(
    respuestas: dict[str, bool],
    tipo_mina: str,
    situacion: str = "minero_artesanal",
    perfil: dict | None = None,
) -> dict:
    """respuestas: exactamente los ids aplicables según tipo_mina, situacion
    Y perfil (formulario dinámico — `perfil` solo resuelve preguntas
    condicionales como A4, ver `ids_esperados_para`). El score siempre se
    normaliza a 0-100 sobre el máximo aplicable, así situaciones con menos
    preguntas puntúan justo. Lógica pura, sin BD."""
    if tipo_mina not in TIPOS_MINA:
        raise ValueError(f"tipo_mina debe ser uno de {TIPOS_MINA}")
    if situacion not in SITUACIONES:
        raise ValueError(f"situacion debe ser una de {sorted(SITUACIONES)}")

    puntos = puntos_para(tipo_mina)
    puntos_seguridad = (
        PUNTOS_SEGURIDAD_SUBTERRANEA
        if tipo_mina == "subterranea"
        else PUNTOS_SEGURIDAD_TAJO_ABIERTO
    )
    dimensiones_ids = {**DIMENSIONES_BASE, "seguridad": list(puntos_seguridad.keys())}

    ids_esperados = ids_esperados_para(tipo_mina, situacion, perfil)
    if set(respuestas.keys()) != ids_esperados:
        raise ValueError(
            "Deben venir exactamente los ids de pregunta aplicables a tipo_mina y situacion"
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
        # Normalizado a 0-100 (para el set completo maximo_total=100, así
        # que el score de los casos originales no cambia)
        "score_total": round(100 * obtenido_total / maximo_total),
        "dimensiones": por_dimension,
        # "bloqueado" = no inició REINFO/trámite de formalización (L1=NO).
        # Es solo informativo: NO filtra la vitrina pública (ver
        # proyectos.py) — un proyecto puede listarse igual sin REINFO.
        "bloqueado": not respuestas.get("L1", False),
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

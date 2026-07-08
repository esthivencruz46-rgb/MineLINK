# Puntos por pregunta — copiado de context/criterios_score.md
# Seguridad depende de tipo_mina: S5 (ventilación) solo aplica en
# minería subterránea; en tajo abierto sus 25 pts se reparten entre
# las otras 4 preguntas (6/6/6/7) para que la dimensión siga sumando 25.
PUNTOS_BASE = {
    "L1": 5, "L2": 5, "L3": 5, "L4": 5, "L5": 5,            # Legal 25 (Ruta 1)
    "L6": 5,                                                  # Vigencia de concesión (solo Ruta 2)
    "A1": 5, "A2": 5, "A3": 5,                                # Ambiental 15
    "O1": 5,                                                  # Operativo 5
    "T1": 5, "T2": 5, "T3": 5, "T4": 5, "T5": 5, "T6": 5,    # Técnico 30
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
    # completo. L6 (vigencia de concesión) es solo de Ruta 2.
    "minero_artesanal": {"excluir": {"L6"}},
    # Ruta 2 — titular de concesión que recién inicia: no opera todavía,
    # así que no aplican Ambiental/Operativo/Seguridad ni la mayoría de lo
    # Técnico. Solo situación legal básica (REINFO/trámite, titularidad,
    # contrato o autorización si no es titular, RUC, vigencia de la
    # concesión) + 3 preguntas técnicas equivalentes a exploración
    # (información geológica, ensayes de laboratorio, estimación de leyes).
    "concesionario": {"solo": {"L1", "L2", "L3", "L4", "L6", "T1", "T3", "T6"}},
}

DIMENSIONES_BASE = {
    "legal": ["L1", "L2", "L3", "L4", "L5", "L6"],
    "ambiental": ["A1", "A2", "A3"],
    "operativo": ["O1"],
    "tecnico": ["T1", "T2", "T3", "T4", "T5", "T6"],
}

# brecha (respuesta NO) → etiqueta de estudio del catálogo
ESTUDIO_POR_PREGUNTA = {
    "L1": "tramite_reinfo",
    "L2": "titularidad_concesion",
    "L3": "contrato_explotacion",
    "L4": "tramite_sunat",
    "L5": "levantamiento_georreferenciado",
    "L6": "vigencia_concesion",
    "A1": "igafom_correctivo",
    "A2": "igafom_preventivo",
    "A3": "aprobacion_instrumento_ambiental",
    "O1": "puesta_en_produccion",
    "T1": "informe_geologico",
    "T2": "muestreo_geoquimico",
    "T3": "analisis_laboratorio",
    "T4": "planos_geologicos",
    "T5": "levantamiento_topografico",
    "T6": "estimacion_recursos",
    "S1": "iperc",
    "S2": "sctr",
    "S3": "plan_seguridad",
    "S4": "evaluacion_geomecanica",
    "S5": "estudio_ventilacion",
}


def puntos_para(tipo_mina: str) -> dict[str, int]:
    puntos_seguridad = (
        PUNTOS_SEGURIDAD_SUBTERRANEA
        if tipo_mina == "subterranea"
        else PUNTOS_SEGURIDAD_TAJO_ABIERTO
    )
    return {**PUNTOS_BASE, **puntos_seguridad}


def ids_esperados_para(tipo_mina: str, situacion: str = "minero_artesanal") -> set[str]:
    ids = set(puntos_para(tipo_mina).keys())
    regla = SITUACIONES.get(situacion)
    if regla is None:
        return ids
    if "excluir" in regla:
        return ids - regla["excluir"]
    return ids & regla["solo"]


PREGUNTA_POR_ESTUDIO = {estudio: pregunta for pregunta, estudio in ESTUDIO_POR_PREGUNTA.items()}


def estado_seguimiento(operacion) -> dict:
    """Recalcula score/bloqueo a partir de brechas_resueltas_json, SIN tocar
    la declaración original (respuestas_json/brechas_json/score_total).
    Recibe cualquier objeto con esos atributos (Operacion de SQLAlchemy)."""
    pendientes = sorted(set(operacion.brechas_json) - set(operacion.brechas_resueltas_json))
    try:
        resultado = aplicar_brechas_resueltas(
            operacion.respuestas_json,
            operacion.tipo_mina,
            operacion.brechas_resueltas_json,
            getattr(operacion, "situacion", None) or "minero_artesanal",
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
    return calcular_diagnostico(respuestas_actualizadas, tipo_mina, situacion)


def calcular_diagnostico(
    respuestas: dict[str, bool], tipo_mina: str, situacion: str = "minero_artesanal"
) -> dict:
    """respuestas: exactamente los ids aplicables según tipo_mina Y situacion
    (formulario dinámico). El score siempre se normaliza a 0-100 sobre el
    máximo aplicable, así situaciones con menos preguntas puntúan justo.
    Lógica pura, sin BD."""
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

    ids_esperados = ids_esperados_para(tipo_mina, situacion)
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

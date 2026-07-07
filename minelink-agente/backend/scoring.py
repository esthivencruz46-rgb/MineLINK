# Puntos por pregunta — copiado de context/criterios_score.md
# Seguridad depende de tipo_mina: S5 (ventilación) solo aplica en
# minería subterránea; en tajo abierto sus 25 pts se reparten entre
# las otras 4 preguntas (6/6/6/7) para que la dimensión siga sumando 25.
PUNTOS_BASE = {
    "L1": 5, "L2": 5, "L3": 5, "L4": 5, "L5": 5,            # Legal 25
    "A1": 5, "A2": 5, "A3": 5,                                # Ambiental 15
    "O1": 5,                                                  # Operativo 5
    "T1": 5, "T2": 5, "T3": 5, "T4": 5, "T5": 5, "T6": 5,    # Técnico 30
}

PUNTOS_SEGURIDAD_SUBTERRANEA = {"S1": 5, "S2": 5, "S3": 5, "S4": 5, "S5": 5}
PUNTOS_SEGURIDAD_TAJO_ABIERTO = {"S1": 6, "S2": 6, "S3": 6, "S4": 7}

TIPOS_MINA = ("subterranea", "tajo_abierto")

DIMENSIONES_BASE = {
    "legal": ["L1", "L2", "L3", "L4", "L5"],
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


def ids_esperados_para(tipo_mina: str) -> set[str]:
    return set(puntos_para(tipo_mina).keys())


PREGUNTA_POR_ESTUDIO = {estudio: pregunta for pregunta, estudio in ESTUDIO_POR_PREGUNTA.items()}


def estado_seguimiento(operacion) -> dict:
    """Recalcula score/bloqueo a partir de brechas_resueltas_json, SIN tocar
    la declaración original (respuestas_json/brechas_json/score_total).
    Recibe cualquier objeto con esos atributos (Operacion de SQLAlchemy)."""
    pendientes = sorted(set(operacion.brechas_json) - set(operacion.brechas_resueltas_json))
    try:
        resultado = aplicar_brechas_resueltas(
            operacion.respuestas_json, operacion.tipo_mina, operacion.brechas_resueltas_json
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
    respuestas: dict[str, bool], tipo_mina: str, brechas_resueltas: list[str]
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
    return calcular_diagnostico(respuestas_actualizadas, tipo_mina)


def calcular_diagnostico(respuestas: dict[str, bool], tipo_mina: str) -> dict:
    """respuestas: ids booleanos aplicables según tipo_mina ('subterranea'
    incluye S5, 'tajo_abierto' NO debe incluir S5). Lógica pura, sin BD."""
    if tipo_mina not in TIPOS_MINA:
        raise ValueError(f"tipo_mina debe ser uno de {TIPOS_MINA}")

    puntos = puntos_para(tipo_mina)
    puntos_seguridad = (
        PUNTOS_SEGURIDAD_SUBTERRANEA
        if tipo_mina == "subterranea"
        else PUNTOS_SEGURIDAD_TAJO_ABIERTO
    )
    dimensiones_ids = {**DIMENSIONES_BASE, "seguridad": list(puntos_seguridad.keys())}

    ids_esperados = set(puntos.keys())
    if set(respuestas.keys()) != ids_esperados:
        raise ValueError(
            "Deben venir exactamente los ids de pregunta aplicables a tipo_mina"
        )

    por_dimension = {}
    for dim, ids in dimensiones_ids.items():
        obtenido = sum(puntos[i] for i in ids if respuestas[i])
        maximo = sum(puntos[i] for i in ids)
        por_dimension[dim] = {"puntaje": obtenido, "maximo": maximo}

    brechas = sorted({
        ESTUDIO_POR_PREGUNTA[i]
        for i, ok in respuestas.items() if not ok
    })

    return {
        "score_total": sum(d["puntaje"] for d in por_dimension.values()),
        "dimensiones": por_dimension,
        "bloqueado": not respuestas["L1"],
        "brechas": brechas,
    }

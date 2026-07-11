"""Lógica pura del diagnóstico de formalización (perfiles A/B/C/D).

Fuente de verdad: context/diagnostico_formalizacion.md (julio 2026).
Reemplaza al MineScore 0-100: la salida son DOS semáforos independientes
(Track Legal y Track Técnico-Económico con Índice de Madurez 0-5), nunca
un puntaje único. Regla de oro: SOBREVIVIR → ORDENAR → CRECER.

Sin BD: todo recibe `respuestas: dict[str, str]` y una fecha `hoy`
inyectable (los derivados de plazo cambian con el tiempo). El scoring
anterior quedó congelado en scoring_legacy.py (⏸️ en pausa).
"""

from datetime import date

from catalogo_diagnostico import (
    BRECHA_POR_PREGUNTA,
    FECHA_LIMITE_REINFO,
    PREGUNTAS_POR_ESTUDIO,
    VALOR_RESUELTO_POR_PREGUNTA,
    clasificar_perfil,
    validar_respuestas,
)

# Supuestos de negocio del cálculo de urgencia C5 (días que suele tomar un
# documento según su estado) — PENDIENTE DE CALIBRAR con Esthiven.
DIAS_TRAMITE_DOC_NO_INICIADO = 60
DIAS_EVALUACION_DOC_PRESENTADO = 30

# Límites legales de extensión y del reloj de producción mínima
HECTAREAS_MAX_PMA = 1_000
HECTAREAS_MAX_PPM = 2_000
ANIO_PRODUCCION_MINIMA_PMA = 10
ANIO_PRODUCCION_MINIMA_PPM = 6

IDS_DOCS_C2 = tuple(f"C2_{n}" for n in range(1, 8))

# Etiquetas legibles de los bloqueantes (para "Primero resolvamos X")
ETIQUETA_BLOQUEANTE = {
    "zona_prohibida": "El área está en una zona donde no se puede concesionar",
    "dragas_prohibidas": "El uso de dragas en cuerpos de agua está prohibido por ley",
    "riesgo_caducidad_vigencia": "Debes 2+ años del derecho de vigencia — riesgo de caducidad",
    "penalidad_impaga": "Penalidad por no producir sin pagar — riesgo de caducidad",
    "reinfo_suspendido": "Tu REINFO está suspendido — no puedes operar legalmente",
    "plazo_reinfo_critico": "No llegas al plazo del REINFO (31/12/2026) al ritmo actual",
}


def indice_madurez(perfil: str, respuestas: dict[str, str]) -> int | None:
    """Índice de Madurez para Inversión 0-5 (Módulo INV): un nivel por cada
    "sí" en mapeo geológico, muestreo con laboratorio, estimación de
    recursos, OPEX documentado y producción con liquidaciones.

    ⏸️ Módulo INV en pausa (julio 2026, ver catalogo_diagnostico.PREGUNTAS):
    ya no se pregunta, así que devuelve None para TODOS los perfiles — sumar
    "no" por ausencia daría un 0 (rojo) engañoso en vez de "sin dato"."""
    return None


def semaforo_tecnico(madurez: int | None) -> str | None:
    if madurez is None:
        return None
    if madurez >= 4:
        return "verde"
    if madurez >= 2:
        return "amarillo"
    return "rojo"


def clasificacion_de(perfil: str, respuestas: dict[str, str]) -> str | None:
    """PMA / PPM / no_califica según el spec. B valida contra hectáreas
    (PMA ≤ 1,000 ha; PPM ≤ 2,000; más → régimen general). C/D ya la tienen
    fijada por su trámite → None (no se pregunta)."""
    if perfil in ("A", "A_avanzado"):
        return {"manual": "pma", "maquinaria": "ppm"}.get(respuestas.get("A5_1"))
    if perfil != "B":
        return None

    try:
        hectareas = int(respuestas.get("B2_2", ""))
    except ValueError:
        hectareas = None
    declarada = respuestas.get("B2_1")

    if hectareas is not None and hectareas > HECTAREAS_MAX_PPM:
        return "no_califica"
    if declarada == "pma":
        # Declaró PMA pero excede su límite → en la práctica es PPM
        if hectareas is not None and hectareas > HECTAREAS_MAX_PMA:
            return "ppm"
        return "pma"
    if declarada == "ppm":
        return "ppm"
    return None  # sin constancia / no sabe


def reloj_produccion(
    perfil: str, respuestas: dict[str, str], clasificacion: str | None, hoy: date
) -> dict | None:
    """Reloj de producción mínima (perfil B): PPM debe producir desde el año
    6 del título, PMA desde el año 10 (después corre penalidad). Sin
    clasificación conocida se usa el límite más estricto (6)."""
    if perfil != "B":
        return None
    try:
        anio_titulo = int(respuestas.get("B1_2", ""))
    except ValueError:
        return None
    limite = ANIO_PRODUCCION_MINIMA_PMA if clasificacion == "pma" else ANIO_PRODUCCION_MINIMA_PPM
    anios_titulo = hoy.year - anio_titulo
    return {
        "anios_titulo": anios_titulo,
        "limite_anios": limite,
        "vencido": anios_titulo >= limite,
        "anios_restantes": max(0, limite - anios_titulo),
    }


def urgencia_reinfo(perfil: str, respuestas: dict[str, str], hoy: date) -> dict | None:
    """Cálculo de urgencia C5 (perfil C): días al 31/12/2026 vs. días que
    tomaría completar lo pendiente. Derivado SIEMPRE al vuelo (cambia con
    el paso del tiempo), nunca persistido."""
    if perfil != "C":
        return None
    dias_restantes = (FECHA_LIMITE_REINFO - hoy).days
    no_iniciados = sum(
        1 for i in IDS_DOCS_C2 if respuestas.get(i) in ("no_iniciado", "no_se")
    )
    presentados = sum(1 for i in IDS_DOCS_C2 if respuestas.get(i) == "presentado")
    if respuestas.get("C1_2") != "si":
        no_iniciados += 1  # sinceramiento de coordenadas pendiente
    docs_pendientes = no_iniciados + presentados
    dias_necesarios = (
        no_iniciados * DIAS_TRAMITE_DOC_NO_INICIADO
        + presentados * DIAS_EVALUACION_DOC_PRESENTADO
    )
    return {
        "dias_restantes": dias_restantes,
        "docs_completados": sum(1 for i in IDS_DOCS_C2 if respuestas.get(i) == "aprobado"),
        "docs_totales": len(IDS_DOCS_C2),
        "docs_pendientes": docs_pendientes,
        "dias_necesarios": dias_necesarios,
        "alerta_roja": dias_necesarios > max(dias_restantes, 0),
    }


def semaforo_legal(
    perfil: str, respuestas: dict[str, str], hoy: date
) -> tuple[str, list[str]]:
    """Track Legal por condiciones (no puntos). Rojo = bloqueante activo de
    la lista cerrada del spec; amarillo = pendiente subsanable o "no sé"
    crítico; verde = requisitos críticos de la etapa cumplidos."""
    bloqueantes: list[str] = []
    amarillo = False
    r = respuestas.get

    if perfil in ("A", "A_avanzado"):
        if r("A2_1") in ("anp", "arqueologica", "urbana", "cauce_rio"):
            bloqueantes.append("zona_prohibida")
        if r("A2_2") == "si":
            bloqueantes.append("dragas_prohibidas")
        if perfil == "A":
            amarillo = (
                r("A1_1") == "no"
                or r("A1_2") in ("no", "no_se_como")
                or r("A1_3") == "no"
                or r("A2_1") in ("frontera", "no_se")
            )
        # El terreno superficial no bloquea el petitorio (la concesión es
        # del subsuelo) pero sin acuerdo es el cuello de botella siguiente.
        amarillo = amarillo or r("A3_1") == "no_se" or (
            r("A3_1") in ("privado", "comunidad") and r("A3_2") == "no"
        )

    elif perfil == "B":
        clasif = clasificacion_de(perfil, respuestas)
        reloj = reloj_produccion(perfil, respuestas, clasif, hoy)
        if r("B1_1") == "debo_2_mas":
            bloqueantes.append("riesgo_caducidad_vigencia")
        if r("B1_3") == "no_pago":
            bloqueantes.append("penalidad_impaga")
        # Terreno superficial: aplica a todo Perfil B (no solo a quien ya
        # decidió operar él mismo) — sin acuerdo no se puede empezar a
        # operar de ninguna forma (ni solo, ni cediendo, ni con inversionista).
        terreno_pendiente = r("B1_4") == "no_se" or (
            r("B1_4") in ("privado", "comunidad") and r("B1_5") == "no"
        )
        amarillo = (
            r("B1_1") in ("debo_1", "no_se")
            or r("B2_1") in ("no_tengo", "no_se")
            or clasif == "no_califica"
            or (reloj is not None and reloj["vencido"] and r("B1_3") != "pago")
            or terreno_pendiente
            or (
                r("B4_1") == "operar_yo"
                and (
                    r("B5_1") != "aprobado"
                    or r("B5_3") in ("en_tramite", "no")
                    or r("B5_4") in ("no", "no_sabia")
                )
            )
        )

    elif perfil == "C":
        if r("C1_1") == "suspendida":
            bloqueantes.append("reinfo_suspendido")
        urgencia = urgencia_reinfo(perfil, respuestas, hoy)
        if urgencia and urgencia["alerta_roja"]:
            bloqueantes.append("plazo_reinfo_critico")
        amarillo = (
            r("C1_2") != "si"
            or any(r(i) != "aprobado" for i in IDS_DOCS_C2)
            or r("C3_1") in ("firmado_sin_inscribir", "en_negociacion", "se_niega", "no_he_hablado")
        )

    else:  # Perfil D
        amarillo = (
            r("D1_1") in ("no", "no_se")
            or r("D1_2") == "pago_penalidad"
            or r("D1_3") in ("no", "no_se")
            or r("D1_4") in ("con_observaciones", "con_multas")
        )

    if bloqueantes:
        return "rojo", bloqueantes
    return ("amarillo" if amarillo else "verde"), []


def brechas_de(respuestas: dict[str, str]) -> list[str]:
    """Estudios accionables que generan las respuestas (matching de
    empresas). Varias preguntas pueden colapsar en el mismo estudio."""
    encontradas = {
        estudio
        for id_pregunta, (valores, estudio) in BRECHA_POR_PREGUNTA.items()
        if respuestas.get(id_pregunta) in valores
    }
    return sorted(encontradas)


def salidas_de(
    perfil: str,
    respuestas: dict[str, str],
    color_legal: str,
    urgencia: dict | None,
    reloj: dict | None,
) -> list[str]:
    """Códigos de las tarjetas de salida de cada módulo (spec). El frontend
    tiene el copy de cada una. Orden = SOBREVIVIR → ORDENAR → CRECER."""
    salidas: list[str] = []
    r = respuestas.get

    if perfil in ("A", "A_avanzado"):
        if color_legal == "rojo":
            salidas.append("area_no_concesionable")
        elif color_legal == "amarillo":
            salidas.append("verificar_area")
        else:
            salidas.append("checklist_petitorio")
        if r("A4_1") in ("parcial", "no"):
            salidas.append("ruta_inversionista")

    elif perfil == "B":
        if "riesgo_caducidad_vigencia" in ETIQUETA_BLOQUEANTE and r("B1_1") == "debo_2_mas":
            salidas.append("alerta_caducidad")
        if reloj is not None and reloj["vencido"]:
            salidas.append("alerta_produccion_minima")
        if r("B4_1") == "operar_yo":
            salidas.append("checklist_permisos")
        elif r("B4_1") == "ceder_contrato":
            salidas.append("guia_cesion")
        if r("B4_1") in ("buscar_inversionista", "no_se"):
            salidas.append("ruta_inversionista")

    elif perfil == "C":
        if r("C1_1") == "suspendida":
            salidas.append("subsanar_suspension")
        if urgencia and urgencia["docs_pendientes"] > 0:
            salidas.append("ruta_critica_documentos")
        if r("C3_1") == "se_niega":
            salidas.append("asesoria_legal_titular")
        # "Ya produces + avance documentario = perfil atractivo": vende con
        # liquidación y tiene la mayoría de documentos encaminados.
        if (
            color_legal != "rojo"
            and r("C4_2") == "siempre"
            and urgencia is not None
            and urgencia["docs_completados"] >= 4
        ):
            salidas.append("ruta_inversionista")

    else:  # Perfil D
        if color_legal == "amarillo":
            salidas.append("alertas_cumplimiento")
        if r("D2_2") == "inversion":
            salidas.append("ruta_inversionista")

    return salidas


def calcular_diagnostico(respuestas: dict[str, str], hoy: date | None = None) -> dict:
    """Diagnóstico completo desde las respuestas. Valida (ValueError si el
    set de ids no calza — ver catalogo_diagnostico.validar_respuestas) y
    devuelve todos los campos derivados del spec."""
    hoy = hoy or date.today()
    perfil = validar_respuestas(respuestas)

    clasif = clasificacion_de(perfil, respuestas)
    color_legal, bloqueantes = semaforo_legal(perfil, respuestas, hoy)
    madurez = indice_madurez(perfil, respuestas)
    color_tecnico = semaforo_tecnico(madurez)
    urgencia = urgencia_reinfo(perfil, respuestas, hoy)
    reloj = reloj_produccion(perfil, respuestas, clasif, hoy)

    # Regla de bloqueo del spec: nunca presentar inversionistas a quien
    # tiene un incendio legal activo. Perfil A no publica (sin proyecto).
    apto = perfil in ("B", "C", "D") and color_legal != "rojo"

    return {
        "perfil": perfil,
        "clasificacion": clasif,
        "semaforo_legal": color_legal,
        "bloqueantes": bloqueantes,
        "etiquetas_bloqueantes": [ETIQUETA_BLOQUEANTE[b] for b in bloqueantes],
        "semaforo_tecnico": color_tecnico,
        "indice_madurez": madurez,
        "riesgo_caducidad": any(
            b in ("riesgo_caducidad_vigencia", "penalidad_impaga") for b in bloqueantes
        ),
        "apto_inversionistas": apto,
        "urgencia": urgencia,
        "reloj_produccion": reloj,
        "brechas": brechas_de(respuestas),
        "salidas": salidas_de(perfil, respuestas, color_legal, urgencia, reloj),
    }


def respuestas_con_brechas_resueltas(
    respuestas: dict[str, str], brechas_resueltas: list[str]
) -> dict[str, str]:
    """Copia de las respuestas con cada brecha resuelta por el admin
    parcheada a su "valor bueno" (VALOR_RESUELTO_POR_PREGUNTA) — la
    declaración original nunca se muta. Un estudio puede venir de varias
    preguntas: se parchean todas las presentes."""
    actualizadas = dict(respuestas)
    for estudio in brechas_resueltas:
        for id_pregunta in PREGUNTAS_POR_ESTUDIO.get(estudio, []):
            if id_pregunta in actualizadas:
                actualizadas[id_pregunta] = VALOR_RESUELTO_POR_PREGUNTA[id_pregunta]
    return actualizadas


def estado_seguimiento(operacion, hoy: date | None = None) -> dict:
    """Estado ACTUAL de una operación: recalcula el diagnóstico con las
    brechas que el admin marcó resueltas, sin tocar la declaración original.
    Filas del modelo anterior (perfil NULL / respuestas con ids viejos) no
    se pueden recalcular → derivados en None y brechas tal como quedaron.
    Se recalcula en CADA lectura porque la urgencia C5 cambia con el tiempo."""
    resueltas = sorted(operacion.brechas_resueltas_json or [])
    pendientes = sorted(set(operacion.brechas_json or []) - set(resueltas))
    base = {
        "brechas_resueltas": resueltas,
        "brechas_pendientes": pendientes,
    }
    try:
        parcheadas = respuestas_con_brechas_resueltas(
            operacion.respuestas_json or {}, resueltas
        )
        resultado = calcular_diagnostico(parcheadas, hoy)
    except (ValueError, TypeError, AttributeError):
        # Diagnóstico de un formato anterior: sin recálculo posible.
        return {
            **base,
            "perfil": getattr(operacion, "perfil", None),
            "clasificacion": None,
            "semaforo_legal": None,
            "bloqueantes": [],
            "etiquetas_bloqueantes": [],
            "semaforo_tecnico": None,
            "indice_madurez": None,
            "riesgo_caducidad": False,
            "apto_inversionistas": False,
            "urgencia": None,
            "reloj_produccion": None,
            "salidas": [],
        }
    resultado.pop("brechas", None)  # las brechas vigentes son `pendientes`
    return {**base, **resultado}


def score_formalizacion_para_inversion(seguimiento: dict) -> int:
    """Deriva un score 0-100 de formalización a partir del semáforo_legal
    del nuevo sistema, para pasarlo como `score_formalizacion` al
    scoring_legacy.calcular_score_inversion que sigue alimentando las
    dimensiones de Atractivo de Inversión."""
    sem = seguimiento.get("semaforo_legal")
    if sem == "verde":
        return 80
    if sem == "amarillo":
        return 50
    if sem == "rojo":
        return 20
    return 0

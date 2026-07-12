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
    ANIO_PRODUCCION_MINIMA_PMA,
    ANIO_PRODUCCION_MINIMA_PPM,
    BRECHA_POR_PREGUNTA,
    FECHA_LIMITE_REINFO,
    PREGUNTAS_POR_ESTUDIO,
    VALOR_RESUELTO_POR_PREGUNTA,
    clasificacion_b,
    clasificar_perfil,
    ids_esperados,
    validar_respuestas,
)
from uploads_config import CATEGORIAS_DOCUMENTO, CATEGORIAS_INVERSION, categoria_equivalente

# Supuestos de negocio del cálculo de urgencia C5 (días que suele tomar un
# documento según su estado) — PENDIENTE DE CALIBRAR con Esthiven.
DIAS_TRAMITE_DOC_NO_INICIADO = 60
DIAS_EVALUACION_DOC_PRESENTADO = 30

IDS_DOCS_C2 = tuple(f"C2_{n}" for n in range(1, 8))


def _ids_docs_c2_aplicables(respuestas: dict[str, str]) -> tuple[str, ...]:
    """C2_7 (declaración de producción semestral) no aplica al titular de
    su propia concesión (exceptuado por ley) — se excluye del checklist
    para que no cuente como pendiente eternamente (ver
    catalogo_diagnostico.ids_esperados)."""
    if respuestas.get("C1_3") == "titular":
        return tuple(i for i in IDS_DOCS_C2 if i != "C2_7")
    return IDS_DOCS_C2

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
    (PMA ≤ 1,000 ha; PPM ≤ 2,000; más → régimen general) — ver
    catalogo_diagnostico.clasificacion_b (se necesita también en
    ids_esperados para saber si B1_3 aplica, así que vive ahí). C/D ya la
    tienen fijada por su trámite → None (no se pregunta)."""
    if perfil in ("A", "A_avanzado"):
        return {"manual": "pma", "maquinaria": "ppm"}.get(respuestas.get("A5_1"))
    if perfil != "B":
        return None
    return clasificacion_b(respuestas)


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
    ids_docs = _ids_docs_c2_aplicables(respuestas)
    dias_restantes = (FECHA_LIMITE_REINFO - hoy).days
    no_iniciados = sum(
        1 for i in ids_docs if respuestas.get(i) in ("no_iniciado", "no_se")
    )
    presentados = sum(1 for i in ids_docs if respuestas.get(i) == "presentado")
    if respuestas.get("C1_2") != "si":
        no_iniciados += 1  # sinceramiento de coordenadas pendiente
    docs_pendientes = no_iniciados + presentados
    dias_necesarios = (
        no_iniciados * DIAS_TRAMITE_DOC_NO_INICIADO
        + presentados * DIAS_EVALUACION_DOC_PRESENTADO
    )
    return {
        "dias_restantes": dias_restantes,
        "docs_completados": sum(1 for i in ids_docs if respuestas.get(i) == "aprobado"),
        "docs_totales": len(ids_docs),
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
            or any(r(i) != "aprobado" for i in _ids_docs_c2_aplicables(respuestas))
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
        elif perfil == "A":
            salidas.append("checklist_petitorio")
        elif r("A4_1") in ("parcial", "no"):
            # A_avanzado ya inició el trámite ante INGEMMET — no tiene
            # sentido decirle "arma tu petitorio" desde cero (ese mensaje es
            # de Perfil A). Si le faltan documentos se lo decimos puntual;
            # si ya tiene todo (A4_1="completo") no hay nada que agregar,
            # su trámite sigue su curso normal.
            salidas.append("completar_tramites_petitorio")
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
    perfil = validar_respuestas(respuestas, hoy)

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


def respuestas_diagnostico_efectivas(operacion) -> dict:
    """Respuestas del diagnóstico con las brechas que el admin ya marcó
    resueltas parcheadas a su valor bueno — para todo lo que deba
    reaccionar cuando el admin resuelve algo manualmente (ej. activación
    del Módulo INV bloqueada por `catalogo_inversion.activacion_inversion`
    mientras el titular de la concesión se niega a firmar el contrato,
    C3_1="se_niega" — el mismo mecanismo de `brechas_resueltas_json` que ya
    usa `estado_seguimiento()` es el que lo desbloquea, sin construir un
    flujo de aprobación aparte)."""
    return respuestas_con_brechas_resueltas(
        operacion.respuestas_json or {}, operacion.brechas_resueltas_json or []
    )


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
    # "Apto para inversionistas" (gate de /proyectos) ahora exige TAMBIÉN que
    # Esthiven haya dado el visto bueno del Módulo INV — cumplir el semáforo
    # legal ya no basta por sí solo para aparecer en la cartera pública; si
    # el minero no completó y le aprobaron su perfil de inversión, no se
    # publica (julio 2026).
    resultado["apto_inversionistas"] = bool(
        resultado["apto_inversionistas"] and operacion.inv_visto_bueno
    )
    return {**base, **resultado}


def estudios_aplicables(operacion) -> list[dict]:
    """Estudios que el minero declaró SÍ tener (respondió Sí, o el admin
    marcó la brecha como resuelta después) — para que "Respalda tu
    declaración" solo le pida foto de lo que realmente tiene, no de todo
    el catálogo de su ruta. Pedirle que suba prueba de algo que ya dijo
    que NO tiene no tiene sentido y solo lo satura de archivos.

    Devuelve además `pregunta_id` y `valor` (la respuesta cruda, ej.
    "en_tramite") para que la UI muestre justo al lado del slot lo que el
    minero marcó en el diagnóstico — el frontend traduce ese valor a su
    etiqueta legible con el mismo catálogo del cuestionario (data/preguntas.ts).

    Tampoco se listan los estudios que en la práctica piden la MISMA foto
    que ya se pide en "Documentos legales" u otro estudio (ver
    `uploads_config.categoria_equivalente`) — evita pedir la misma foto
    dos veces con nombres distintos.

    Vive en scoring.py (no en routers/mineros.py) porque routers/admin.py
    también la necesita, para validar el visto bueno de documentos, y un
    router nunca debe importar de otro router."""
    situacion = operacion.situacion or "minero_artesanal"
    respuestas = operacion.respuestas_json or {}
    try:
        ids = ids_esperados(respuestas)
    except (ValueError, TypeError):
        # Diagnóstico del modelo anterior: sin catálogo con que cruzar.
        return []
    pendientes = set(estado_seguimiento(operacion)["brechas_pendientes"])
    vistos: set[str] = set()
    resultado: list[dict] = []
    for id_pregunta in sorted(ids):
        if id_pregunta not in BRECHA_POR_PREGUNTA:
            continue
        _valores_malos, estudio = BRECHA_POR_PREGUNTA[id_pregunta]
        if estudio in vistos or estudio in pendientes:
            continue
        if categoria_equivalente(estudio, situacion) is not None:
            continue
        valor = respuestas.get(id_pregunta)
        if valor is None:
            continue
        vistos.add(estudio)
        resultado.append({"codigo": estudio, "pregunta_id": id_pregunta, "valor": valor})
    return sorted(resultado, key=lambda r: r["codigo"])


def _etiqueta_categoria_documento(categoria: str) -> str:
    if categoria in CATEGORIAS_DOCUMENTO:
        return CATEGORIAS_DOCUMENTO[categoria][1]
    if categoria in CATEGORIAS_INVERSION:
        return CATEGORIAS_INVERSION[categoria][1]
    return categoria


def categorias_requeridas_out(operacion, categorias: list[str]) -> list[dict]:
    """Para cada categoría requerida (formalización o Módulo INV), si ya
    tiene un documento aprobado — misma forma que usan tanto
    `visto-bueno-documentos` como `visto-bueno-inversion` para decidir si
    el botón está listo."""
    aprobadas = {
        d.categoria for d in (operacion.documentos or []) if d.estado_revision == "aprobado"
    }
    return [
        {
            "categoria": c,
            "etiqueta": _etiqueta_categoria_documento(c),
            "aprobado": c in aprobadas,
        }
        for c in categorias
    ]


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

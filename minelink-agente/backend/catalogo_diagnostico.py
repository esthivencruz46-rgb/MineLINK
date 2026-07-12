"""Catálogo del diagnóstico de formalización (perfiles A/B/C/D).

Fuente de verdad: context/diagnostico_formalizacion.md (spec de Esthiven,
julio 2026). Este módulo define QUÉ se pregunta (ids, tipos, valores
válidos, condiciones de aparición) y los mapas brecha→estudio; la lógica
de clasificación/semáforos vive en scoring.py.

Convenciones de ids: `<Módulo><Bloque>_<orden>` sin puntos (M0_1, A2_1,
C2_3...). El frontend (data/modulos.ts) es un espejo EXACTO de este
catálogo — cualquier desfase produce 422 en POST /diagnostico.
"""

from datetime import date

# Plazo legal de culminación del REINFO (Módulo C, bloque C5). Si la ley
# cambia el plazo, actualizar aquí y en context/diagnostico_formalizacion.md.
FECHA_LIMITE_REINFO = date(2026, 12, 31)

# Límites legales de extensión y del reloj de producción mínima (Perfil B):
# PMA corre desde el año 10 del título, PPM desde el año 6. Viven aquí (no
# solo en scoring.py) porque ids_esperados() los necesita para decidir si
# B1_3 (penalidad) tiene sentido preguntar — antes de saber si el reloj ya
# venció no se le puede pedir que declare si pagó una penalidad.
HECTAREAS_MAX_PMA = 1_000
HECTAREAS_MAX_PPM = 2_000
ANIO_PRODUCCION_MINIMA_PMA = 10
ANIO_PRODUCCION_MINIMA_PPM = 6

PERFILES = ("A", "A_avanzado", "B", "C", "D")

TIPOS_PREGUNTA = ("opcion", "numero", "anio", "estado_doc")

# Los 4 estados del checklist C2 (los 7 requisitos de culminación)
ESTADOS_DOC = ("aprobado", "presentado", "no_iniciado", "no_se")

# id → (tipo, valores válidos). Para "numero"/"anio" el segundo elemento es
# (min, max). Los textos visibles viven en el frontend (data/modulos.ts).
PREGUNTAS: dict[str, tuple] = {
    # ---------- Módulo 0: ubicación ----------
    # M0_1 ya define si opera o no (no se vuelve a preguntar): concesion_propia
    # = tiene concesión y opera; concesion_no_operando = tiene concesión
    # (propia o por contrato) pero todavía no opera → deriva directo a
    # Perfil B, sin pasar por REINFO (M0_3/M0_4 no le aplican).
    "M0_1": ("opcion", ("concesion_propia", "concesion_no_operando", "petitorio_tramite", "nada")),
    # M0_3 pregunta la situación de formalización general PRIMERO — no todo
    # el que opera necesita REINFO: quien ya es formal (título + permisos
    # completos) nunca pasó ni necesita pasar por REINFO, ese registro es
    # solo el paso intermedio para quien está formalizándose. Antes se
    # preguntaba directo "¿tu REINFO está vigente/suspendido?" y "no tengo
    # REINFO" caía en sin_ruta (ilegal) — eso clasificaba mal a un formal
    # pleno. "no_se" en M0_4 es SOLO de UI (micro-guía MINEM), no se envía.
    "M0_3": ("opcion", ("formal", "reinfo", "no")),
    "M0_4": ("opcion", ("vigente", "suspendido")),          # solo si M0_3 == "reinfo"

    # ---------- Módulo A: desde cero (quiere concesión) ----------
    "A1_1": ("opcion", ("si", "no")),                     # ¿área identificada?
    "A1_2": ("opcion", ("si", "no", "no_se_como")),       # ¿verificada en GEOCATMIN?
    "A1_3": ("opcion", ("si", "no")),                     # ¿coordenadas UTM?
    "A2_1": ("opcion", ("anp", "arqueologica", "urbana", "cauce_rio", "frontera", "ninguna", "no_se")),
    "A2_2": ("opcion", ("si", "no")),                     # ¿dragas en cuerpos de agua?
    "A3_1": ("opcion", ("mio", "privado", "comunidad", "estado", "no_se")),
    "A3_2": ("opcion", ("si", "no")),                     # ¿ya conversaste? (si tercero/comunidad)
    "A4_1": ("opcion", ("completo", "parcial", "no")),    # ¿cubres petitorio+vigencia+trámites?
    "A4_2": ("opcion", ("si", "no", "tal_vez")),          # ¿te asociarías con un inversionista?
    "A5_1": ("opcion", ("manual", "maquinaria", "no_se")),
    "A5_2": ("opcion", ("oro", "cobre", "polimetalico", "no_metalico", "otro")),

    # ---------- Módulo B: concesionario sin operar ----------
    "B1_1": ("opcion", ("al_dia", "debo_1", "debo_2_mas", "no_se")),
    "B1_2": ("anio", (1950, None)),                       # año del título (None = año actual)
    # Solo se pregunta si el reloj de producción (según B2_1/B2_2 + B1_2) ya
    # venció — "aun_no_toca" ya no es una opción posible: si el reloj no
    # venció, esta pregunta directamente no se incluye en ids_esperados().
    "B1_3": ("opcion", ("pago", "no_pago", "no_se")),
    # Terreno superficial (subsuelo ≠ superficie, igual que A3_1/A3_2):
    # aplica a todos los de Perfil B, no solo a quien ya decidió operar él
    # mismo — sin esto resuelto no se puede empezar a operar de ninguna forma.
    "B1_4": ("opcion", ("mio", "privado", "comunidad", "estado", "no_se")),
    "B1_5": ("opcion", ("si", "no")),                     # ¿ya conversaste con el dueño?
    "B2_1": ("opcion", ("pma", "ppm", "no_tengo", "no_se")),
    "B2_2": ("numero", (1, 100000)),                      # hectáreas
    # ⏸️ EN PAUSA (julio 2026): B3_1/B3_2 son de inversión (estudios
    # geológicos/laboratorio), no de formalización — Esthiven pidió sacarlas
    # del formulario actual; van a un grupo aparte que definirá más adelante.
    # No borrar: quedan fuera de ids_esperados() pero el catálogo se conserva.
    "B3_1": ("opcion", ("estudios_formales", "referencias", "no")),
    "B3_2": ("opcion", ("laboratorio", "artesanal", "no")),
    "B4_1": ("opcion", ("operar_yo", "ceder_contrato", "buscar_inversionista", "no_se")),
    "B5_1": ("opcion", ("aprobado", "en_tramite", "no_iniciado", "no_se")),   # DIA / EIA-sd
    "B5_3": ("opcion", ("si", "en_tramite", "no", "no_usa_agua")),            # licencia agua ANA
    "B5_4": ("opcion", ("si", "no", "no_sabia")),                             # autorización DREM/GREM

    # ---------- Módulo C: REINFO (opera y formaliza) ----------
    "C1_1": ("opcion", ("vigente", "suspendida")),        # prellenada de M0_4, no se repregunta
    "C1_2": ("opcion", ("si", "no", "no_se")),            # sinceramiento coordenadas Ley 32537
    # Ya no se deriva de M0_1 (que ahora solo distingue operando/no operando)
    # — se pregunta directo aquí porque solo aplica a quien opera con REINFO.
    "C1_3": ("opcion", ("titular", "contrato")),          # ¿titular o por contrato/cesión?
    "C2_1": ("estado_doc", ESTADOS_DOC),                  # IGAFOM/IGAC
    "C2_2": ("estado_doc", ESTADOS_DOC),                  # terreno superficial
    "C2_3": ("estado_doc", ESTADOS_DOC),                  # titularidad/cesión/contrato SUNARP
    "C2_4": ("estado_doc", ESTADOS_DOC),                  # DJ restos arqueológicos
    "C2_5": ("estado_doc", ESTADOS_DOC),                  # expediente técnico
    "C2_6": ("estado_doc", ESTADOS_DOC),                  # RUC activo 3ª categoría
    "C2_7": ("estado_doc", ESTADOS_DOC),                  # declaración producción semestral
    "C3_1": ("opcion", ("firmado_inscrito", "firmado_sin_inscribir", "en_negociacion", "se_niega", "no_he_hablado")),
    "C4_1": ("opcion", ("menos_10t", "10_50t", "50_100t", "mas_100t", "prefiero_no_decir")),
    "C4_2": ("opcion", ("siempre", "a_veces", "nunca")),

    # ---------- Módulo D: formal pleno ----------
    "D1_1": ("opcion", ("si", "no", "no_se")),            # vigencia al día
    "D1_2": ("opcion", ("si", "en_plazo", "pago_penalidad")),
    "D1_3": ("opcion", ("si", "no", "no_se")),            # DAC presentada
    "D1_4": ("opcion", ("sin_observaciones", "con_observaciones", "con_multas")),
    "D2_1": ("opcion", ("ampliar", "nueva_concesion", "planta_propia", "mantenerme")),
    "D2_2": ("opcion", ("autofinanciado", "inversion", "credito", "no_pensado")),

    # ---------- Módulo INV: índice de madurez (transversal B/C/D) ----------
    # ⏸️ EN PAUSA (julio 2026): preguntas de inversión (estudios/reservas/
    # OPEX), no de formalización — Esthiven pidió sacarlas del formulario
    # actual y las agrupará aparte más adelante. No borrar: fuera de
    # ids_esperados() (nunca se piden ni se aceptan), indice_madurez()
    # devuelve None para todos los perfiles mientras tanto.
    "INV_1": ("opcion", ("si", "no")),                    # mapeo geológico
    "INV_2": ("opcion", ("si", "no")),                    # muestreo con laboratorio
    "INV_3": ("opcion", ("si", "no")),                    # estimación de recursos
    "INV_4": ("opcion", ("si", "no")),                    # OPEX documentado
    "INV_5": ("opcion", ("si", "no")),                    # producción histórica con liquidaciones
}


def clasificar_perfil(respuestas: dict[str, str]) -> str:
    """Ruteo del Módulo 0 (tabla del spec). Devuelve el perfil o "sin_ruta".
    Lanza ValueError si el módulo 0 está incompleto o con valores inválidos."""
    m0_1 = respuestas.get("M0_1")
    if m0_1 == "nada":
        return "A"
    if m0_1 == "petitorio_tramite":
        return "A_avanzado"
    if m0_1 == "concesion_no_operando":
        return "B"
    if m0_1 != "concesion_propia":
        raise ValueError("M0_1 es obligatorio y debe ser una opción válida")

    m0_3 = respuestas.get("M0_3")
    if m0_3 == "no":
        return "sin_ruta"
    if m0_3 == "formal":
        return "D"
    if m0_3 != "reinfo":
        raise ValueError("M0_3 es obligatorio cuando está operando")

    m0_4 = respuestas.get("M0_4")
    if m0_4 in ("vigente", "suspendido"):
        return "C"
    raise ValueError("M0_4 es obligatorio cuando está inscrito en REINFO")


def clasificacion_b(respuestas: dict[str, str]) -> str | None:
    """PMA / PPM / no_califica del Perfil B según hectáreas declaradas
    (B2_1/B2_2) — más de 2,000 ha no es válida (régimen general); más de
    1,000 declarada como PMA en la práctica es PPM. También la usa
    scoring.clasificacion_de para no duplicar la regla."""
    try:
        hectareas = int(respuestas.get("B2_2", ""))
    except (TypeError, ValueError):
        hectareas = None
    declarada = respuestas.get("B2_1")
    if hectareas is not None and hectareas > HECTAREAS_MAX_PPM:
        return "no_califica"
    if declarada == "pma":
        if hectareas is not None and hectareas > HECTAREAS_MAX_PMA:
            return "ppm"
        return "pma"
    if declarada == "ppm":
        return "ppm"
    return None


def _reloj_vencido(respuestas: dict[str, str], hoy: date) -> bool:
    """True si el reloj de producción mínima ya venció (año del título +
    el límite de su clasificación ya pasó) — solo entonces B1_3 (¿ya
    pagaste la penalidad?) tiene sentido preguntar. Sin clasificación
    conocida se usa el límite más estricto (PPM, 6 años), igual que
    scoring.reloj_produccion."""
    try:
        anio_titulo = int(respuestas.get("B1_2", ""))
    except (TypeError, ValueError):
        return False
    limite = (
        ANIO_PRODUCCION_MINIMA_PMA
        if clasificacion_b(respuestas) == "pma"
        else ANIO_PRODUCCION_MINIMA_PPM
    )
    return (hoy.year - anio_titulo) >= limite


def ids_esperados(respuestas: dict[str, str], hoy: date | None = None) -> set[str]:
    """Set EXACTO de ids aplicables dadas las respuestas (los condicionales
    dependen de respuestas ya presentes — determinista salvo B1_3, que
    depende también de la fecha). Incluye el módulo 0. Espejo conceptual de
    pantallasAplicables() en el frontend."""
    hoy = hoy or date.today()
    perfil = clasificar_perfil(respuestas)
    ids = {"M0_1"}
    if respuestas.get("M0_1") == "concesion_propia":
        ids.add("M0_3")
        if respuestas.get("M0_3") == "reinfo":
            ids.add("M0_4")

    if perfil == "sin_ruta":
        return ids

    if perfil in ("A", "A_avanzado"):
        if perfil == "A":
            ids.add("A1_1")
            # Sin área identificada no hay nada que verificar todavía —
            # el resultado deriva a la guía GEOCATMIN.
            if respuestas.get("A1_1") == "si":
                ids.update({"A1_2", "A1_3", "A2_1", "A2_2"})
        # A_avanzado (petitorio en trámite): el área ya está fijada y pasó
        # el filtro inicial de INGEMMET — se omiten A1/A2.
        ids.add("A3_1")
        if respuestas.get("A3_1") in ("privado", "comunidad"):
            ids.add("A3_2")
        ids.add("A4_1")
        if respuestas.get("A4_1") in ("parcial", "no"):
            ids.add("A4_2")
        ids.update({"A5_1", "A5_2"})
        return ids

    if perfil == "B":
        # Orden con sentido: primero vigencia, LUEGO la clasificación PMA/PPM
        # (B2_1/B2_2) y el año del título — B1_3 (penalidad) recién se
        # pregunta si con esos datos el reloj de producción ya venció; antes
        # de eso no hay penalidad posible que declarar (B3_1/B3_2, estudios
        # geológicos/laboratorio, y el Módulo INV están en pausa aparte).
        ids.update({"B1_1", "B2_1", "B2_2", "B1_2", "B1_4", "B4_1"})
        if respuestas.get("B1_2") and _reloj_vencido(respuestas, hoy):
            ids.add("B1_3")
        if respuestas.get("B1_4") in ("privado", "comunidad"):
            ids.add("B1_5")
        if respuestas.get("B4_1") == "operar_yo":
            ids.update({"B5_1", "B5_3", "B5_4"})
        return ids

    if perfil == "C":
        ids.update({"C1_1", "C1_2", "C1_3"})
        ids.update({f"C2_{n}" for n in range(1, 7)})
        # C2_7 (declaración de producción semestral) solo aplica a quien
        # opera por contrato/cesión — el titular de su propia concesión
        # está exceptuado por ley (Art. 7c, D.S. N°001-2020-EM).
        if respuestas.get("C1_3") != "titular":
            ids.add("C2_7")
        # C3 solo si opera en concesión ajena (por contrato/cesión); el
        # titular de su propia concesión no necesita contrato consigo mismo.
        if respuestas.get("C1_3") == "contrato":
            ids.add("C3_1")
        ids.update({"C4_1", "C4_2"})
        return ids

    # Perfil D
    ids.update({"D1_1", "D1_2", "D1_3", "D1_4", "D2_1", "D2_2"})
    return ids


def validar_respuestas(respuestas: dict[str, str], hoy: date | None = None) -> str:
    """Valida el diagnóstico completo: perfil resoluble, set exacto de ids,
    y cada valor dentro de su catálogo/rango. Devuelve el perfil.
    Lanza ValueError con mensaje legible si algo no calza."""
    hoy = hoy or date.today()
    perfil = clasificar_perfil(respuestas)
    if perfil == "sin_ruta":
        raise ValueError(
            "Sin ruta legal (opera sin REINFO): este caso no registra "
            "diagnóstico — el frontend muestra la página informativa"
        )

    esperados = ids_esperados(respuestas, hoy)
    if set(respuestas.keys()) != esperados:
        raise ValueError(
            f"Para el perfil {perfil} deben venir exactamente estos ids: "
            f"{sorted(esperados)}"
        )

    for id_pregunta, valor in respuestas.items():
        tipo, regla = PREGUNTAS[id_pregunta]
        if tipo in ("opcion", "estado_doc"):
            if valor not in regla:
                raise ValueError(f"{id_pregunta}: '{valor}' no es una opción válida")
        else:  # numero | anio
            minimo, maximo = regla
            if maximo is None:
                maximo = hoy.year
            try:
                numero = int(valor)
            except (TypeError, ValueError):
                raise ValueError(f"{id_pregunta}: debe ser un número entero")
            if not (minimo <= numero <= maximo):
                raise ValueError(f"{id_pregunta}: debe estar entre {minimo} y {maximo}")

    return perfil


# ---------------------------------------------------------------------------
# Brechas: respuesta → estudio del catálogo (matching con empresas).
# id → (valores que generan la brecha, código de estudio). "presentado"
# (en evaluación) NO es brecha accionable — ya hay un trámite en curso.
# ---------------------------------------------------------------------------

BRECHA_POR_PREGUNTA: dict[str, tuple[set[str], str]] = {
    # Módulo A
    "A1_3": ({"no"}, "levantamiento_georreferenciado"),
    "A3_1": ({"no_se"}, "acreditacion_terreno"),
    "A3_2": ({"no"}, "acreditacion_terreno"),
    # Documentos del petitorio incompletos — sobre todo relevante para
    # A_avanzado (ya inició trámite ante INGEMMET, ver salidas_de en
    # scoring.py: "completar_tramites_petitorio" en vez de repetirle el
    # checklist desde cero).
    "A4_1": ({"parcial", "no"}, "elaboracion_petitorio"),
    # Módulo B
    "B1_1": ({"debo_1", "debo_2_mas"}, "vigencia_concesion"),
    # B2_1 (PMA/PPM) no tenía estudio asociado — sin él, nadie podía
    # respaldar su clasificación con la Declaración Bienal ante la
    # autoridad minera regional que la acredita.
    "B2_1": ({"no_tengo", "no_se"}, "declaracion_bienal_pma_ppm"),
    "B1_4": ({"no_se"}, "acreditacion_terreno"),
    "B1_5": ({"no"}, "acreditacion_terreno"),
    # B3_1/B3_2 ⏸️ en pausa (fuera de ids_esperados, ver PREGUNTAS arriba) —
    # se dejan aquí solo para que informe_geologico/analisis_laboratorio
    # sigan siendo categorías válidas de estudio/empresa; nunca disparan.
    "B3_1": ({"referencias", "no"}, "informe_geologico"),
    "B3_2": ({"artesanal", "no"}, "analisis_laboratorio"),
    "B5_1": ({"en_tramite", "no_iniciado", "no_se"}, "instrumento_ambiental_dia_eia"),
    "B5_3": ({"en_tramite", "no"}, "licencia_agua_ana"),
    "B5_4": ({"no", "no_sabia"}, "autorizacion_inicio_actividades"),
    # Módulo C
    "C1_1": ({"suspendida"}, "tramite_reinfo"),
    "C1_2": ({"no", "no_se"}, "levantamiento_georreferenciado"),
    "C2_1": ({"no_iniciado", "no_se"}, "igafom_aprobado"),
    "C2_2": ({"no_iniciado", "no_se"}, "acreditacion_terreno"),
    "C2_3": ({"no_iniciado", "no_se"}, "contrato_explotacion"),
    "C2_4": ({"no_iniciado", "no_se"}, "dj_arqueologica"),
    "C2_5": ({"no_iniciado", "no_se"}, "expediente_tecnico"),
    "C2_6": ({"no_iniciado", "no_se"}, "tramite_sunat"),
    "C2_7": ({"no_iniciado", "no_se"}, "declaracion_produccion_semestral"),
    "C3_1": (
        {"firmado_sin_inscribir", "en_negociacion", "se_niega", "no_he_hablado"},
        "contrato_explotacion",
    ),
    # Módulo D
    "D1_1": ({"no", "no_se"}, "vigencia_concesion"),
    "D1_2": ({"pago_penalidad"}, "puesta_en_produccion"),
    "D1_3": ({"no", "no_se"}, "declaracion_anual_consolidada"),
    "D1_4": ({"con_observaciones", "con_multas"}, "subsanacion_fiscalizacion"),
    # Módulo INV ⏸️ en pausa (idem B3_1/B3_2): se conservan solo para que
    # sus estudios sigan siendo categorías válidas, nunca disparan.
    "INV_1": ({"no"}, "informe_geologico"),
    "INV_2": ({"no"}, "analisis_laboratorio"),
    "INV_3": ({"no"}, "estimacion_recursos"),
    "INV_4": ({"no"}, "costos_opex"),
    "INV_5": ({"no"}, "documentacion_operacion"),
}

# Estudios que puede generar el diagnóstico nuevo (slots de "Respalda tu
# declaración" + matching).
ESTUDIOS_DIAGNOSTICO: set[str] = {e for _v, e in BRECHA_POR_PREGUNTA.values()}

# Estudios del catálogo ANTERIOR que ya no nacen de ninguna pregunta pero
# se conservan: las empresas pueden seguir ofreciéndolos y los documentos
# ya subidos con esas categorías se siguen sirviendo.
ESTUDIOS_LEGACY: set[str] = {
    "titularidad_concesion", "iperc", "sctr", "plan_seguridad",
    "evaluacion_geomecanica", "estudio_ventilacion", "plan_manejo_residuos",
    "muestreo_geoquimico", "planos_geologicos", "levantamiento_topografico",
    "gestion_conflictividad_social", "instrumento_ambiental_vigente",
    "sin_clausura_ambiental",
}

# estudio → preguntas que lo generan (para el seguimiento del admin)
PREGUNTAS_POR_ESTUDIO: dict[str, list[str]] = {}
for _id, (_valores, _estudio) in BRECHA_POR_PREGUNTA.items():
    PREGUNTAS_POR_ESTUDIO.setdefault(_estudio, []).append(_id)

# Cuando el admin marca una brecha como resuelta, cada pregunta que la
# generaba se parchea a su "valor bueno" y se recalcula todo (semáforos,
# madurez, checklist) — mismo patrón de seguimiento que el sistema anterior.
VALOR_RESUELTO_POR_PREGUNTA: dict[str, str] = {
    "A1_3": "si",
    "A3_1": "mio",
    "A3_2": "si",
    "A4_1": "completo",
    "B1_1": "al_dia",
    # "pma" es un placeholder (podría ser "ppm"): al resolver esta brecha
    # el admin ya vio el documento real, pero VALOR_RESUELTO_POR_PREGUNTA
    # solo admite un valor fijo por pregunta. Sí afecta el reloj de
    # producción (10 años PMA vs 6 PPM) — ajustar a mano si el admin sabe
    # que el caso real es PPM.
    "B2_1": "pma",
    "B1_4": "mio",
    "B1_5": "si",
    "B3_1": "estudios_formales",
    "B3_2": "laboratorio",
    "B5_1": "aprobado",
    "B5_3": "si",
    "B5_4": "si",
    "C1_1": "vigente",
    "C1_2": "si",
    "C2_1": "aprobado",
    "C2_2": "aprobado",
    "C2_3": "aprobado",
    "C2_4": "aprobado",
    "C2_5": "aprobado",
    "C2_6": "aprobado",
    "C2_7": "aprobado",
    "C3_1": "firmado_inscrito",
    "D1_1": "si",
    "D1_2": "si",
    "D1_3": "si",
    "D1_4": "sin_observaciones",
    "INV_1": "si",
    "INV_2": "si",
    "INV_3": "si",
    "INV_4": "si",
    "INV_5": "si",
}

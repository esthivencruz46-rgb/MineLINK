"""Catálogo del Módulo INV (perfil de inversión).

Fuente de verdad: modulo_inversionista_minelink.md (spec de Esthiven, julio
2026). Vive SEPARADO de catalogo_diagnostico.py a propósito: el diagnóstico
de formalización valida con un match exacto de ids donde cada pregunta es
un escalar, y este módulo necesita un tipo multi-selección que no existe
ahí — mezclar los dos arriesgaba los 180 tests ya verdes del diagnóstico.
Este módulo SÍ lee `Operacion.respuestas_json` (el diagnóstico original)
para prellenados y para decidir si el módulo se ofrece, pero nunca lo
modifica ni reutiliza su maquinaria de validación.

Convención de ids: `INV_0_n` (bloque común) / `INV_<perfil>n` (bloque por
perfil). El frontend (data/preguntasInversion.ts) es un espejo EXACTO de
este catálogo — cualquier desfase produce 422 en POST /mineros/inversion.
"""

TIPOS_PREGUNTA_INV = ("opcion", "multi_opcion", "texto_corto")

# id → (tipo, regla).
#   opcion:       regla = tupla de valores válidos
#   multi_opcion: regla = (valores_validos: tuple, max_selecciones: int | None)
#   texto_corto:  regla = max_caracteres
PREGUNTAS_INV: dict[str, tuple] = {
    # ---------- INV_0: común a todos los perfiles ----------
    "INV_0_1": ("opcion", ("menos_25k", "25k_100k", "100k_500k", "500k_1m", "mas_1m")),
    "INV_0_2": (
        "multi_opcion",
        (("tramites", "exploracion", "equipo", "planta", "capital_trabajo", "terreno"), 3),
    ),
    "INV_0_3": ("opcion", ("participacion", "regalia", "deuda", "offtake", "no_sabe")),
    "INV_0_4": (
        "multi_opcion",
        (("concesion", "operacion", "equipo", "mano_obra", "conocimiento"), None),
    ),
    "INV_0_5": ("opcion", ("menos_1a", "1_2a", "2_5a", "no_sabe")),
    "INV_0_6": ("opcion", ("negociando", "sin_exito", "nunca")),
    # Solo aparece si INV_0_6 == "negociando" (ver ids_esperados_inversion)
    "INV_0_7": ("opcion", ("si", "no", "no_se")),

    # ---------- INV_A: perfil A y A_avanzado ----------
    "INV_A1": ("opcion", ("muestreo_propio", "mineria_vecina", "info_publica", "ninguna")),
    "INV_A2": ("opcion", ("menos_6m", "6_12m", "12_24m", "no_sabe")),
    "INV_A3": (
        "opcion",
        ("yo_experiencia", "yo_sin_experiencia", "operador", "inversionista_define"),
    ),

    # ---------- INV_B: perfil B ----------
    # Checklist de 3 sub-ítems, aplanado (mismo patrón que C2_1..C2_7 del
    # diagnóstico): cada uno es su propia pregunta "opcion" de 3 valores.
    "INV_B1a": ("opcion", ("tengo", "en_proceso", "no_tengo")),  # mapeo geológico
    "INV_B1b": ("opcion", ("tengo", "en_proceso", "no_tengo")),  # muestreo con laboratorio
    "INV_B1c": ("opcion", ("tengo", "en_proceso", "no_tengo")),  # estimación de recursos
    "INV_B2": ("opcion", ("si_registros", "si_sin_registros", "nunca", "no_sabe")),
    "INV_B3": ("opcion", ("capital", "permisos", "terreno", "rentabilidad", "otro")),
    "INV_B4": ("opcion", ("si_titularidad", "solo_socio", "no")),

    # ---------- INV_C: perfil C ----------
    "INV_C1": ("opcion", ("planta_formal", "comprador_local", "acopiador", "no_vende")),
    "INV_C2": ("opcion", ("completas", "parciales", "no")),
    "INV_C3": ("opcion", ("lab_certificado", "analisis_comprador", "estimacion", "no_sabe")),
    "INV_C4": ("opcion", ("detallado", "estimacion", "no")),
    "INV_C5": ("opcion", ("menos_50", "50_100", "mas_100", "no_produccion")),

    # ---------- INV_D: perfil D ----------
    "INV_D1": ("opcion", ("auditados", "contabilidad_formal", "registro_interno", "no")),
    "INV_D2": ("opcion", ("mas_12m", "6_12m", "menos_6m", "no")),
    "INV_D3a": ("opcion", ("tengo", "en_proceso", "no_tengo")),  # mapeo geológico
    "INV_D3b": ("opcion", ("tengo", "en_proceso", "no_tengo")),  # muestreo con laboratorio
    "INV_D3c": ("opcion", ("tengo", "en_proceso", "no_tengo")),  # estimación de recursos
    "INV_D4": ("opcion", ("largo_plazo", "spot", "no")),
    "INV_D5": ("texto_corto", 300),
}

_IDS_PERFIL: dict[str, tuple[str, ...]] = {
    "A": ("INV_A1", "INV_A2", "INV_A3"),
    "A_avanzado": ("INV_A1", "INV_A2", "INV_A3"),
    "B": ("INV_B1a", "INV_B1b", "INV_B1c", "INV_B2", "INV_B3", "INV_B4"),
    "C": ("INV_C1", "INV_C2", "INV_C3", "INV_C4", "INV_C5"),
    "D": ("INV_D1", "INV_D2", "INV_D3a", "INV_D3b", "INV_D3c", "INV_D4", "INV_D5"),
}


def ids_esperados_inversion(perfil: str, respuestas_inv: dict) -> set[str]:
    """Ids que debe traer un envío completo del Módulo INV para este
    perfil. INV_0_7 es condicional (solo si ya está negociando con un
    inversionista) — igual que B1_3 en el diagnóstico, se decide mirando
    las propias respuestas que se están validando."""
    if perfil not in _IDS_PERFIL:
        return set()
    ids = {"INV_0_1", "INV_0_2", "INV_0_3", "INV_0_4", "INV_0_5", "INV_0_6"}
    if respuestas_inv.get("INV_0_6") == "negociando":
        ids.add("INV_0_7")
    ids.update(_IDS_PERFIL[perfil])
    return ids


def activacion_inversion(perfil: str, respuestas_diagnostico: dict) -> dict:
    """Si el Módulo INV se ofrece a este minero y con qué prioridad, según
    la tabla de activación del spec. Perfil A: si declaró que NO se
    asociaría con un inversionista (A4_2=no), el módulo no se ofrece."""
    respuestas_diagnostico = respuestas_diagnostico or {}
    if perfil in ("A", "A_avanzado"):
        if respuestas_diagnostico.get("A4_2") == "no":
            return {
                "ofrece": False,
                "prioridad": None,
                "motivo": "Declaraste que no te asociarías con un inversionista.",
            }
        return {"ofrece": True, "prioridad": None, "motivo": None}
    if perfil == "B":
        prioridad = (
            "prioritario"
            if respuestas_diagnostico.get("B4_1") in ("buscar_inversionista", "ceder_contrato")
            else "opcional"
        )
        return {"ofrece": True, "prioridad": prioridad, "motivo": None}
    if perfil == "C":
        # C3_1="se_niega" (el titular no quiere firmar/renovar el contrato de
        # cesión) es un riesgo legal activo de exclusión automática del
        # REINFO (Art. 1, D.L. 1607) — se bloquea el módulo hasta que
        # Esthiven lo revise. Si lo resuelve por seguimiento manual
        # (brechas_resueltas_json, estudio "contrato_explotacion"), la
        # respuesta efectiva de C3_1 deja de ser "se_niega" y esto se
        # desbloquea solo (ver routers.mineros._activacion_inversion_de).
        if respuestas_diagnostico.get("C3_1") == "se_niega":
            return {
                "ofrece": False,
                "prioridad": None,
                "motivo": (
                    "Hay un riesgo legal activo con tu contrato (el titular se niega a "
                    "firmarlo) — Esthiven necesita revisarlo antes de que puedas continuar."
                ),
            }
        return {"ofrece": True, "prioridad": None, "motivo": None}
    if perfil == "D":
        prioridad = "prioritario" if respuestas_diagnostico.get("D2_2") == "inversion" else "opcional"
        return {"ofrece": True, "prioridad": prioridad, "motivo": None}
    return {"ofrece": False, "prioridad": None, "motivo": "Tu perfil no tiene módulo de inversión."}


def validar_respuestas_inversion(
    perfil: str, respuestas_diagnostico: dict, respuestas_inv: dict
) -> None:
    """Levanta ValueError si el módulo no se ofrece, si faltan/sobran ids,
    o si algún valor no es válido para su tipo. No devuelve nada — mismo
    estilo "valida o explota" que validar_respuestas() del diagnóstico."""
    activacion = activacion_inversion(perfil, respuestas_diagnostico)
    if not activacion["ofrece"]:
        raise ValueError(activacion["motivo"] or "El Módulo INV no está disponible para tu perfil.")

    esperados = ids_esperados_inversion(perfil, respuestas_inv)
    recibidos = set(respuestas_inv.keys())
    if recibidos != esperados:
        faltan = esperados - recibidos
        sobran = recibidos - esperados
        detalle = []
        if faltan:
            detalle.append(f"faltan: {sorted(faltan)}")
        if sobran:
            detalle.append(f"sobran: {sorted(sobran)}")
        raise ValueError("Respuestas incompletas o inválidas — " + "; ".join(detalle))

    for id_pregunta, valor in respuestas_inv.items():
        tipo, regla = PREGUNTAS_INV[id_pregunta]
        if tipo == "opcion":
            if valor not in regla:
                raise ValueError(f"{id_pregunta}: valor inválido")
        elif tipo == "multi_opcion":
            valores_validos, maximo = regla
            if not isinstance(valor, list) or not valor:
                raise ValueError(f"{id_pregunta}: debes elegir al menos una opción")
            if not set(valor) <= set(valores_validos):
                raise ValueError(f"{id_pregunta}: valor inválido")
            if maximo is not None and len(valor) > maximo:
                raise ValueError(f"{id_pregunta}: máximo {maximo} opciones")
        elif tipo == "texto_corto":
            if not isinstance(valor, str) or not valor.strip():
                raise ValueError(f"{id_pregunta}: no puede estar vacío")
            if len(valor) > regla:
                raise ValueError(f"{id_pregunta}: máximo {regla} caracteres")


def categorias_requeridas_inversion(perfil: str, respuestas_inv: dict) -> list[str]:
    """Documentos de sustento que el admin debe ver APROBADOS antes de dar
    el visto bueno del Módulo INV (tabla "Documentos de sustento" del
    spec, simplificada: presencia+aprobación, sin contar cantidades
    exactas como "3 liquidaciones" — el admin usa criterio para eso)."""
    respuestas_inv = respuestas_inv or {}
    if perfil in ("A", "A_avanzado"):
        return []
    if perfil == "B":
        return ["titulo_concesion"]
    if perfil == "C":
        return ["liquidaciones_venta"] if respuestas_inv.get("INV_C2") != "no" else []
    if perfil == "D":
        requeridos = []
        if respuestas_inv.get("INV_D1") != "no":
            requeridos.append("estados_financieros_libros")
        if respuestas_inv.get("INV_D2") != "no":
            requeridos.append("liquidaciones_venta")
        return requeridos
    return []


def alertas_inversion(perfil: str, respuestas_diagnostico: dict, respuestas_inv: dict) -> list[dict]:
    """Alertas de consistencia AL1-AL8 del spec — informativas para el
    admin, nunca bloquean que el minero envíe sus respuestas."""
    respuestas_diagnostico = respuestas_diagnostico or {}
    respuestas_inv = respuestas_inv or {}
    r = respuestas_diagnostico.get
    ri = respuestas_inv.get
    alertas = []

    if r("C4_1") == "mas_100t" and ri("INV_C2") == "no":
        alertas.append({"codigo": "AL1", "texto": "Declara alta producción pero sin ninguna liquidación de venta."})
    if ri("INV_0_1") == "menos_25k" and r("A5_1") == "maquinaria":
        alertas.append({"codigo": "AL2", "texto": "Capital declarado insuficiente para el método de extracción declarado."})
    if ri("INV_0_3") == "no_sabe":
        alertas.append({"codigo": "AL3", "texto": "No sabe qué ofrecer a cambio de la inversión — derivar a asesoría antes de exponerlo a inversionistas."})
    if ri("INV_0_5") == "menos_1a" and perfil in ("A", "A_avanzado", "B"):
        alertas.append({"codigo": "AL4", "texto": "Expectativa de retorno irreal para un proyecto que todavía no produce."})
    if ri("INV_B2") == "si_registros" and all(
        ri(k) == "no_tengo" for k in ("INV_B1a", "INV_B1b", "INV_B1c")
    ):
        alertas.append({"codigo": "AL5", "texto": "Dice tener registros históricos de producción pero cero información geológica."})
    if ri("INV_D1") == "no" and perfil == "D":
        alertas.append({"codigo": "AL6", "texto": "Formal pleno sin registros financieros: revisar manualmente."})
    if ri("INV_0_7") == "si":
        alertas.append({"codigo": "AL7", "texto": "Posible conflicto de exclusividad: no publicar en marketplace hasta aclarar."})
    if ri("INV_C1") == "acopiador" and ri("INV_C3") == "lab_certificado":
        alertas.append({"codigo": "AL8", "texto": "Combinación atípica (vende a acopiador pero dice tener certificado de laboratorio): verificar el certificado subido."})
    if r("C3_1") == "se_niega" and respuestas_inv:
        alertas.append({
            "codigo": "AL9",
            "texto": (
                "Riesgo de exclusión automática del REINFO (Art. 1, D.L. 1607): el titular "
                "se niega a firmar el contrato. Bloquear publicación al inversionista hasta resolver."
            ),
        })

    return alertas

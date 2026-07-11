from datetime import date

import pytest

from catalogo_diagnostico import validar_respuestas
from scoring import (
    calcular_diagnostico,
    clasificacion_de,
    indice_madurez,
    semaforo_legal,
    brechas_de,
    respuestas_con_brechas_resueltas,
    ETIQUETA_BLOQUEANTE,
)


# ---------------------------------------------------------------------------
# Fixtures: respuestas válidas por perfil (dict[str, str], todo en valores
# "buenos" salvo overrides indicados)
# ---------------------------------------------------------------------------

def _perfil_a_con_area() -> dict[str, str]:
    return {
        "M0_1": "nada",
        "A1_1": "si", "A1_2": "si", "A1_3": "si",
        "A2_1": "ninguna", "A2_2": "no",
        "A3_1": "mio", "A4_1": "completo", "A5_1": "manual", "A5_2": "oro",
    }


def _perfil_a_sin_area() -> dict[str, str]:
    return {
        "M0_1": "nada",
        "A1_1": "no",
        "A3_1": "mio", "A4_1": "completo", "A5_1": "manual", "A5_2": "oro",
    }


def _perfil_b(overrides: dict[str, str] | None = None) -> dict[str, str]:
    # B3_1/B3_2 (estudios geológicos/laboratorio) y el Módulo INV están en
    # pausa (julio 2026) — fuera de ids_esperados, no van en el fixture.
    base = {
        "M0_1": "concesion_no_operando",
        "B1_1": "al_dia", "B1_2": "2020", "B1_3": "pago",
        "B1_4": "mio",
        "B2_1": "pma", "B2_2": "500",
        "B4_1": "operar_yo",
        "B5_1": "aprobado", "B5_3": "si", "B5_4": "si",
    }
    if overrides:
        base.update(overrides)
    return base


def _perfil_b_sin_b5() -> dict[str, str]:
    return {
        "M0_1": "concesion_no_operando",
        "B1_1": "al_dia", "B1_2": "2020", "B1_3": "pago",
        "B1_4": "mio",
        "B2_1": "pma", "B2_2": "500",
        "B4_1": "buscar_inversionista",
    }


def _perfil_c(overrides: dict[str, str] | None = None) -> dict[str, str]:
    base = {
        "M0_1": "concesion_propia", "M0_3": "vigente", "M0_4": "no",
        "C1_1": "vigente", "C1_2": "si", "C1_3": "titular",
        "C2_1": "aprobado", "C2_2": "aprobado", "C2_3": "aprobado",
        "C2_4": "aprobado", "C2_5": "aprobado", "C2_6": "aprobado", "C2_7": "aprobado",
        "C4_1": "50_100t", "C4_2": "siempre",
    }
    if overrides:
        base.update(overrides)
    return base


def _perfil_c_contrato(overrides: dict[str, str] | None = None) -> dict[str, str]:
    base = {
        "M0_1": "concesion_propia", "M0_3": "vigente", "M0_4": "no",
        "C1_1": "vigente", "C1_2": "si", "C1_3": "contrato",
        "C2_1": "aprobado", "C2_2": "aprobado", "C2_3": "aprobado",
        "C2_4": "aprobado", "C2_5": "aprobado", "C2_6": "aprobado", "C2_7": "aprobado",
        "C3_1": "firmado_inscrito",
        "C4_1": "50_100t", "C4_2": "siempre",
    }
    if overrides:
        base.update(overrides)
    return base


def _perfil_d(overrides: dict[str, str] | None = None) -> dict[str, str]:
    base = {
        "M0_1": "concesion_propia", "M0_3": "vigente", "M0_4": "si",
        "D1_1": "si", "D1_2": "si", "D1_3": "si", "D1_4": "sin_observaciones",
        "D2_1": "ampliar", "D2_2": "autofinanciado",
    }
    if overrides:
        base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# Tests: clasificar_perfil / ids / validación
# ---------------------------------------------------------------------------

def test_perfil_a_desde_nada():
    r = _perfil_a_con_area()
    assert validar_respuestas(r) == "A"


def test_perfil_a_avanzado():
    r = {"M0_1": "petitorio_tramite", "A3_1": "mio", "A4_1": "completo", "A5_1": "manual", "A5_2": "oro"}
    assert validar_respuestas(r) == "A_avanzado"


def test_perfil_b():
    r = _perfil_b()
    assert validar_respuestas(r) == "B"


def test_perfil_c():
    r = _perfil_c()
    assert validar_respuestas(r) == "C"


def test_perfil_c_con_contrato():
    r = _perfil_c_contrato()
    assert validar_respuestas(r) == "C"


def test_perfil_d():
    r = _perfil_d()
    assert validar_respuestas(r) == "D"


def test_sin_ruta_rechaza():
    r = {"M0_1": "concesion_propia", "M0_3": "no"}
    with pytest.raises(ValueError, match="Sin ruta legal"):
        validar_respuestas(r)


def test_ids_faltantes_lanza_value_error():
    r = _perfil_a_con_area()
    del r["A3_1"]
    with pytest.raises(ValueError):
        validar_respuestas(r)


def test_ids_extra_lanza_value_error():
    r = _perfil_a_con_area()
    r["X99"] = "si"
    with pytest.raises(ValueError):
        validar_respuestas(r)


def test_valor_invalido_lanza_value_error():
    r = _perfil_a_con_area()
    r["A5_1"] = "avion"
    with pytest.raises(ValueError):
        validar_respuestas(r)


def test_respuestas_old_format_rejected():
    """El formato viejo (bool) ya no es válido."""
    r = {"M0_1": "nada", "A1_1": "si", "A3_1": "mio", "A4_1": "completo", "A5_1": "manual", "A5_2": "oro"}
    r["A1_1"] = True  # type: ignore[assignment]
    with pytest.raises(ValueError):
        validar_respuestas(r)


# ---------------------------------------------------------------------------
# Tests: semáforo legal
# ---------------------------------------------------------------------------

def test_legal_verdePerfilA_todo_ok():
    r = _perfil_a_con_area()
    color, bloq = semaforo_legal("A", r, date.today())
    assert color == "verde"
    assert bloq == []


def test_legal_rojo_zona_prohibida():
    r = _perfil_a_con_area()
    r["A2_1"] = "anp"
    color, bloq = semaforo_legal("A", r, date.today())
    assert color == "rojo"
    assert "zona_prohibida" in bloq


def test_legal_rojo_dragas():
    r = _perfil_a_con_area()
    r["A2_2"] = "si"
    color, bloq = semaforo_legal("A", r, date.today())
    assert color == "rojo"
    assert "dragas_prohibidas" in bloq


def test_legal_amarillo_area_no_verificada():
    r = _perfil_a_con_area()
    r["A1_2"] = "no"
    color, _ = semaforo_legal("A", r, date.today())
    assert color == "amarillo"


def test_legal_rojo_b_caducidad_2_anios():
    r = _perfil_b()
    r["B1_1"] = "debo_2_mas"
    color, bloq = semaforo_legal("B", r, date.today())
    assert color == "rojo"
    assert "riesgo_caducidad_vigencia" in bloq


def test_legal_rojo_b_penalidad():
    r = _perfil_b()
    r["B1_3"] = "no_pago"
    color, bloq = semaforo_legal("B", r, date.today())
    assert color == "rojo"
    assert "penalidad_impaga" in bloq


def test_legal_rojo_c_suspendido():
    r = _perfil_c()
    r["C1_1"] = "suspendida"
    color, bloq = semaforo_legal("C", r, date.today())
    assert color == "rojo"
    assert "reinfo_suspendido" in bloq


def test_legal_amarillo_c_docs_pendientes():
    r = _perfil_c()
    r["C2_1"] = "no_iniciado"
    color, _ = semaforo_legal("C", r, date.today())
    assert color == "amarillo"


def test_legal_verde_d_todo_ok():
    r = _perfil_d()
    color, _ = semaforo_legal("D", r, date.today())
    assert color == "verde"


def test_legal_amarillo_d_vigencia_pendiente():
    r = _perfil_d()
    r["D1_1"] = "no"
    color, _ = semaforo_legal("D", r, date.today())
    assert color == "amarillo"


# ---------------------------------------------------------------------------
# Tests: urgencia REINFO (perfil C)
# ---------------------------------------------------------------------------

def test_urgencia_c_alerta_roja():
    """Si todos los docs están sin iniciar, los días necesarios superan
    el plazo al 31/12/2026 y se activa alerta_roja."""
    r = _perfil_c()
    for n in range(1, 8):
        r[f"C2_{n}"] = "no_iniciado"
    resultado = calcular_diagnostico(r, hoy=date(2026, 10, 1))
    assert resultado["urgencia"]["alerta_roja"] is True
    assert "plazo_reinfo_critico" in resultado["bloqueantes"]


def test_urgencia_c_sin_alerta():
    """Si todos los docs están aprobados, no hay alerta."""
    r = _perfil_c()
    resultado = calcular_diagnostico(r, hoy=date(2026, 7, 1))
    assert resultado["urgencia"]["alerta_roja"] is False
    assert resultado["urgencia"]["docs_completados"] == 7


# ---------------------------------------------------------------------------
# Tests: reloj producción (perfil B)
# ---------------------------------------------------------------------------

def test_reloj_b_no_vencido():
    r = _perfil_b({"B1_2": "2023"})
    resultado = calcular_diagnostico(r, hoy=date(2026, 7, 1))
    assert resultado["reloj_produccion"]["vencido"] is False
    assert resultado["reloj_produccion"]["anios_restantes"] > 0


def test_reloj_b_vencido_ppm():
    r = _perfil_b({"B1_2": "2018", "B2_1": "ppm"})
    resultado = calcular_diagnostico(r, hoy=date(2026, 7, 1))
    assert resultado["reloj_produccion"]["vencido"] is True


def test_reloj_b_none_para_perfil_a():
    r = _perfil_a_con_area()
    resultado = calcular_diagnostico(r, hoy=date(2026, 7, 1))
    assert resultado["reloj_produccion"] is None


# ---------------------------------------------------------------------------
# Tests: brechas
# ---------------------------------------------------------------------------

def test_brechas_perfil_a_area_no_georreferenciada():
    r = _perfil_a_con_area()
    r["A1_3"] = "no"
    assert "levantamiento_georreferenciado" in brechas_de(r)


def test_brechas_perfil_b_terreno_sin_acuerdo():
    r = _perfil_b()
    r["B1_4"] = "privado"
    r["B1_5"] = "no"
    assert "acreditacion_terreno" in brechas_de(r)


def test_brechas_perfil_c_docs_no_iniciados():
    r = _perfil_c()
    r["C2_1"] = "no_iniciado"
    r["C2_2"] = "no_se"
    b = brechas_de(r)
    assert "igafom_aprobado" in b
    assert "acreditacion_terreno" in b


def test_brechas_perfil_d_vigencia_pendiente():
    r = _perfil_d()
    r["D1_1"] = "no"
    assert "vigencia_concesion" in brechas_de(r)


def test_brechas_perfil_d_dac_pendiente():
    r = _perfil_d()
    r["D1_3"] = "no"
    assert "declaracion_anual_consolidada" in brechas_de(r)


def test_brechas_perfil_d_penalidad():
    r = _perfil_d()
    r["D1_2"] = "pago_penalidad"
    assert "puesta_en_produccion" in brechas_de(r)


# ---------------------------------------------------------------------------
# Tests: calcular_diagnostico completo
# ---------------------------------------------------------------------------

def test_perfil_a_con_area_verde():
    r = _perfil_a_con_area()
    res = calcular_diagnostico(r, hoy=date(2026, 7, 1))
    assert res["perfil"] == "A"
    assert res["semaforo_legal"] == "verde"
    assert res["bloqueantes"] == []
    assert res["brechas"] == []
    assert res["apto_inversionistas"] is False  # perfil A nunca publica


def test_perfil_a_sin_area_amarillo():
    r = _perfil_a_sin_area()
    res = calcular_diagnostico(r, hoy=date(2026, 7, 1))
    assert res["semaforo_legal"] == "amarillo"
    assert "verificar_area" in res["salidas"]


def test_perfil_b_verde():
    r = _perfil_b()
    res = calcular_diagnostico(r, hoy=date(2026, 7, 1))
    assert res["perfil"] == "B"
    assert res["semaforo_legal"] == "verde"
    assert res["apto_inversionistas"] is True
    assert res["brechas"] == []
    # Módulo INV en pausa: madurez/semáforo técnico no se calculan.
    assert res["indice_madurez"] is None
    assert res["semaforo_tecnico"] is None


def test_perfil_b_rojo_bloquea():
    r = _perfil_b({"B1_1": "debo_2_mas"})
    res = calcular_diagnostico(r, hoy=date(2026, 7, 1))
    assert res["semaforo_legal"] == "rojo"
    assert res["apto_inversionistas"] is False


def test_brechas_b3_en_pausa_siguen_reconociendose():
    """B3_1/B3_2 están fuera del formulario activo (ver ids_esperados), pero
    brechas_de() es una función pura: si llegaran presentes (diagnósticos
    de antes de la pausa) el matching con empresas se sigue calculando."""
    r = {"B3_1": "no", "B3_2": "no"}
    b = brechas_de(r)
    assert "informe_geologico" in b
    assert "analisis_laboratorio" in b


def test_perfil_c_verde_docs_completos():
    r = _perfil_c()
    res = calcular_diagnostico(r, hoy=date(2026, 7, 1))
    assert res["perfil"] == "C"
    assert res["semaforo_legal"] == "verde"
    assert res["apto_inversionistas"] is True
    assert res["brechas"] == []
    assert res["urgencia"]["docs_completados"] == 7


def test_perfil_c_rojo_suspendido():
    r = _perfil_c({"C1_1": "suspendida"})
    res = calcular_diagnostico(r, hoy=date(2026, 7, 1))
    assert res["semaforo_legal"] == "rojo"
    assert res["apto_inversionistas"] is False
    assert "reinfo_suspendido" in res["bloqueantes"]


def test_perfil_c_contrato_incluye_c3():
    r = _perfil_c_contrato()
    res = calcular_diagnostico(r, hoy=date(2026, 7, 1))
    assert res["perfil"] == "C"
    assert res["brechas"] == []


def test_perfil_d_verde():
    r = _perfil_d()
    res = calcular_diagnostico(r, hoy=date(2026, 7, 1))
    assert res["perfil"] == "D"
    assert res["semaforo_legal"] == "verde"
    assert res["apto_inversionistas"] is True


def test_perfil_d_amarillo_vigencia_no():
    r = _perfil_d({"D1_1": "no"})
    res = calcular_diagnostico(r, hoy=date(2026, 7, 1))
    assert res["semaforo_legal"] == "amarillo"
    assert "alertas_cumplimiento" in res["salidas"]


# ---------------------------------------------------------------------------
# Tests: clasificación PMA/PPM (perfil B)
# ---------------------------------------------------------------------------

def test_clasificacion_pma():
    r = _perfil_b({"B2_1": "pma", "B2_2": "500"})
    assert clasificacion_de("B", r) == "pma"


def test_clasificacion_ppm_por_hectareas():
    r = _perfil_b({"B2_1": "pma", "B2_2": "1500"})
    assert clasificacion_de("B", r) == "ppm"  # excede límite PMA


def test_clasificacion_no_califica():
    r = _perfil_b({"B2_1": "pma", "B2_2": "5000"})
    assert clasificacion_de("B", r) == "no_califica"


def test_clasificacion_none_para_perfil_a_no_se():
    r = _perfil_a_con_area()
    r["A5_1"] = "no_se"
    assert clasificacion_de("A", r) is None


# ---------------------------------------------------------------------------
# Tests: índice de madurez (Módulo INV en pausa julio 2026 — ver
# catalogo_diagnostico.PREGUNTAS: siempre None para todos los perfiles,
# aunque lleguen respuestas INV_* de datos anteriores a la pausa)
# ---------------------------------------------------------------------------

def test_madurez_none_aunque_haya_respuestas_inv():
    r = _perfil_b({"INV_1": "si", "INV_2": "si", "INV_3": "si", "INV_4": "si", "INV_5": "si"})
    assert indice_madurez("B", r) is None


def test_madurez_none_para_perfil_a():
    r = _perfil_a_con_area()
    assert indice_madurez("A", r) is None


def test_madurez_none_para_todos_los_perfiles():
    for perfil in ("A", "A_avanzado", "B", "C", "D"):
        assert indice_madurez(perfil, {}) is None


# ---------------------------------------------------------------------------
# Tests: respuestas_con_brechas_resueltas
# ---------------------------------------------------------------------------

def test_brechas_resueltas_no_muta_originales():
    r = _perfil_c()
    r["C2_1"] = "no_iniciado"
    original = dict(r)
    parcheadas = respuestas_con_brechas_resueltas(r, ["igafom_aprobado"])
    assert r == original
    assert parcheadas["C2_1"] == "aprobado"


def test_brechas_resueltas_estudio_no_presente_no_opera():
    r = _perfil_c()
    parcheadas = respuestas_con_brechas_resueltas(r, ["dj_arqueologica"])
    assert parcheadas == r  # sin cambios


def test_brechas_resueltas_multiples_preguntas():
    r = _perfil_b({"B1_1": "debo_2_mas", "B3_1": "no"})
    parcheadas = respuestas_con_brechas_resueltas(r, ["vigencia_concesion", "informe_geologico"])
    assert parcheadas["B1_1"] == "al_dia"
    assert parcheadas["B3_1"] == "estudios_formales"


# ---------------------------------------------------------------------------
# Tests: salidas
# ---------------------------------------------------------------------------

def test_salidas_a_rojo_area_no_concesionable():
    r = _perfil_a_con_area()
    r["A2_1"] = "anp"
    res = calcular_diagnostico(r, hoy=date(2026, 7, 1))
    assert "area_no_concesionable" in res["salidas"]


def test_salidas_b_alerta_caducidad():
    r = _perfil_b({"B1_1": "debo_2_mas"})
    res = calcular_diagnostico(r, hoy=date(2026, 7, 1))
    assert "alerta_caducidad" in res["salidas"]


def test_salidas_b_guia_cesion():
    r = _perfil_b_sin_b5()
    r["B4_1"] = "ceder_contrato"
    res = calcular_diagnostico(r, hoy=date(2026, 7, 1))
    assert "guia_cesion" in res["salidas"]


def test_salidas_c_subsana_suspension():
    r = _perfil_c({"C1_1": "suspendida"})
    res = calcular_diagnostico(r, hoy=date(2026, 7, 1))
    assert "subsanar_suspension" in res["salidas"]


# ---------------------------------------------------------------------------
# Tests: Score de Atractivo de Inversión (legacy, scoring_legacy.py)
# ---------------------------------------------------------------------------

from types import SimpleNamespace

from scoring_legacy import calcular_score_inversion


def _operacion_ruta1(**overrides) -> SimpleNamespace:
    base = dict(
        situacion="minero_artesanal",
        produccion_mensual=None, ley_promedio=None, produccion_objetivo=None,
        tiene_resultados_laboratorio=None, documentacion_disponible=None,
        sustancias_toxicas=None, gestion_sustancias=None,
        conflictividad_social=None, permisos_comunitarios=None,
        experiencia_operador=None, capacitacion_operador=None,
        monto_requerido=None, plazo_capital=None, motivo_capital=None,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def _operacion_ruta2(**overrides) -> SimpleNamespace:
    base = dict(
        situacion="concesionario",
        toneladas_estimadas=None, ley_esperada=None, produccion_objetivo=None,
        info_geologica_disponible=None, tiene_resultados_laboratorio=None, estudio_previo=None,
        pasivos_ambientales=None, conflictividad_social=None,
        experiencia_titular=None, equipo_tecnico=None,
        monto_requerido=None, capital_disponible=None, timeline_operacion=None,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def test_score_inversion_ruta1_todo_en_el_mejor_valor_da_100():
    o = _operacion_ruta1(
        produccion_mensual="50 toneladas de mineral/mes",
        ley_promedio="Oro: 2.5 g/t",
        produccion_objetivo="5x+",
        tiene_resultados_laboratorio="completo",
        documentacion_disponible="ambos",
        sustancias_toxicas="no",
        conflictividad_social="no",
        permisos_comunitarios="formales",
        experiencia_operador="> 10 años",
        capacitacion_operador="cip",
        monto_requerido="S/. 200,000 - 1,000,000",
        plazo_capital="6-12 meses",
        motivo_capital="Ampliación",
    )
    resultado = calcular_score_inversion(o, score_formalizacion=100)
    assert resultado["score_total"] == 100
    for dim in resultado["dimensiones"].values():
        assert dim == {"puntaje": 100, "maximo": 100}


def test_score_inversion_ruta2_perfil_vacio_da_cero():
    o = _operacion_ruta2()
    resultado = calcular_score_inversion(o, score_formalizacion=0)
    assert resultado["score_total"] == 0


# ---------------------------------------------------------------------------
# Tests: ETIQUETA_BLOQUEANTE tiene labels para todos los bloqueantes
# ---------------------------------------------------------------------------

def test_todos_bloqueantes_tienen_etiqueta():
    todos = {
        "zona_prohibida", "dragas_prohibidas", "riesgo_caducidad_vigencia",
        "penalidad_impaga", "reinfo_suspendido", "plazo_reinfo_critico",
    }
    assert todos == set(ETIQUETA_BLOQUEANTE.keys())

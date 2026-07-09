from types import SimpleNamespace

import pytest

from scoring import (
    ESTUDIO_POR_PREGUNTA,
    PUNTOS_SEGURIDAD_SUBTERRANEA,
    PUNTOS_SEGURIDAD_TAJO_ABIERTO,
    aplicar_brechas_resueltas,
    calcular_diagnostico,
    calcular_score_inversion,
    ids_esperados_para,
)

IDS_SUBTERRANEA = ids_esperados_para("subterranea")
IDS_TAJO_ABIERTO = ids_esperados_para("tajo_abierto")


def _respuestas(ids, default: bool, overrides: dict[str, bool] | None = None) -> dict[str, bool]:
    respuestas = {i: default for i in ids}
    if overrides:
        respuestas.update(overrides)
    return respuestas


def test_todo_si_subterranea_score_100_sin_brechas_no_bloqueado():
    resultado = calcular_diagnostico(_respuestas(IDS_SUBTERRANEA, True), "subterranea")

    assert resultado["score_total"] == 100
    assert resultado["brechas"] == []
    assert resultado["bloqueado"] is False


def test_todo_no_subterranea_score_0_bloqueado_todas_las_brechas():
    resultado = calcular_diagnostico(_respuestas(IDS_SUBTERRANEA, False), "subterranea")

    assert resultado["score_total"] == 0
    assert resultado["bloqueado"] is True
    assert resultado["brechas"] == sorted(ESTUDIO_POR_PREGUNTA[i] for i in IDS_SUBTERRANEA)


def test_l1_no_resto_si_subterranea_score_95_bloqueado():
    resultado = calcular_diagnostico(
        _respuestas(IDS_SUBTERRANEA, True, {"L1": False}), "subterranea"
    )

    assert resultado["score_total"] == 95
    assert resultado["bloqueado"] is True
    assert resultado["brechas"] == ["tramite_reinfo"]


def test_faltan_o_sobran_ids_lanza_value_error():
    incompleto = _respuestas(IDS_SUBTERRANEA, True)
    del incompleto["L1"]
    with pytest.raises(ValueError):
        calcular_diagnostico(incompleto, "subterranea")

    con_id_extra = _respuestas(IDS_SUBTERRANEA, True)
    con_id_extra["X99"] = True
    with pytest.raises(ValueError):
        calcular_diagnostico(con_id_extra, "subterranea")


def test_tipo_mina_invalido_lanza_value_error():
    with pytest.raises(ValueError):
        calcular_diagnostico(_respuestas(IDS_SUBTERRANEA, True), "volador")


def test_tajo_abierto_no_acepta_s5():
    # S5 no aplica a tajo abierto: si viene, el set de ids no calza y falla
    respuestas = _respuestas(IDS_TAJO_ABIERTO, True)
    respuestas["S5"] = True
    with pytest.raises(ValueError):
        calcular_diagnostico(respuestas, "tajo_abierto")


def test_tajo_abierto_todo_si_score_100():
    resultado = calcular_diagnostico(_respuestas(IDS_TAJO_ABIERTO, True), "tajo_abierto")

    assert resultado["score_total"] == 100
    assert resultado["brechas"] == []
    assert resultado["dimensiones"]["seguridad"]["maximo"] == 25
    assert set(PUNTOS_SEGURIDAD_TAJO_ABIERTO.values()) == {6, 7}
    assert sum(PUNTOS_SEGURIDAD_TAJO_ABIERTO.values()) == 25
    assert sum(PUNTOS_SEGURIDAD_SUBTERRANEA.values()) == 25


def test_operativo_informativas_no_forman_parte_del_calculo():
    # O1 es la única pregunta SÍ/NO de Operativo; produccion_mensual,
    # maquinaria y num_trabajadores ni siquiera son ids de scoring.
    assert "O1" in IDS_SUBTERRANEA
    assert not any(i.startswith("O2") or i.startswith("O3") or i.startswith("O4") for i in IDS_SUBTERRANEA)


def test_aplicar_brechas_resueltas_no_muta_respuestas_originales():
    respuestas = _respuestas(IDS_SUBTERRANEA, True, {"L1": False, "S5": False})
    original = dict(respuestas)

    resultado = aplicar_brechas_resueltas(respuestas, "subterranea", ["estudio_ventilacion"])

    assert respuestas == original  # la declaración original no se toca
    assert resultado["score_total"] == 95  # solo se "resuelve" S5 (+5), L1 sigue en NO
    assert resultado["bloqueado"] is True  # L1 sigue sin resolver
    assert resultado["brechas"] == ["tramite_reinfo"]


def test_aplicar_brechas_resueltas_todas_resueltas_da_score_100():
    respuestas = _respuestas(IDS_SUBTERRANEA, True, {"L1": False, "S5": False})
    todas_las_brechas = calcular_diagnostico(respuestas, "subterranea")["brechas"]

    resultado = aplicar_brechas_resueltas(respuestas, "subterranea", todas_las_brechas)

    assert resultado["score_total"] == 100
    assert resultado["bloqueado"] is False
    assert resultado["brechas"] == []


def test_aplicar_brechas_resueltas_ignora_estudio_que_no_es_brecha():
    respuestas = _respuestas(IDS_SUBTERRANEA, True)  # todo SÍ, sin brechas

    resultado = aplicar_brechas_resueltas(respuestas, "subterranea", ["tramite_reinfo"])

    assert resultado["score_total"] == 100  # ya estaba en 100, no se altera


# ---------- Score de Atractivo de Inversión (Fase 2) ----------

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


def test_score_inversion_ruta1_perfil_vacio_no_es_cero_por_el_riesgo_no_declarado():
    # Sin declarar sustancias tóxicas, la señal de riesgo asume "no usa" (100
    # de 3 señales), así que el perfil vacío no cae exactamente a 0.
    o = _operacion_ruta1()
    resultado = calcular_score_inversion(o, score_formalizacion=0)
    assert resultado["score_total"] == 5
    assert resultado["dimensiones"]["riesgo_ambiental_social"]["puntaje"] == 33
    assert resultado["dimensiones"]["escala_economica"]["puntaje"] == 0
    assert resultado["dimensiones"]["formalizacion"]["puntaje"] == 0


def test_score_inversion_ruta1_caso_intermedio():
    o = _operacion_ruta1(
        produccion_mensual="30 gramos de metal/mes",
        produccion_objetivo="2-3x",
        tiene_resultados_laboratorio="parcial",
        documentacion_disponible="fotos_basicas",
        sustancias_toxicas="mercurio",
        gestion_sustancias="confinamiento",
        conflictividad_social="percibida",
        permisos_comunitarios="informales",
        experiencia_operador="2-5 años",
        capacitacion_operador="cursos_tecnicos",
        monto_requerido="S/. 50,000 - 200,000",
        plazo_capital="No definido",
    )
    resultado = calcular_score_inversion(o, score_formalizacion=70)
    assert resultado["score_total"] == 51
    assert resultado["dimensiones"]["escala_economica"]["puntaje"] == 53
    assert resultado["dimensiones"]["viabilidad_tecnica"]["puntaje"] == 50
    assert resultado["dimensiones"]["riesgo_ambiental_social"]["puntaje"] == 47
    assert resultado["dimensiones"]["capacidad_equipo"]["puntaje"] == 45
    assert resultado["dimensiones"]["claridad_oportunidad"]["puntaje"] == 33


def test_score_inversion_ruta2_todo_en_el_mejor_valor_da_100():
    o = _operacion_ruta2(
        toneladas_estimadas="500M+",
        ley_esperada="0.5 g/t Au",
        produccion_objetivo="500k+",
        info_geologica_disponible="completo",
        tiene_resultados_laboratorio="completo",
        estudio_previo="externo_completo",
        pasivos_ambientales="no",
        conflictividad_social="no",
        experiencia_titular="empresa_con_trayectoria",
        equipo_tecnico="completo",
        monto_requerido="S/. 500,000 - 2,000,000",
        capital_disponible="completo",
        timeline_operacion="6-12 meses",
    )
    resultado = calcular_score_inversion(o, score_formalizacion=100)
    assert resultado["score_total"] == 100
    for dim in resultado["dimensiones"].values():
        assert dim == {"puntaje": 100, "maximo": 100}


def test_score_inversion_ruta2_perfil_vacio_da_cero():
    o = _operacion_ruta2()
    resultado = calcular_score_inversion(o, score_formalizacion=0)
    assert resultado["score_total"] == 0
    for dim in resultado["dimensiones"].values():
        assert dim == {"puntaje": 0, "maximo": 100}

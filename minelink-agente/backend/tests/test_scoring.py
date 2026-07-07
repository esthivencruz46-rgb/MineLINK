import pytest

from scoring import (
    ESTUDIO_POR_PREGUNTA,
    PUNTOS_SEGURIDAD_SUBTERRANEA,
    PUNTOS_SEGURIDAD_TAJO_ABIERTO,
    aplicar_brechas_resueltas,
    calcular_diagnostico,
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
    assert resultado["brechas"] == sorted(set(ESTUDIO_POR_PREGUNTA.values()))


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

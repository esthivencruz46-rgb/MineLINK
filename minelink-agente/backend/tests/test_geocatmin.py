"""Tests de geocatmin.py — específicamente la consulta de fallas geológicas
cercanas (julio 2026). Todo mockeado con requests.get; nunca hace una
llamada de red real (mismo patrón que test_asesor.py con requests.post)."""
import os

# geocatmin.py lee esta variable UNA sola vez al importarse (_DESACTIVADO
# queda fijo para todo el proceso). pytest importa todos los test_*.py en
# la fase de colección antes de correr nada — si este archivo se colecciona
# antes que test_smoke.py (que es quien fija esto normalmente), geocatmin
# se importaría con la red real activada y quedaría así contaminando el
# resto de la suite (regresión real, julio 2026: test_mapa_cotejo_no_revienta
# empezó a fallar por esto). Fijarlo acá también, antes de importar
# geocatmin, hace que el orden de colección no importe.
os.environ.setdefault("MINELINK_GEOCATMIN", "0")

from unittest.mock import patch

import requests as requests_mod

import geocatmin


class _RespuestaFalsa:
    def __init__(self, data: dict):
        self._data = data

    def raise_for_status(self):
        pass

    def json(self):
        return self._data


def test_query_cercania_pasa_distancia_y_unidades():
    with patch("geocatmin.requests.get") as mock_get:
        mock_get.return_value = _RespuestaFalsa(
            {"features": [{"attributes": {"NOMBRE": "Falla X"}}]}
        )
        resultado = geocatmin._query_cercania(
            "SERV_GEOLOGIA_50K_INTEGRADA", 2, -76.7, -12.5, "TIPO,NOMBRE,SISTEMA"
        )
    assert resultado == [{"attributes": {"NOMBRE": "Falla X"}}]
    _, kwargs = mock_get.call_args
    assert kwargs["params"]["distance"] == geocatmin._DISTANCIA_FALLA_M
    assert kwargs["params"]["units"] == "esriSRUnit_Meter"


def test_fallas_cercanas_prioriza_50k_si_hay_datos():
    with patch("geocatmin.requests.get") as mock_get:
        mock_get.return_value = _RespuestaFalsa(
            {"features": [{"attributes": {"NOMBRE": "Falla Huaytapallana", "TIPO": "Inversa"}}]}
        )
        resultado = geocatmin._fallas_cercanas(-76.7, -12.5)
    assert mock_get.call_count == 1  # con datos en 50K, ni siquiera consulta 100K
    assert resultado == {
        "escala": "50k",
        "items": [{"nombre": "Falla Huaytapallana", "tipo": "Inversa"}],
    }


def test_fallas_cercanas_cae_a_100k_si_50k_no_tiene_cobertura():
    respuestas = [
        _RespuestaFalsa({"features": []}),  # 50K responde, pero sin cobertura ahí
        _RespuestaFalsa({"features": [{"attributes": {"DESCRIP": "Falla regional"}}]}),
    ]
    with patch("geocatmin.requests.get", side_effect=respuestas) as mock_get:
        resultado = geocatmin._fallas_cercanas(-76.7, -12.5)
    assert mock_get.call_count == 2
    assert resultado == {"escala": "100k", "items": [{"nombre": "Falla regional", "tipo": None}]}


def test_fallas_cercanas_100k_verificado_sin_resultados():
    # Ambas escalas responden pero ninguna encuentra nada dentro del radio
    # corto NI del ampliado (3 llamadas: 50K, 100K, reintento 100K
    # ampliado): es "se verificó y no hay fallas cerca" (items=[]),
    # distinto de None.
    respuestas = [
        _RespuestaFalsa({"features": []}),
        _RespuestaFalsa({"features": []}),
        _RespuestaFalsa({"features": []}),
    ]
    with patch("geocatmin.requests.get", side_effect=respuestas) as mock_get:
        resultado = geocatmin._fallas_cercanas(-76.7, -12.5)
    assert mock_get.call_count == 3
    assert resultado == {"escala": "100k", "items": []}


def test_fallas_cercanas_amplia_el_radio_si_el_corto_no_encuentra_nada():
    # Pedido explícito de Esthiven (julio 2026): si el radio corto no
    # encuentra nada en ninguna escala, reintentar UNA vez con un radio
    # más amplio (~10x10 km) antes de confirmar que no hay fallas cerca.
    respuestas = [
        _RespuestaFalsa({"features": []}),  # 50K, radio corto
        _RespuestaFalsa({"features": []}),  # 100K, radio corto
        _RespuestaFalsa(
            {"features": [{"attributes": {"DESCRIP": "Falla lejana"}}]}
        ),  # 100K, radio ampliado
    ]
    with patch("geocatmin.requests.get", side_effect=respuestas) as mock_get:
        resultado = geocatmin._fallas_cercanas(-76.7, -12.5)
    assert mock_get.call_count == 3
    _, kwargs = mock_get.call_args
    assert kwargs["params"]["distance"] == geocatmin._DISTANCIA_FALLA_AMPLIADA_M
    assert resultado == {"escala": "100k", "items": [{"nombre": "Falla lejana", "tipo": None}]}


def test_fallas_cercanas_none_si_ambas_consultas_fallan():
    with patch(
        "geocatmin.requests.get", side_effect=requests_mod.RequestException("timeout")
    ):
        resultado = geocatmin._fallas_cercanas(-76.7, -12.5)
    assert resultado is None


def test_fallas_cercanas_50k_falla_pero_100k_responde():
    cola = [
        requests_mod.RequestException("timeout"),
        _RespuestaFalsa({"features": [{"attributes": {"DESCRIP": "Falla Chonta"}}]}),
    ]

    def _side_effect(*args, **kwargs):
        item = cola.pop(0)
        if isinstance(item, Exception):
            raise item
        return item

    with patch("geocatmin.requests.get", side_effect=_side_effect):
        resultado = geocatmin._fallas_cercanas(-76.7, -12.5)
    assert resultado == {"escala": "100k", "items": [{"nombre": "Falla Chonta", "tipo": None}]}


def test_fallas_cercanas_dedup_por_nombre_y_tope_max_fallas():
    features = [
        {"attributes": {"NOMBRE": "Falla A", "TIPO": "Normal"}},
        {"attributes": {"NOMBRE": "Falla A", "TIPO": "Normal"}},  # duplicado (mismo segmento)
        {"attributes": {"NOMBRE": "Falla B"}},
        {"attributes": {"NOMBRE": "Falla C"}},
        {"attributes": {"NOMBRE": "Falla D"}},
        {"attributes": {"NOMBRE": "Falla E"}},
        {"attributes": {"NOMBRE": "Falla F"}},  # 6ta distinta: debe cortar en _MAX_FALLAS
    ]
    with patch("geocatmin.requests.get") as mock_get:
        mock_get.return_value = _RespuestaFalsa({"features": features})
        resultado = geocatmin._fallas_cercanas(-76.7, -12.5)
    assert resultado["escala"] == "50k"
    assert len(resultado["items"]) == geocatmin._MAX_FALLAS
    assert [i["nombre"] for i in resultado["items"]] == [
        "Falla A",
        "Falla B",
        "Falla C",
        "Falla D",
        "Falla E",
    ]


def test_consultar_incluye_fallas_en_el_resultado(monkeypatch):
    # El proceso de tests fija MINELINK_GEOCATMIN=0 antes de importar main
    # (ver test_smoke.py), así que geocatmin._DESACTIVADO ya quedó en True
    # a nivel de módulo — se pisa puntualmente acá para poder ejercitar
    # consultar() con requests.get mockeado, sin llamar a INGEMMET real.
    monkeypatch.setattr(geocatmin, "_DESACTIVADO", False)

    def _get_falso(url, params=None, timeout=None):
        if "SERV_GEOLOGIA_50K_INTEGRADA/MapServer/2" in url:
            return _RespuestaFalsa(
                {"features": [{"attributes": {"NOMBRE": "Falla X", "TIPO": "Normal"}}]}
            )
        return _RespuestaFalsa({"features": []})

    with patch("geocatmin.requests.get", side_effect=_get_falso):
        resultado = geocatmin.consultar("-12.5,-76.7")

    assert resultado is not None
    assert resultado["v"] == 6
    assert resultado["fallas"] == {
        "escala": "50k",
        "items": [{"nombre": "Falla X", "tipo": "Normal"}],
    }
    # El resto sigue best-effort normal (sin datos en este fake): no debe
    # reventar ni contaminarse con la respuesta de fallas.
    assert resultado["concesion"] is None
    assert resultado["geologia_50k"] is None

"""Tests de geocatmin.py — específicamente la consulta de fallas geológicas
cercanas (julio 2026). Todo mockeado con requests.get; nunca hace una
llamada de red real (mismo patrón que test_asesor.py con requests.post)."""
import json
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

import pytest
import requests as requests_mod

import geocatmin


class _RespuestaFalsa:
    def __init__(self, data: dict):
        self._data = data
        # _query_geometria_poligono / _query_cercania(latin1=True) parsean
        # desde r.content decodificado latin-1 (no desde r.json()) — los
        # datos de test son ASCII, así que el mismo JSON re-encodificado
        # sirve para ambos caminos.
        self.content = json.dumps(data).encode("latin-1")

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
    assert resultado["v"] == 7
    assert resultado["fallas"] == {
        "escala": "50k",
        "items": [{"nombre": "Falla X", "tipo": "Normal"}],
    }
    # El resto sigue best-effort normal (sin datos en este fake): no debe
    # reventar ni contaminarse con la respuesta de fallas.
    assert resultado["concesion"] is None
    assert resultado["geologia_50k"] is None
    # Sin polígono (concesion None), los sedimentos se buscan por radio
    # alrededor del pin y el fake no tiene muestras: se verificó y no hay.
    assert resultado["sedimentos"] == {"total_dentro": 0, "dentro": [], "cercanas": []}


# ---------- _sedimentos_en_zona (agosto 2026) ----------


def _poligono_ejemplo():
    # Cuadrado de ~1.1 km de lado centrado cerca del pin (-76.7, -12.5).
    return [[[-76.70, -12.50], [-76.69, -12.50], [-76.69, -12.49], [-76.70, -12.49], [-76.70, -12.50]]]


def test_sedimentos_en_zona_lista_muestras_dentro_del_poligono():
    features = [
        {
            "attributes": {
                "CODIGO": "SGQ-1",
                "NOMBRE_PROYECTO": "Proyecto de prueba",
                "CU_PPM": "513",
                "AU_PPB": "N.R.",
            },
            "geometry": {"x": -76.695, "y": -12.495},
        },
        {"attributes": {"CODIGO": "SGQ-2", "NOMBRE_PROYECTO": None}, "geometry": {"x": -76.69, "y": -12.5}},
    ]
    with patch("geocatmin.requests.get") as mock_get:
        mock_get.return_value = _RespuestaFalsa({"features": features})
        resultado = geocatmin._sedimentos_en_zona(-76.7, -12.5, _poligono_ejemplo())
    assert mock_get.call_count == 1  # con muestras dentro no se consulta el buffer
    assert resultado == {
        "total_dentro": 2,
        "dentro": [
            {"codigo": "SGQ-1", "proyecto": "Proyecto de prueba", "leyes": {"CU_PPM": "513"}},
            {"codigo": "SGQ-2", "proyecto": None, "leyes": {}},
        ],
        "cercanas": [],
    }


def test_sedimentos_en_zona_sin_dentro_busca_cercanas_con_buffer():
    # La consulta exacta responde vacía (verificado: no hay dentro) y la
    # del buffer ampliado trae la muestra.
    respuestas = [
        _RespuestaFalsa({"features": []}),
        _RespuestaFalsa(
            {
                "features": [
                    {
                        "attributes": {"CODIGO": "SGQ-3", "NOMBRE_PROYECTO": None},
                        "geometry": {"x": -76.68, "y": -12.5},
                    }
                ]
            }
        ),
    ]
    with patch("geocatmin.requests.get", side_effect=respuestas) as mock_get:
        resultado = geocatmin._sedimentos_en_zona(-76.7, -12.5, _poligono_ejemplo())
    assert mock_get.call_count == 2  # exacta (vacía) + buffer ampliado
    _, kwargs = mock_get.call_args
    assert kwargs["params"]["distance"] == geocatmin._DISTANCIA_SEDIMENTOS_M
    assert resultado["total_dentro"] == 0
    assert resultado["dentro"] == []
    assert len(resultado["cercanas"]) == 1
    cercana = resultado["cercanas"][0]
    assert cercana["codigo"] == "SGQ-3"
    # ~2 km al este del pin (0.02° de longitud a -12.5 de latitud).
    assert 1.5 < cercana["distancia_km"] < 2.5


def test_sedimentos_en_zona_sin_dentro_y_buffer_caido_cae_al_radio_del_pin():
    cola = [
        _RespuestaFalsa({"features": []}),  # exacta: sin muestras dentro
        requests_mod.RequestException("timeout"),  # buffer ampliado falla
        _RespuestaFalsa(
            {
                "features": [
                    {
                        "attributes": {"CODIGO": "SGQ-4", "NOMBRE_PROYECTO": None},
                        "geometry": {"x": -76.69, "y": -12.51},
                    }
                ]
            }
        ),  # radio alrededor del pin
    ]

    def _side_effect(*args, **kwargs):
        item = cola.pop(0)
        if isinstance(item, Exception):
            raise item
        return item

    with patch("geocatmin.requests.get", side_effect=_side_effect):
        resultado = geocatmin._sedimentos_en_zona(-76.7, -12.5, _poligono_ejemplo())
    assert resultado["total_dentro"] == 0
    assert [c["codigo"] for c in resultado["cercanas"]] == ["SGQ-4"]


def test_sedimentos_en_zona_none_si_consulta_del_poligono_falla():
    with patch("geocatmin.requests.get", side_effect=requests_mod.RequestException("timeout")):
        assert geocatmin._sedimentos_en_zona(-76.7, -12.5, _poligono_ejemplo()) is None


def test_sedimentos_en_zona_sin_poligono_busca_por_radio_alrededor_del_pin():
    with patch("geocatmin.requests.get") as mock_get:
        mock_get.return_value = _RespuestaFalsa(
            {
                "features": [
                    {
                        "attributes": {"CODIGO": "SGQ-5", "NOMBRE_PROYECTO": None},
                        "geometry": {"x": -76.69, "y": -12.5},
                    }
                ]
            }
        )
        resultado = geocatmin._sedimentos_en_zona(-76.7, -12.5, None)
    assert mock_get.call_count == 1
    assert resultado == {
        "total_dentro": 0,
        "dentro": [],
        "cercanas": [
            {
                "codigo": "SGQ-5",
                "proyecto": None,
                "leyes": {},
                # 0.01° de longitud a -12.5° de latitud ≈ 1.1 km.
                "distancia_km": pytest.approx(1.1, abs=0.3),
            }
        ],
    }


def test_muestra_sedimento_filtra_leyes_sin_valor():
    feature = {
        "attributes": {
            "CODIGO": "SGQ-6",
            "AU_PPB": "N.R.",
            "AU_PPM": "",
            "CU_PPM": "<10",
            "ZN_PPM": 31.7,
            "SB_PPM": None,
        }
    }
    muestra = geocatmin._muestra_sedimento(feature)
    assert muestra["leyes"] == {"CU_PPM": "<10", "ZN_PPM": "31.7"}


# ---------- resumen_para_ia (agosto 2026) ----------


def test_resumen_para_ia_none_sin_cache():
    assert geocatmin.resumen_para_ia(None) is None
    assert geocatmin.resumen_para_ia({}) is None


def test_resumen_para_ia_prefiere_litologia_50k_sobre_100k():
    cache = {
        "concesion": {"nombre": "Minera Ejemplo", "hectareas": 120},
        "geologia": {"descripcion": "Descripción genérica 100K"},
        "geologia_50k": {"litologia": "Andesita porfirítica"},
        "fallas": {"escala": "50k", "items": [{"nombre": "Falla X", "tipo": "Normal"}]},
    }
    resumen = geocatmin.resumen_para_ia(cache)
    assert resumen["concesion_nombre"] == "Minera Ejemplo"
    assert resumen["concesion_hectareas"] == 120
    assert resumen["litologia"] == "Andesita porfirítica"
    assert resumen["escala_litologia"] == "1:50,000"
    assert resumen["fallas_escala"] == "50k"
    assert resumen["fallas_items"] == ["Falla X"]


def test_resumen_para_ia_cae_a_100k_sin_50k():
    cache = {"concesion": None, "geologia": {"descripcion": "Unidad genérica"}, "geologia_50k": None}
    resumen = geocatmin.resumen_para_ia(cache)
    assert resumen["litologia"] == "Unidad genérica"
    assert resumen["escala_litologia"] == "1:100,000"


# ---------- imagenes_analisis_ia (agosto 2026) ----------


def test_imagenes_analisis_ia_desactivado_por_defecto():
    # _DESACTIVADO ya quedó fijo en True a nivel de módulo (ver comentario
    # arriba de este archivo) -- ni siquiera intenta armar el bbox.
    assert geocatmin.imagenes_analisis_ia("-12.5,-76.7", None) is None


def test_imagenes_analisis_ia_none_sin_coords(monkeypatch):
    monkeypatch.setattr(geocatmin, "_DESACTIVADO", False)
    assert geocatmin.imagenes_analisis_ia(None, None) is None


def test_imagenes_analisis_ia_mejor_esfuerzo_si_fallan_ambas_capas(monkeypatch):
    monkeypatch.setattr(geocatmin, "_DESACTIVADO", False)
    with patch("geocatmin.requests.get", side_effect=requests_mod.RequestException("timeout")):
        assert geocatmin.imagenes_analisis_ia("-12.5,-76.7", None) is None


# ---------- imagen_mapa_cotejo (agosto 2026: ahora también dibuja fallas) ----------


def test_imagen_mapa_cotejo_desactivado_por_defecto():
    assert geocatmin.imagen_mapa_cotejo("-12.5,-76.7", None, "50k") is None


def test_imagen_mapa_cotejo_none_sin_coords(monkeypatch):
    monkeypatch.setattr(geocatmin, "_DESACTIVADO", False)
    assert geocatmin.imagen_mapa_cotejo(None, None, None) is None


def test_imagen_mapa_cotejo_pide_fallas_solo_si_se_indica_escala(monkeypatch):
    monkeypatch.setattr(geocatmin, "_DESACTIVADO", False)

    urls_pedidas = []

    def _get_falso(url, params=None, timeout=None):
        urls_pedidas.append(url)
        # PNG 1x1 válido — suficiente para que Pillow lo abra sin reventar.
        png_1x1 = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
            b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
            b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
        )

        class _Resp:
            content = png_1x1

            def raise_for_status(self):
                pass

        return _Resp()

    with patch("geocatmin.requests.get", side_effect=_get_falso):
        sin_fallas = geocatmin.imagen_mapa_cotejo("-12.5,-76.7", None, None)
        urls_sin_fallas = list(urls_pedidas)
        urls_pedidas.clear()
        con_fallas = geocatmin.imagen_mapa_cotejo("-12.5,-76.7", None, "50k")

    assert sin_fallas is not None
    assert con_fallas is not None
    assert not any("GEOLOGIA_50K_INTEGRADA/MapServer/export" in u for u in urls_sin_fallas)
    assert any("GEOLOGIA_50K_INTEGRADA/MapServer/export" in u for u in urls_pedidas)


# ---------- _bbox_y_tamano_ajustado_poligono (agosto 2026) ----------


def test_bbox_y_tamano_ajustado_poligono_centra_en_el_poligono_no_en_el_pin():
    # El pin queda lejos del polígono a propósito -- el bbox viejo
    # (_bbox_de) se centraba en el PIN, así que la concesión terminaba
    # como un recuadro chico perdido en una esquina (bug real reportado
    # en vivo con captura). El nuevo debe centrarse en el polígono.
    poligono = [[[-77.50, -8.01], [-77.49, -8.01], [-77.49, -8.00], [-77.50, -8.00]]]
    pin_lejano = "-9.50,-70.00"
    bbox, tamano = geocatmin._bbox_y_tamano_ajustado_poligono(poligono, pin_lejano)
    xmin, ymin, xmax, ymax = bbox
    centro_poligono_lng = (-77.50 + -77.49) / 2
    centro_poligono_lat = (-8.01 + -8.00) / 2
    centro_bbox_lng = (xmin + xmax) / 2
    centro_bbox_lat = (ymin + ymax) / 2
    assert centro_bbox_lng == pytest.approx(centro_poligono_lng, abs=1e-9)
    assert centro_bbox_lat == pytest.approx(centro_poligono_lat, abs=1e-9)
    # El polígono completo debe caber dentro del bbox.
    assert xmin <= -77.50 and xmax >= -77.49
    assert ymin <= -8.01 and ymax >= -8.00
    assert tamano[0] >= geocatmin._LADO_ANALISIS_MIN and tamano[1] >= geocatmin._LADO_ANALISIS_MIN


def test_bbox_y_tamano_ajustado_poligono_llena_el_cuadro_sin_distorsion():
    # Polígono mucho más angosto que alto (a diferencia del panorama fijo
    # de la portada) -- el lienzo debe seguir ESE aspecto, no el
    # panorámico, para que el polígono llene el cuadro sin dejar margen
    # vacío a los costados (el bug reportado: "no está centrando bien...
    # quiero que sea igual que el de Anomalías Espectrales... en esa
    # escala", comparado contra Copernicus que sí llena el cuadro).
    poligono = [[[-77.505, -8.018], [-77.495, -8.018], [-77.495, -8.002], [-77.505, -8.002]]]
    bbox, tamano = geocatmin._bbox_y_tamano_ajustado_poligono(poligono, "-8.01,-77.50")
    xmin, ymin, xmax, ymax = bbox
    ancho_grados, alto_grados = xmax - xmin, ymax - ymin
    ancho_px, alto_px = tamano
    # El aspecto del lienzo en píxeles debe calzar con el aspecto real del
    # bbox en grados (sin forzarlo al panorámico _ASPECTO_PDF ≈ 2.87:1).
    assert (ancho_px / alto_px) == pytest.approx(ancho_grados / alto_grados, rel=0.02)
    assert alto_px > ancho_px  # el polígono es más alto que ancho


def test_bbox_y_tamano_ajustado_poligono_sin_poligono_cae_al_pin():
    bbox, tamano = geocatmin._bbox_y_tamano_ajustado_poligono(None, "-12.5,-76.7")
    xmin, ymin, xmax, ymax = bbox
    assert xmin < -76.7 < xmax
    assert ymin < -12.5 < ymax
    assert tamano[0] == tamano[1]  # caja cuadrada alrededor del pin


def test_bbox_y_tamano_ajustado_poligono_sin_nada_devuelve_none():
    assert geocatmin._bbox_y_tamano_ajustado_poligono(None, None) == (None, None)


def test_imagen_analisis_catastro_usa_bbox_y_tamano_ajustados_al_poligono(monkeypatch):
    monkeypatch.setattr(geocatmin, "_DESACTIVADO", False)
    poligono = [[[-77.50, -8.01], [-77.49, -8.01], [-77.49, -8.00], [-77.50, -8.00]]]

    llamadas = []

    def _espia(
        coords, poligono_arg, escala_fallas=None, bbox_fijo=None, tamano_fijo=None, con_borde=False
    ):
        llamadas.append((bbox_fijo, tamano_fijo, con_borde))
        return b"fake-jpeg-bytes"

    monkeypatch.setattr(geocatmin, "imagen_mapa_cotejo", _espia)
    resultado = geocatmin.imagen_analisis_catastro("-12.5,-76.7", poligono, None)

    assert resultado == b"fake-jpeg-bytes"
    bbox, tamano = geocatmin._bbox_y_tamano_ajustado_poligono(poligono, "-12.5,-76.7")
    # con_borde=True: en la galería del PDF esta imagen va junto a las otras
    # 8 capas y TODAS deben mostrar el polígono de la concesión (pedido
    # explícito, agosto 2026).
    assert llamadas == [(bbox, tamano, True)]


def test_imagen_analisis_catastro_dibuja_el_borde_de_la_concesion(monkeypatch):
    # De punta a punta (con las llamadas a ArcGIS mockeadas): la imagen de
    # catastro/geología/fallas debe terminar con el contorno cian de LA
    # concesión del proyecto encima. Sin esto solo se veían los contornos
    # azules que INGEMMET dibuja para TODAS las concesiones de la zona, sin
    # distinguir cuál es la del proyecto.
    monkeypatch.setattr(geocatmin, "_DESACTIVADO", False)
    from PIL import Image as _Image

    def _capa_falsa(url, bbox, layers=None, tamano=None):
        ancho, alto = tamano or (geocatmin._ANCHO_MAPA, geocatmin._ALTO_MAPA)
        # Base opaca negra para la primera capa (satélite), transparente el
        # resto -- así el único color vivo que puede aparecer es el borde.
        color = (0, 0, 0, 255) if "World_Imagery" in url else (0, 0, 0, 0)
        return _Image.new("RGBA", (ancho, alto), color)

    monkeypatch.setattr(geocatmin, "_exportar_capa", _capa_falsa)

    # Rombo con vértices en la mitad de cada lado, para que el contorno NO
    # coincida por casualidad con el borde de la imagen.
    poligono = [[[-77.50, -8.00], [-77.49, -8.01], [-77.50, -8.02], [-77.51, -8.01]]]
    jpeg = geocatmin.imagen_analisis_catastro("-8.01,-77.50", poligono, None)
    assert jpeg is not None

    import numpy as np
    from io import BytesIO

    pixeles = np.array(_Image.open(BytesIO(jpeg)).convert("RGB")).astype(int)
    # Todas las capas mockeadas son negras/transparentes, así que lo único
    # que puede pintar cian es el contorno de la concesión. Se buscan
    # píxeles con CARÁCTER cian (poco rojo, mucho verde y azul) en toda la
    # imagen, sin asumir en qué posición cae el polígono -- con el margen
    # de _MARGEN_ANALISIS el polígono ya no toca los bordes del cuadro,
    # justamente para que se vea el terreno alrededor.
    r, g, b = pixeles[:, :, 0], pixeles[:, :, 1], pixeles[:, :, 2]
    cian = (g > 120) & (b > 120) & (r < g - 40)
    assert cian.any(), "no se dibujó el contorno de la concesión"


def test_capa_overlay_3d_transparente_sin_base_satelital(monkeypatch):
    # Las capas de la vista 3D NO deben traer base satelital (el mapa 3D ya
    # pinta la suya) — solo la capa pedida, en PNG transparente para
    # superponerse sobre el terreno.
    from PIL import Image as _Image

    monkeypatch.setattr(geocatmin, "_DESACTIVADO", False)
    poligono = [[[-77.50, -8.01], [-77.49, -8.01], [-77.49, -8.00], [-77.50, -8.00]]]
    llamadas = []

    def _capa_falsa(url, bbox, layers=None, tamano=None):
        llamadas.append((url, layers))
        # Transparente salvo un píxel: ninguna capa 3D debe traer fondo opaco.
        img = _Image.new(
            "RGBA", tamano or (geocatmin._ANCHO_MAPA, geocatmin._ALTO_MAPA), (0, 0, 0, 0)
        )
        img.putpixel((0, 0), (255, 0, 0, 255))
        return img

    monkeypatch.setattr(geocatmin, "_exportar_capa", _capa_falsa)

    png = geocatmin.capa_overlay_3d("-8.01,-77.50", poligono, "catastro")
    assert png is not None

    import numpy as np
    from io import BytesIO

    pixeles = np.array(_Image.open(BytesIO(png)).convert("RGBA")).astype(int)
    assert (pixeles[:, :, 3] > 200).sum() <= 1, "la capa 3D quedó con fondo opaco"
    assert llamadas and "SERV_CATASTRO" in llamadas[0][0]
    assert not any("World_Imagery" in u for u, _ in llamadas), (
        "las capas 3D no deben pedir la base satelital de Esri"
    )


def test_capa_overlay_3d_usa_el_mismo_bbox_que_el_analisis(monkeypatch):
    from PIL import Image as _Image

    monkeypatch.setattr(geocatmin, "_DESACTIVADO", False)
    llamadas = []

    def _espia(url, bbox, layers=None, tamano=None):
        llamadas.append((url, bbox, layers, tamano))
        return _Image.new("RGBA", tamano or (1000, 1000), (0, 0, 0, 0))

    monkeypatch.setattr(geocatmin, "_exportar_capa", _espia)

    poligono = [[[-77.50, -8.01], [-77.49, -8.01], [-77.49, -8.00], [-77.50, -8.00]]]
    geocatmin.capa_overlay_3d("-8.01,-77.50", poligono, "geologia")
    bbox, tamano = geocatmin._bbox_y_tamano_ajustado_poligono(poligono, "-8.01,-77.50")
    assert len(llamadas) == 1
    url, bbox_capa, layers, tamano_capa = llamadas[0]
    assert "SERV_GEOLOGIA_100K" in url
    assert layers == "show:6"
    assert tuple(bbox_capa) == tuple(bbox)
    assert tamano_capa == tamano


def test_capa_overlay_3d_geologia_50k_usa_capa_y_timeout_propio(monkeypatch):
    from PIL import Image as _Image

    monkeypatch.setattr(geocatmin, "_DESACTIVADO", False)
    llamadas = []

    def _espia(url, bbox, layers=None, tamano=None, timeout=None):
        llamadas.append((url, layers, timeout))
        return _Image.new("RGBA", tamano or (1000, 1000), (0, 0, 0, 0))

    monkeypatch.setattr(geocatmin, "_exportar_capa", _espia)

    poligono = [[[-77.50, -8.01], [-77.49, -8.01], [-77.49, -8.00], [-77.50, -8.00]]]
    png = geocatmin.capa_overlay_3d("-8.01,-77.50", poligono, "geologia_50k")
    assert png is not None
    assert len(llamadas) == 1
    url, layers, timeout = llamadas[0]
    assert "SERV_GEOLOGIA_50K" in url
    assert layers == "show:7"
    assert timeout == geocatmin._TIMEOUT_50K, "la 50K debe usar su timeout propio"


def test_capa_overlay_3d_fallas_requiere_escala_y_usa_la_capa_correcta(monkeypatch):
    from PIL import Image as _Image

    monkeypatch.setattr(geocatmin, "_DESACTIVADO", False)
    llamadas = []

    def _espia(url, bbox, layers=None, tamano=None):
        llamadas.append((url, layers))
        return _Image.new("RGBA", tamano or (1000, 1000), (0, 0, 0, 0))

    monkeypatch.setattr(geocatmin, "_exportar_capa", _espia)

    # Sin escala confirmada no hay fallas que dibujar (mismo criterio 2D).
    assert geocatmin.capa_overlay_3d("-8.01,-77.50", None, "fallas", None) is None

    geocatmin.capa_overlay_3d("-8.01,-77.50", None, "fallas", "50k")
    assert llamadas and "SERV_GEOLOGIA_50K" in llamadas[0][0]
    assert llamadas[0][1] == "show:2"

    geocatmin.capa_overlay_3d("-8.01,-77.50", None, "fallas", "100k")
    assert "SERV_GEOLOGIA_100K" in llamadas[1][0]
    assert llamadas[1][1] == "show:3"


def test_capa_overlay_3d_capa_desconocida_devuelve_none():
    assert geocatmin.capa_overlay_3d("-8.01,-77.50", None, "no_existe") is None


def test_capa_overlay_3d_sedimentos_quebrada_usa_el_servicio_de_geoquimica(monkeypatch):
    from PIL import Image as _Image

    monkeypatch.setattr(geocatmin, "_DESACTIVADO", False)
    llamadas = []

    def _espia(url, bbox, layers=None, tamano=None):
        llamadas.append((url, layers, bbox, tamano))
        return _Image.new("RGBA", tamano or (1000, 1000), (0, 0, 0, 0))

    monkeypatch.setattr(geocatmin, "_exportar_capa", _espia)

    poligono = [[[-77.50, -8.01], [-77.49, -8.01], [-77.49, -8.00], [-77.50, -8.00]]]
    png = geocatmin.capa_overlay_3d("-8.01,-77.50", poligono, "sedimentos_quebrada")
    assert png is not None
    assert len(llamadas) == 1
    url, layers, bbox, tamano = llamadas[0]
    assert "SERV_GEOQUIMICA_2022" in url
    assert layers == "show:0"
    bbox_esperado, tamano_esperado = geocatmin._bbox_y_tamano_ajustado_poligono(
        poligono, "-8.01,-77.50"
    )
    assert tuple(bbox) == tuple(bbox_esperado)
    assert tamano == tamano_esperado

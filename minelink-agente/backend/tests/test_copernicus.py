"""Tests de copernicus.py (julio 2026). Sin credenciales de CDSE reales en
el entorno de tests, `generar_capas` siempre debe devolver None (best-
effort, igual que geocatmin/reinfo) — nunca intenta una llamada de red
real. `bbox_de_poligono` y `_capa_coincidencias` son lógica pura, se
prueban directo. Un test aparte mockea `_pedir`/`_config` para probar
`generar_capas` de punta a punta sin red real (ver más abajo)."""
from io import BytesIO

import numpy as np
from PIL import Image

import copernicus


def test_desactivado_por_defecto():
    # Mismo patrón que reinfo.py: sin MINELINK_COPERNICUS=1 en el
    # entorno, queda desactivado -- los tests nunca gastan créditos reales.
    assert copernicus._DESACTIVADO is True


def test_generar_capas_devuelve_none_si_esta_desactivado():
    poligono = [[[-77.51, -8.01], [-77.49, -8.01], [-77.49, -7.99], [-77.51, -7.99]]]
    assert copernicus.generar_capas(poligono) is None


def test_bbox_de_poligono():
    # Anillo ArcGIS [lng, lat] -- mismo formato que geocatmin.concesion.poligono.
    poligono = [[[-77.51, -8.02], [-77.48, -8.02], [-77.48, -7.99], [-77.51, -7.99]]]
    assert copernicus.bbox_de_poligono(poligono) == (-77.51, -8.02, -77.48, -7.99)


def test_bbox_de_poligono_vacio_devuelve_none():
    assert copernicus.bbox_de_poligono([]) is None
    assert copernicus.bbox_de_poligono(None) is None
    assert copernicus.bbox_de_poligono([[]]) is None


def test_nombres_capas_incluye_los_4_indices_el_combinado_y_coincidencias():
    assert copernicus.NOMBRES_CAPAS == [
        "oxidos_de_hierro",
        "arcillas",
        "hierro_ferroso",
        "arcilla_sulfatos_mica",
        "combinado",
        "coincidencias",
    ]


def test_capa_coincidencias_solo_pinta_pixeles_con_2_o_mas():
    # 2x2: (0,0) ningún índice, (0,1) 1 índice, (1,0) 2 índices, (1,1) 4.
    conteo = np.array([[0, 1], [2, 4]], dtype=np.uint8)
    imagen = copernicus._capa_coincidencias(conteo)
    pixeles = np.array(imagen)

    assert tuple(pixeles[0, 0]) == (0, 0, 0, 0)
    assert tuple(pixeles[0, 1]) == (0, 0, 0, 0)
    assert tuple(pixeles[1, 0]) == (*copernicus._COLOR_COINCIDENCIAS, 140)
    assert tuple(pixeles[1, 1]) == (*copernicus._COLOR_COINCIDENCIAS, 255)


def _alpha(png_bytes: bytes) -> np.ndarray:
    return np.array(Image.open(BytesIO(png_bytes)).convert("RGBA"))[:, :, 3]


def test_generar_capas_combinado_transparente_donde_ningun_indice_detecto_nada(monkeypatch):
    # julio 2026, reportado en vivo con captura: "combinado" traía su
    # propia foto RGB de fondo (una consulta aparte a Sentinel Hub) y
    # tapaba el mapa entero al activarlo -- "solo pido los colores, no la
    # imagen de fondo". Ahora debe quedar transparente exactamente donde
    # NINGUNO de los 4 índices detectó nada, igual que las capas
    # individuales -- se verifica contra la unión real de sus máscaras,
    # no contra un umbral calculado a mano.
    monkeypatch.setattr(copernicus, "_DESACTIVADO", False)
    monkeypatch.setattr(copernicus, "_config", lambda: object())

    rng = np.random.default_rng(42)

    def _pedir_falso(config, bbox, evalscript, formato):
        return rng.random((6, 6)).astype(np.float32)

    monkeypatch.setattr(copernicus, "_pedir", _pedir_falso)

    poligono = [[[-77.51, -8.02], [-77.48, -8.02], [-77.48, -7.99], [-77.51, -7.99]]]
    resultado = copernicus.generar_capas(poligono)
    assert resultado is not None

    alpha_combinado = _alpha(resultado["capas"]["combinado"])
    alpha_union = np.zeros((6, 6), dtype=bool)
    for nombre in copernicus._INDICES:
        alpha_union |= _alpha(resultado["capas"][nombre]) > 0

    assert alpha_union.any()  # sanity check: la mezcla aleatoria sí generó algo
    assert bool((alpha_combinado[~alpha_union] == 0).all())
    assert bool((alpha_combinado[alpha_union] > 0).all())

"""Tests de copernicus.py (julio 2026). Sin credenciales de CDSE reales en
el entorno de tests, `generar_capas` siempre debe devolver None (best-
effort, igual que geocatmin/reinfo) — nunca intenta una llamada de red
real. `bbox_y_tamano_de_poligono` y `_capa_coincidencias` son lógica pura,
se prueban directo. Un test aparte mockea `_pedir`/`_config` para probar
`generar_capas` de punta a punta sin red real (ver más abajo)."""
from io import BytesIO

import numpy as np
import pytest
from PIL import Image

import copernicus


def test_desactivado_por_defecto():
    # Mismo patrón que reinfo.py: sin MINELINK_COPERNICUS=1 en el
    # entorno, queda desactivado -- los tests nunca gastan créditos reales.
    assert copernicus._DESACTIVADO is True


def test_generar_capas_devuelve_none_si_esta_desactivado():
    poligono = [[[-77.51, -8.01], [-77.49, -8.01], [-77.49, -7.99], [-77.51, -7.99]]]
    assert copernicus.generar_capas(poligono) is None


def test_bbox_y_tamano_de_poligono_contiene_el_poligono_con_margen():
    # Anillo ArcGIS [lng, lat] -- mismo formato que geocatmin.concesion.poligono.
    # Polígono cuadrado (1:1) -- el lienzo debe salir cuadrado también.
    poligono = [[[-77.51, -8.02], [-77.48, -8.02], [-77.48, -7.99], [-77.51, -7.99]]]
    bbox, tamano = copernicus.bbox_y_tamano_de_poligono(poligono)
    xmin, ymin, xmax, ymax = bbox
    assert xmin < -77.51 and xmax > -77.48
    assert ymin < -8.02 and ymax > -7.99
    assert tamano == (copernicus._LADO_PX_MAX, copernicus._LADO_PX_MAX)


def test_bbox_y_tamano_de_poligono_no_distorsiona_poligono_angosto():
    # Polígono mucho más angosto que alto -- el lienzo debe seguir ESE
    # aspecto en vez de forzar un cuadrado (agosto 2026, pedido explícito
    # tras comparar en vivo contra GEOCATMIN: "las fotos de Copernicus
    # deben ser como la de ASTER 931 o Anomalías Espectrales... todas las
    # capas deben ser iguales a esas" -- mismo criterio que
    # geocatmin._bbox_y_tamano_ajustado_poligono).
    poligono = [[[-77.505, -8.018], [-77.495, -8.018], [-77.495, -8.002], [-77.505, -8.002]]]
    bbox, tamano = copernicus.bbox_y_tamano_de_poligono(poligono)
    xmin, ymin, xmax, ymax = bbox
    ancho_grados, alto_grados = xmax - xmin, ymax - ymin
    ancho_px, alto_px = tamano
    assert (ancho_px / alto_px) == pytest.approx(ancho_grados / alto_grados, rel=0.02)
    assert alto_px > ancho_px


def test_bbox_y_tamano_de_poligono_vacio_devuelve_none():
    assert copernicus.bbox_y_tamano_de_poligono([]) == (None, None)
    assert copernicus.bbox_y_tamano_de_poligono(None) == (None, None)
    assert copernicus.bbox_y_tamano_de_poligono([[]]) == (None, None)


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

    def _pedir_falso(config, bbox, evalscript, formato, tamano):
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


def test_con_borde_poligono_dibuja_el_contorno_sin_rellenar():
    # agosto 2026, reportado en vivo: "las capas se presentan solo ellas
    # y no se puede distinguir en qué área del polígono catastral" -- las
    # 6 capas ahora dibujan el contorno de la concesión encima, para que
    # se vea qué cae DENTRO del polígono real y qué es solo el margen del
    # bounding box. Un rombo con vértices en la mitad de cada lado del
    # bbox (no un rectángulo pegado a los 4 bordes) para que el contorno
    # NO coincida por casualidad con el borde de la imagen misma.
    imagen = Image.new("RGBA", (10, 10), (0, 0, 0, 0))
    bbox_coords = (-77.51, -8.02, -77.48, -7.99)  # cuadrado de 10x10 px
    # Vértice superior en (px=5, py=0), derecho en (10,5), inferior en
    # (5,10), izquierdo en (0,5).
    poligono = [
        [
            [-77.495, -7.99],  # arriba
            [-77.48, -8.005],  # derecha
            [-77.495, -8.02],  # abajo
            [-77.51, -8.005],  # izquierda
            [-77.495, -7.99],
        ]
    ]
    resultado = copernicus._con_borde_poligono(imagen, bbox_coords, poligono)
    pixeles = np.array(resultado)
    color_borde = tuple(copernicus._COLOR_BORDE_CONCESION)

    assert tuple(pixeles[0, 5]) == color_borde  # vértice de arriba
    # El centro de la imagen es el INTERIOR del rombo, no su borde -- debe
    # quedar transparente (confirma que se dibuja un contorno, no un relleno).
    assert tuple(pixeles[5, 5]) == (0, 0, 0, 0)


def test_con_borde_poligono_sin_poligono_no_hace_nada():
    imagen = Image.new("RGBA", (10, 10), (0, 0, 0, 0))
    resultado = copernicus._con_borde_poligono(imagen, (-77.51, -8.02, -77.48, -7.99), None)
    assert np.array(resultado).sum() == 0

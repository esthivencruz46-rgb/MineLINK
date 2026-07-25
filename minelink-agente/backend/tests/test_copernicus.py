"""Tests de copernicus.py (julio 2026). Sin credenciales de CDSE reales en
el entorno de tests, `generar_capas` siempre debe devolver None (best-
effort, igual que geocatmin/reinfo) — nunca intenta una llamada de red
real. `bbox_de_poligono` es lógica pura, se prueba directo."""
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


def test_nombres_capas_incluye_los_4_indices_y_el_combinado():
    assert copernicus.NOMBRES_CAPAS == [
        "oxidos_de_hierro",
        "arcillas",
        "hierro_ferroso",
        "arcilla_sulfatos_mica",
        "combinado",
    ]

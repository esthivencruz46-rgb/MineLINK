"""Tests de noticias.py (julio 2026). MINELINK_NOTICIAS=0 en el entorno de
tests (ver tests/test_smoke.py) -- `refrescar()` nunca debe intentar una
llamada de red real. El resto es lógica pura, se prueba directo.

Fuente real: la API REST de WordPress (`wp-json/wp/v2/posts`), no el RSS
(ver docstring de noticias.py -- se migró de RSS a wp-json porque el RSS
no trae imagen destacada y wp-json sí, además de separar categoría real
de simples etiquetas). El filtro es por CATEGORÍA (taxonomy="category"),
no por palabra clave en el texto -- Rumbo Minero etiqueta explícitamente
todo lo internacional como "Internacionales"/país en mayúsculas; lo
peruano no lleva esa etiqueta aunque no diga "Perú" en ningún lado."""
from unittest.mock import patch

import noticias


def _post(
    titulo: str,
    enlace: str,
    descripcion_html: str,
    fecha: str,
    categorias: list[str],
    tags: list[str] | None = None,
    imagen: str | None = "https://www.rumbominero.com/wp-content/uploads/2026/07/foto.jpg",
) -> dict:
    """Arma un post con la misma forma que devuelve wp-json con
    `_embed=wp:featuredmedia,wp:term` -- categorías y etiquetas viven en
    grupos separados dentro de `_embedded["wp:term"]`, distinguidos por
    `taxonomy`."""
    embebido: dict = {
        "wp:term": [
            [{"name": c, "taxonomy": "category"} for c in categorias],
            [{"name": t, "taxonomy": "post_tag"} for t in (tags or [])],
        ]
    }
    if imagen is not None:
        embebido["wp:featuredmedia"] = [
            {"media_details": {"sizes": {"medium": {"source_url": imagen}, "full": {"source_url": imagen}}}}
        ]
    return {
        "title": {"rendered": titulo},
        "link": enlace,
        "excerpt": {"rendered": descripcion_html},
        "date": fecha,
        "_embedded": embebido,
    }


_POSTS_DE_PRUEBA = [
    _post(
        "MINEM plantea ampliar el REINFO hasta diciembre de 2026",
        "https://www.rumbominero.com/reinfo-2026",
        "<p>El Ministerio de Energ&iacute;a y Minas anunci&oacute; una propuesta de ampliaci&oacute;n.</p>",
        "2026-07-28T10:00:00",
        ["Actualidad", "REINFO"],
        tags=["formalizacion"],
    ),
    _post(
        "Quellaveco genera S/ 40 millones en regalías para Moquegua",
        "https://www.rumbominero.com/quellaveco-moquegua",
        "El proyecto cuprífero sigue impulsando la economía regional.",
        "2026-07-28T09:30:00",
        ["Portada2"],
        tags=["Cobre"],
    ),
    _post(
        "El cobre en Chile bate récord de producción en el primer semestre",
        "https://www.rumbominero.com/chile-cobre-record",
        "Analisis del mercado internacional de metales.",
        "2026-07-28T09:00:00",
        ["Internacionales", "OTROS PAÍSES", "CHILE"],
        imagen=None,
    ),
]


def test_desactivado_en_el_entorno_de_tests():
    assert noticias._DESACTIVADO is True


def test_refrescar_no_llama_a_la_red_si_esta_desactivado():
    with patch("requests.get") as mock_get:
        noticias.refrescar()
        mock_get.assert_not_called()


def test_es_relevante_acepta_categorias_sin_etiqueta_internacional():
    assert noticias._es_relevante(["Actualidad", "REINFO"]) is True
    assert noticias._es_relevante(["Portada2"]) is True


def test_es_relevante_descarta_categoria_internacionales():
    assert noticias._es_relevante(["Internacionales", "OTROS PAÍSES", "CHILE"]) is False


def test_es_relevante_descarta_pais_suelto_sin_etiqueta_generica():
    assert noticias._es_relevante(["Bolivia"]) is False


def test_es_relevante_acepta_sin_categorias():
    # Formato inesperado / API distinta: por defecto se trata como
    # relevante, el sitio entero ya es de minería/energía peruana.
    assert noticias._es_relevante([]) is True


def test_limpiar_descripcion_quita_html_y_entidades():
    sucio = "<p>El Ministerio de Energ&iacute;a public&oacute; una norma.</p>"
    limpio = noticias._limpiar_descripcion(sucio)
    assert "<p>" not in limpio
    assert "Energía" in limpio


def test_limpiar_descripcion_trunca_texto_largo():
    texto = "palabra " * 100
    limpio = noticias._limpiar_descripcion(texto)
    assert len(limpio) <= noticias._MAX_CARACTERES_DESCRIPCION + 1  # +1 por el "…"
    assert limpio.endswith("…")


def test_extraer_imagen_toma_el_tamano_preferido():
    post = _post("t", "e", "d", "2026-01-01T00:00:00", ["Actualidad"])
    assert noticias._extraer_imagen(post) == (
        "https://www.rumbominero.com/wp-content/uploads/2026/07/foto.jpg"
    )


def test_extraer_imagen_none_si_no_hay_imagen_destacada():
    post = _post("t", "e", "d", "2026-01-01T00:00:00", ["Actualidad"], imagen=None)
    assert noticias._extraer_imagen(post) is None


def test_parsear_posts_extrae_titulo_link_descripcion_fecha_categorias_e_imagen():
    items = noticias._parsear_posts(_POSTS_DE_PRUEBA)
    assert len(items) == 3
    assert items[0]["titulo"] == "MINEM plantea ampliar el REINFO hasta diciembre de 2026"
    assert items[0]["enlace"] == "https://www.rumbominero.com/reinfo-2026"
    assert items[0]["fecha"] == "2026-07-28T10:00:00"
    assert items[0]["categorias"] == ["Actualidad", "REINFO"]
    assert items[0]["imagen"] is not None
    assert items[2]["categorias"] == ["Internacionales", "OTROS PAÍSES", "CHILE"]
    assert items[2]["imagen"] is None


def test_refrescar_filtra_por_categoria_internacional(monkeypatch):
    monkeypatch.setattr(noticias, "_DESACTIVADO", False)
    monkeypatch.setattr(noticias, "_CACHE", None)
    monkeypatch.setattr(noticias, "_ULTIMO_REFRESCO", None)

    respuesta_falsa = type("R", (), {"raise_for_status": lambda self: None, "json": lambda self: _POSTS_DE_PRUEBA})()
    with patch("requests.get", return_value=respuesta_falsa):
        noticias.refrescar()

    resultado = noticias.noticias_desde_cache()
    titulos = {n["titulo"] for n in resultado}
    assert "MINEM plantea ampliar el REINFO hasta diciembre de 2026" in titulos
    # Peruana pero sin decir "Perú" en ningún lado -- antes se perdía con
    # el filtro por palabra clave, ahora se incluye por no llevar la
    # categoría "Internacionales".
    assert "Quellaveco genera S/ 40 millones en regalías para Moquegua" in titulos
    assert "El cobre en Chile bate récord de producción en el primer semestre" not in titulos
    # La descripción llegó limpia (sin HTML crudo, entidades decodificadas)
    # y la imagen viajó hasta el resultado final.
    noticia_reinfo = next(n for n in resultado if "REINFO" in n["titulo"])
    assert "<p>" not in noticia_reinfo["descripcion"]
    assert "Energía" in noticia_reinfo["descripcion"]
    assert noticia_reinfo["imagen"] is not None


def test_refrescar_mejor_esfuerzo_si_falla_la_red(monkeypatch):
    # Mismo principio que geocatmin.py/reinfo.py: un fallo de red nunca
    # debe vaciar el caché existente, ni tumbar la portada.
    monkeypatch.setattr(noticias, "_DESACTIVADO", False)
    monkeypatch.setattr(
        noticias,
        "_CACHE",
        [{"titulo": "vieja pero valida", "descripcion": "", "enlace": "x", "fecha": "", "imagen": None}],
    )
    monkeypatch.setattr(noticias, "_ULTIMO_REFRESCO", None)

    with patch("requests.get", side_effect=Exception("timeout de red")):
        noticias.refrescar()

    assert noticias.noticias_desde_cache() == [
        {"titulo": "vieja pero valida", "descripcion": "", "enlace": "x", "fecha": "", "imagen": None}
    ]
    # Aun con el fallo, se marca el intento -- para no reintentar en cada
    # visita mientras el sitio externo esté caído.
    assert noticias._ULTIMO_REFRESCO is not None


def test_necesita_refresco_es_true_la_primera_vez(monkeypatch):
    monkeypatch.setattr(noticias, "_DESACTIVADO", False)
    monkeypatch.setattr(noticias, "_ULTIMO_REFRESCO", None)
    assert noticias.necesita_refresco() is True


def test_necesita_refresco_es_false_si_esta_desactivado(monkeypatch):
    monkeypatch.setattr(noticias, "_DESACTIVADO", True)
    assert noticias.necesita_refresco() is False

"""Tests de noticias.py (julio 2026). MINELINK_NOTICIAS=0 en el entorno de
tests (ver tests/test_smoke.py) -- `refrescar()` nunca debe intentar una
llamada de red real. El resto es lógica pura, se prueba directo.

El filtro es por CATEGORÍA del feed (no por palabra clave en el texto) --
ver el docstring de noticias.py: Rumbo Minero etiqueta explícitamente todo
lo internacional como "Internacionales"/país en mayúsculas; lo peruano no
lleva esa etiqueta aunque no diga "Perú" en ningún lado."""
from unittest.mock import patch

import noticias

_RSS_DE_PRUEBA = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Rumbo Minero</title>
    <item>
      <title>MINEM plantea ampliar el REINFO hasta diciembre de 2026</title>
      <link>https://www.rumbominero.com/reinfo-2026</link>
      <description>&lt;p&gt;El Ministerio de Energ&amp;iacute;a y Minas anunci&amp;oacute; una propuesta de ampliaci&amp;oacute;n.&lt;/p&gt;</description>
      <pubDate>Tue, 28 Jul 2026 10:00:00 +0000</pubDate>
      <category><![CDATA[Actualidad]]></category>
      <category><![CDATA[REINFO]]></category>
    </item>
    <item>
      <title>Quellaveco genera S/ 40 millones en regalías para Moquegua</title>
      <link>https://www.rumbominero.com/quellaveco-moquegua</link>
      <description>El proyecto cuprífero sigue impulsando la economía regional.</description>
      <pubDate>Tue, 28 Jul 2026 09:30:00 +0000</pubDate>
      <category><![CDATA[Portada2]]></category>
      <category><![CDATA[Cobre]]></category>
    </item>
    <item>
      <title>El cobre en Chile bate récord de producción en el primer semestre</title>
      <link>https://www.rumbominero.com/chile-cobre-record</link>
      <description>Analisis del mercado internacional de metales.</description>
      <pubDate>Tue, 28 Jul 2026 09:00:00 +0000</pubDate>
      <category><![CDATA[Internacionales]]></category>
      <category><![CDATA[OTROS PAÍSES]]></category>
      <category><![CDATA[CHILE]]></category>
    </item>
  </channel>
</rss>""".encode("utf-8")


class _RespuestaFalsa:
    def __init__(self, contenido: bytes):
        self.content = contenido

    def raise_for_status(self):
        pass


def test_desactivado_en_el_entorno_de_tests():
    assert noticias._DESACTIVADO is True


def test_refrescar_no_llama_a_la_red_si_esta_desactivado():
    with patch("requests.get") as mock_get:
        noticias.refrescar()
        mock_get.assert_not_called()


def test_es_relevante_acepta_categorias_sin_etiqueta_internacional():
    assert noticias._es_relevante(["Actualidad", "REINFO"]) is True
    assert noticias._es_relevante(["Portada2", "Cobre"]) is True


def test_es_relevante_descarta_categoria_internacionales():
    assert noticias._es_relevante(["Internacionales", "OTROS PAÍSES", "CHILE"]) is False


def test_es_relevante_descarta_pais_suelto_sin_etiqueta_generica():
    assert noticias._es_relevante(["Bolivia"]) is False


def test_es_relevante_acepta_sin_categorias():
    # Formato inesperado / feed distinto: por defecto se trata como
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


def test_parsear_rss_extrae_titulo_link_descripcion_fecha_y_categorias():
    items = noticias._parsear_rss(_RSS_DE_PRUEBA)
    assert len(items) == 3
    assert items[0]["titulo"] == "MINEM plantea ampliar el REINFO hasta diciembre de 2026"
    assert items[0]["enlace"] == "https://www.rumbominero.com/reinfo-2026"
    assert items[0]["fecha"] == "Tue, 28 Jul 2026 10:00:00 +0000"
    assert items[0]["categorias"] == ["Actualidad", "REINFO"]
    assert items[2]["categorias"] == ["Internacionales", "OTROS PAÍSES", "CHILE"]


def test_refrescar_filtra_por_categoria_internacional(monkeypatch):
    monkeypatch.setattr(noticias, "_DESACTIVADO", False)
    monkeypatch.setattr(noticias, "_CACHE", None)
    monkeypatch.setattr(noticias, "_ULTIMO_REFRESCO", None)

    with patch("requests.get", return_value=_RespuestaFalsa(_RSS_DE_PRUEBA)):
        noticias.refrescar()

    resultado = noticias.noticias_desde_cache()
    titulos = {n["titulo"] for n in resultado}
    assert "MINEM plantea ampliar el REINFO hasta diciembre de 2026" in titulos
    # Peruana pero sin decir "Perú" en ningún lado -- antes se perdía con
    # el filtro por palabra clave, ahora se incluye por no llevar la
    # categoría "Internacionales".
    assert "Quellaveco genera S/ 40 millones en regalías para Moquegua" in titulos
    assert "El cobre en Chile bate récord de producción en el primer semestre" not in titulos
    # La descripción llegó limpia (sin HTML crudo, entidades decodificadas).
    noticia_reinfo = next(n for n in resultado if "REINFO" in n["titulo"])
    assert "<p>" not in noticia_reinfo["descripcion"]
    assert "Energía" in noticia_reinfo["descripcion"]


def test_refrescar_mejor_esfuerzo_si_falla_la_red(monkeypatch):
    # Mismo principio que geocatmin.py/reinfo.py: un fallo de red nunca
    # debe vaciar el caché existente, ni tumbar la portada.
    monkeypatch.setattr(noticias, "_DESACTIVADO", False)
    monkeypatch.setattr(noticias, "_CACHE", [{"titulo": "vieja pero valida", "descripcion": "", "enlace": "x", "fecha": ""}])
    monkeypatch.setattr(noticias, "_ULTIMO_REFRESCO", None)

    with patch("requests.get", side_effect=Exception("timeout de red")):
        noticias.refrescar()

    assert noticias.noticias_desde_cache() == [
        {"titulo": "vieja pero valida", "descripcion": "", "enlace": "x", "fecha": ""}
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

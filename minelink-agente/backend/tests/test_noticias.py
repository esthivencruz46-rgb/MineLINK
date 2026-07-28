"""Tests de noticias.py (julio 2026). MINELINK_NOTICIAS=0 en el entorno de
tests (ver tests/test_smoke.py) -- `refrescar()` nunca debe intentar una
llamada de red real. El resto es lógica pura, se prueba directo."""
from unittest.mock import MagicMock, patch

import noticias

_RSS_DE_PRUEBA = b"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Rumbo Minero</title>
    <item>
      <title>MINEM plantea ampliar el REINFO hasta diciembre de 2026</title>
      <link>https://www.rumbominero.com/reinfo-2026</link>
      <description>&lt;p&gt;El Ministerio de Energ&amp;iacute;a y Minas anunci&amp;oacute; una propuesta de ampliaci&amp;oacute;n.&lt;/p&gt;</description>
      <pubDate>Tue, 28 Jul 2026 10:00:00 +0000</pubDate>
    </item>
    <item>
      <title>El precio del cobre sube en la bolsa de Londres</title>
      <link>https://www.rumbominero.com/cobre-precio</link>
      <description>Analisis del mercado internacional de metales.</description>
      <pubDate>Tue, 28 Jul 2026 09:00:00 +0000</pubDate>
    </item>
    <item>
      <title>Nueva concesion minera aprobada tras proceso de formalizacion</title>
      <link>https://www.rumbominero.com/formalizacion-concesion</link>
      <description>Un caso de formalizacion exitosa en la sierra.</description>
      <pubDate>Tue, 28 Jul 2026 08:00:00 +0000</pubDate>
    </item>
  </channel>
</rss>"""


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


def test_es_relevante_detecta_palabras_clave_sin_tildes():
    assert noticias._es_relevante("Avances en la formalización minera", "") is True
    assert noticias._es_relevante("REINFO se amplía", "") is True
    assert noticias._es_relevante("", "nueva concesión minera aprobada") is True


def test_es_relevante_descarta_noticias_no_relacionadas():
    assert noticias._es_relevante("El precio del cobre sube en Londres", "análisis de mercado") is False


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


def test_parsear_rss_extrae_titulo_link_descripcion_fecha():
    items = noticias._parsear_rss(_RSS_DE_PRUEBA)
    assert len(items) == 3
    assert items[0]["titulo"] == "MINEM plantea ampliar el REINFO hasta diciembre de 2026"
    assert items[0]["enlace"] == "https://www.rumbominero.com/reinfo-2026"
    assert items[0]["fecha"] == "Tue, 28 Jul 2026 10:00:00 +0000"


def test_refrescar_filtra_solo_noticias_relevantes(monkeypatch):
    # julio 2026: el feed general trae de todo (precio del cobre incluido)
    # -- solo debe quedar lo relevante a formalización minera.
    monkeypatch.setattr(noticias, "_DESACTIVADO", False)
    monkeypatch.setattr(noticias, "_CACHE", None)
    monkeypatch.setattr(noticias, "_ULTIMO_REFRESCO", None)

    with patch("requests.get", return_value=_RespuestaFalsa(_RSS_DE_PRUEBA)):
        noticias.refrescar()

    resultado = noticias.noticias_desde_cache()
    titulos = {n["titulo"] for n in resultado}
    assert "MINEM plantea ampliar el REINFO hasta diciembre de 2026" in titulos
    assert "Nueva concesion minera aprobada tras proceso de formalizacion" in titulos
    assert "El precio del cobre sube en la bolsa de Londres" not in titulos
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

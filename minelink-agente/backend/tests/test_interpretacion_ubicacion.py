"""Tests de interpretacion_ubicacion.py (julio 2026). Sin
MINELINK_INTERPRETACION_UBICACION=1 en el entorno de tests, queda
desactivado -- nunca intenta una llamada de red real ni gasta créditos de
Gemini (mismo patrón que reinfo.py/copernicus.py)."""
from unittest.mock import MagicMock, patch

import requests

import interpretacion_ubicacion


def test_desactivado_por_defecto():
    assert interpretacion_ubicacion._DESACTIVADO is True


def test_generar_interpretacion_devuelve_none_si_esta_desactivado(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "clave-de-prueba")
    assert (
        interpretacion_ubicacion.generar_interpretacion(
            {"oxidos_de_hierro": b"fake-png-bytes"}, "oro", "puno"
        )
        is None
    )


def test_generar_interpretacion_devuelve_none_sin_capas(monkeypatch):
    monkeypatch.setattr(interpretacion_ubicacion, "_DESACTIVADO", False)
    monkeypatch.setenv("GEMINI_API_KEY", "clave-de-prueba")
    assert interpretacion_ubicacion.generar_interpretacion({}, "oro", "puno") is None


def test_generar_interpretacion_devuelve_none_sin_api_key(monkeypatch):
    monkeypatch.setattr(interpretacion_ubicacion, "_DESACTIVADO", False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert (
        interpretacion_ubicacion.generar_interpretacion(
            {"oxidos_de_hierro": b"fake-png-bytes"}, "oro", "puno"
        )
        is None
    )


def test_generar_interpretacion_llama_a_gemini_y_arma_el_texto(monkeypatch):
    monkeypatch.setattr(interpretacion_ubicacion, "_DESACTIVADO", False)
    monkeypatch.setenv("GEMINI_API_KEY", "clave-de-prueba")

    respuesta_falsa = MagicMock()
    respuesta_falsa.raise_for_status = MagicMock()
    respuesta_falsa.json.return_value = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {"text": "Se observa una posible "},
                        {"text": "coincidencia en el sector norte de la concesión."},
                    ]
                }
            }
        ]
    }

    with patch("requests.post", return_value=respuesta_falsa) as mock_post:
        resultado = interpretacion_ubicacion.generar_interpretacion(
            {
                "oxidos_de_hierro": b"fake-png-1",
                "coincidencias": b"fake-png-2",
            },
            "oro",
            "puno",
        )

    assert resultado == "Se observa una posible coincidencia en el sector norte de la concesión."
    # Confirma que mandó las 2 imágenes como inlineData en base64, no como
    # bytes crudos (Gemini los rechazaría) -- y el system prompt con las
    # reglas duras acordadas.
    _url, kwargs = mock_post.call_args
    partes = kwargs["json"]["contents"][0]["parts"]
    imagenes = [p for p in partes if "inlineData" in p]
    assert len(imagenes) == 2
    assert imagenes[0]["inlineData"]["mimeType"] == "image/png"
    assert kwargs["json"]["systemInstruction"]["parts"][0]["text"] == interpretacion_ubicacion._SYSTEM
    assert "nunca afirmes que hay un mineral presente" in interpretacion_ubicacion._SYSTEM.lower()


def test_generar_interpretacion_mejor_esfuerzo_si_falla_la_red(monkeypatch):
    monkeypatch.setattr(interpretacion_ubicacion, "_DESACTIVADO", False)
    monkeypatch.setenv("GEMINI_API_KEY", "clave-de-prueba")

    with patch("requests.post", side_effect=requests.RequestException("timeout de red")):
        resultado = interpretacion_ubicacion.generar_interpretacion(
            {"oxidos_de_hierro": b"fake-png-bytes"}, "oro", "puno"
        )

    assert resultado is None


def test_generar_interpretacion_incluye_contexto_e_imagenes_de_geocatmin(monkeypatch):
    monkeypatch.setattr(interpretacion_ubicacion, "_DESACTIVADO", False)
    monkeypatch.setenv("GEMINI_API_KEY", "clave-de-prueba")

    respuesta_falsa = MagicMock()
    respuesta_falsa.raise_for_status = MagicMock()
    respuesta_falsa.json.return_value = {
        "candidates": [{"content": {"parts": [{"text": "Análisis combinado."}]}}]
    }

    with patch("requests.post", return_value=respuesta_falsa) as mock_post:
        resultado = interpretacion_ubicacion.generar_interpretacion(
            {"oxidos_de_hierro": b"fake-png-copernicus"},
            "oro",
            "puno",
            contexto_geocatmin={
                "concesion_nombre": "Minera Ejemplo",
                "concesion_hectareas": 120,
                "litologia": "Andesita porfirítica",
                "escala_litologia": "1:50,000",
                "fallas_escala": "50k",
                "fallas_items": ["Falla X"],
            },
            imagenes_geocatmin={"aster_931": b"fake-png-aster"},
        )

    assert resultado == "Análisis combinado."
    _url, kwargs = mock_post.call_args
    partes = kwargs["json"]["contents"][0]["parts"]
    imagenes = [p for p in partes if "inlineData" in p]
    # 1 de GEOCATMIN (aster_931) + 1 de Copernicus (oxidos_de_hierro).
    assert len(imagenes) == 2
    texto_completo = " ".join(p["text"] for p in partes if "text" in p)
    assert "Minera Ejemplo" in texto_completo
    assert "Andesita porfirítica" in texto_completo
    assert "1:50,000" in texto_completo
    assert "Falla X" in texto_completo


def test_generar_interpretacion_funciona_sin_datos_de_geocatmin(monkeypatch):
    # Si GEOCATMIN no tiene nada para esta concesión, la interpretación se
    # sigue generando solo con Copernicus (contexto/imágenes son opcionales).
    monkeypatch.setattr(interpretacion_ubicacion, "_DESACTIVADO", False)
    monkeypatch.setenv("GEMINI_API_KEY", "clave-de-prueba")

    respuesta_falsa = MagicMock()
    respuesta_falsa.raise_for_status = MagicMock()
    respuesta_falsa.json.return_value = {
        "candidates": [{"content": {"parts": [{"text": "Solo Copernicus."}]}}]
    }

    with patch("requests.post", return_value=respuesta_falsa) as mock_post:
        resultado = interpretacion_ubicacion.generar_interpretacion(
            {"oxidos_de_hierro": b"fake-png-copernicus"}, "oro", "puno"
        )

    assert resultado == "Solo Copernicus."
    _url, kwargs = mock_post.call_args
    partes = kwargs["json"]["contents"][0]["parts"]
    imagenes = [p for p in partes if "inlineData" in p]
    assert len(imagenes) == 1
    texto_completo = " ".join(p["text"] for p in partes if "text" in p)
    assert "No hay datos de catastro/geología de GEOCATMIN" in texto_completo


def test_generar_interpretacion_devuelve_none_si_el_texto_queda_vacio(monkeypatch):
    monkeypatch.setattr(interpretacion_ubicacion, "_DESACTIVADO", False)
    monkeypatch.setenv("GEMINI_API_KEY", "clave-de-prueba")

    respuesta_falsa = MagicMock()
    respuesta_falsa.raise_for_status = MagicMock()
    respuesta_falsa.json.return_value = {"candidates": [{"content": {"parts": [{"text": "   "}]}}]}

    with patch("requests.post", return_value=respuesta_falsa):
        resultado = interpretacion_ubicacion.generar_interpretacion(
            {"oxidos_de_hierro": b"fake-png-bytes"}, "oro", "puno"
        )

    assert resultado is None

"""Tests del asesor conversacional (julio 2026). Los 3 adaptadores de
proveedor (_via_claude/_via_gemini/_via_grok) se prueban con
requests.post MOCKEADO — sin clave real, verifican que el request se arma
según el formato documentado de cada API y que la respuesta se interpreta
bien. Nunca hacen una llamada de red real (evita gasto y flakiness)."""
from unittest.mock import MagicMock, patch

import pytest

import asesor
import models


class _RespuestaFalsa:
    def __init__(self, data: dict):
        self._data = data

    def raise_for_status(self):
        pass

    def json(self):
        return self._data


def test_modo_simulado_no_llama_a_ningun_proveedor():
    # Sin MINELINK_ASESOR_PROVEEDOR configurado, el default es "simulado"
    # — no debe intentar ninguna llamada de red.
    historial = [{"rol": "usuario", "contenido": "¿Qué es el IGAFOM?"}]
    with patch("requests.post") as mock_post:
        respuesta = asesor.generar_respuesta("system de prueba", historial)
        mock_post.assert_not_called()
    assert "¿Qué es el IGAFOM?" in respuesta
    assert "simulado" in respuesta.lower()


def test_via_claude_arma_el_request_correcto(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "clave-de-prueba")
    historial = [
        {"rol": "usuario", "contenido": "hola"},
        {"rol": "asesor", "contenido": "hola, ¿en qué te ayudo?"},
        {"rol": "usuario", "contenido": "¿qué es el REINFO?"},
    ]
    with patch("requests.post") as mock_post:
        mock_post.return_value = _RespuestaFalsa(
            {"content": [{"type": "text", "text": "El REINFO es..."}]}
        )
        resultado = asesor._via_claude("eres un asesor", historial)

    assert resultado == "El REINFO es..."
    args, kwargs = mock_post.call_args
    assert args[0] == "https://api.anthropic.com/v1/messages"
    assert kwargs["headers"]["x-api-key"] == "clave-de-prueba"
    assert kwargs["json"]["system"] == "eres un asesor"
    # Roles traducidos: "usuario"→"user", "asesor"→"assistant"
    assert kwargs["json"]["messages"][0] == {"role": "user", "content": "hola"}
    assert kwargs["json"]["messages"][1] == {
        "role": "assistant",
        "content": "hola, ¿en qué te ayudo?",
    }


def test_via_claude_sin_api_key_lanza_no_disponible(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(asesor.AsesorNoDisponible):
        asesor._via_claude("system", [{"rol": "usuario", "contenido": "hola"}])


def test_via_gemini_arma_el_request_correcto(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "clave-de-prueba")
    historial = [{"rol": "usuario", "contenido": "¿qué es el REINFO?"}]
    with patch("requests.post") as mock_post:
        mock_post.return_value = _RespuestaFalsa(
            {"candidates": [{"content": {"parts": [{"text": "El REINFO es..."}]}}]}
        )
        resultado = asesor._via_gemini("eres un asesor", historial)

    assert resultado == "El REINFO es..."
    args, kwargs = mock_post.call_args
    assert "generateContent" in args[0]
    assert kwargs["params"]["key"] == "clave-de-prueba"
    assert kwargs["json"]["systemInstruction"]["parts"][0]["text"] == "eres un asesor"
    assert kwargs["json"]["contents"][0]["role"] == "user"


def test_via_grok_arma_el_request_correcto(monkeypatch):
    monkeypatch.setenv("XAI_API_KEY", "clave-de-prueba")
    historial = [{"rol": "usuario", "contenido": "¿qué es el REINFO?"}]
    with patch("requests.post") as mock_post:
        mock_post.return_value = _RespuestaFalsa(
            {"choices": [{"message": {"content": "El REINFO es..."}}]}
        )
        resultado = asesor._via_grok("eres un asesor", historial)

    assert resultado == "El REINFO es..."
    args, kwargs = mock_post.call_args
    assert args[0] == "https://api.x.ai/v1/chat/completions"
    assert kwargs["headers"]["Authorization"] == "Bearer clave-de-prueba"
    assert kwargs["json"]["messages"][0] == {"role": "system", "content": "eres un asesor"}
    assert kwargs["json"]["messages"][1] == {"role": "user", "content": "¿qué es el REINFO?"}


def test_via_claude_error_de_red_se_traduce_a_no_disponible(monkeypatch):
    import requests

    monkeypatch.setenv("ANTHROPIC_API_KEY", "clave-de-prueba")
    with patch("requests.post", side_effect=requests.RequestException("timeout")):
        with pytest.raises(asesor.AsesorNoDisponible):
            asesor._via_claude("system", [{"rol": "usuario", "contenido": "hola"}])


def test_base_conocimiento_incluye_el_spec_de_negocio():
    base = asesor._base_conocimiento()
    assert "diagnostico_formalizacion.md" in base
    assert len(base) > 500  # el spec real tiene cientos de líneas


def test_system_prompt_es_generico_sin_caso_personal():
    # julio 2026, decisión explícita del dueño: el asesor público NO
    # conoce el caso de nadie en particular — construir_system_prompt() ya
    # no recibe ninguna operación.
    system = asesor.construir_system_prompt()
    assert "spec de MineLink" in system
    assert "ESTADO ACTUAL DE ESTA PERSONA" not in system

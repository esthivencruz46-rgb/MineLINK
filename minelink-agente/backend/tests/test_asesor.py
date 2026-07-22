"""Tests del asesor conversacional (julio 2026). Los 3 adaptadores de
proveedor (_via_claude/_via_gemini/_via_grok) se prueban con
requests.post MOCKEADO — sin clave real, verifican que el request se arma
según el formato documentado de cada API y que la respuesta se interpreta
bien. Nunca hacen una llamada de red real (evita gasto y flakiness)."""
from unittest.mock import MagicMock, patch

import fitz  # PyMuPDF
import pytest

import asesor


def _agregar_relleno(carpeta, n: int = 15) -> None:
    """Archivos sin relación con las preguntas de los tests — le dan a
    BM25 un corpus de tamaño mínimamente realista para que su IDF
    discrimine bien (ver comentario en el primer test que lo usa)."""
    for i in range(n):
        (carpeta / f"relleno_{i}.md").write_text(
            f"Norma de relleno numero {i} sobre temas variados de administracion publica "
            "sin relacion con la pregunta de la prueba.",
            encoding="utf-8",
        )


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


def test_nucleo_incluye_el_spec_de_negocio():
    nucleo = asesor._cargar_nucleo()
    assert "diagnostico_formalizacion.md" in nucleo
    assert len(nucleo) > 500  # el spec real tiene cientos de líneas


def test_trocear_respeta_tamano_y_solapa_fragmentos():
    texto = "A" * 3000
    fragmentos = asesor._trocear(texto, tam=1000, solape=100)
    assert len(fragmentos) == 4  # 0-1000, 900-1900, 1800-2800, 2700-3000
    assert all(len(f) <= 1000 for f in fragmentos)


def test_recuperar_fragmentos_relevantes_encuentra_por_palabra_clave(tmp_path, monkeypatch):
    # julio 2026: con el corpus ya en millones de caracteres, no se manda
    # todo — se busca por palabra clave (BM25) y solo se recupera lo
    # relevante a ESA pregunta puntual. BM25 necesita un corpus de tamaño
    # mínimamente realista para que su IDF discrimine bien (con solo 1-2
    # documentos el puntaje se vuelve inestable) — se agregan archivos de
    # relleno, igual que habrá docenas de normas no relacionadas en la
    # carpeta real.
    monkeypatch.setattr(asesor, "_RUTA_CONOCIMIENTO_EXTRA", tmp_path)
    monkeypatch.setattr(asesor, "_INDICE_CACHE", None)
    _agregar_relleno(tmp_path)
    (tmp_path / "reinfo.md").write_text(
        "El REINFO puede suspenderse por incumplimiento de las obligaciones ambientales.",
        encoding="utf-8",
    )

    extra = asesor._recuperar_fragmentos_relevantes("¿por qué suspenden el REINFO?")
    assert "reinfo.md" in extra
    assert "suspenderse por incumplimiento" in extra
    assert "relleno" not in extra


def test_recuperar_fragmentos_relevantes_lee_subcarpetas(tmp_path, monkeypatch):
    # julio 2026: Esthiven organiza los PDFs en subcarpetas por tema (ej.
    # asesor_conocimiento/03_ambiental_seia/) — deben indexarse igual que
    # los que están sueltos, no solo los del nivel raíz.
    monkeypatch.setattr(asesor, "_RUTA_CONOCIMIENTO_EXTRA", tmp_path)
    monkeypatch.setattr(asesor, "_INDICE_CACHE", None)
    _agregar_relleno(tmp_path)
    subcarpeta = tmp_path / "03_ambiental_seia"
    subcarpeta.mkdir()
    (subcarpeta / "norma.md").write_text(
        "El IGAFOM es el instrumento ambiental simplificado para la pequeña minería.",
        encoding="utf-8",
    )

    extra = asesor._recuperar_fragmentos_relevantes("¿qué es el IGAFOM?")
    assert "03_ambiental_seia" in extra
    assert "instrumento ambiental simplificado" in extra


def test_recuperar_fragmentos_relevantes_extrae_pdfs(tmp_path, monkeypatch):
    # julio 2026: Esthiven sube "más que todo" PDFs (normas publicadas en
    # El Peruano, jurisprudencia) — deben extraerse e indexarse solos, sin
    # que él tenga que convertir nada a mano primero.
    monkeypatch.setattr(asesor, "_RUTA_CONOCIMIENTO_EXTRA", tmp_path)
    monkeypatch.setattr(asesor, "_INDICE_CACHE", None)
    _agregar_relleno(tmp_path)
    ruta_pdf = tmp_path / "jurisprudencia.pdf"
    doc = fitz.open()
    pagina = doc.new_page()
    pagina.insert_text((72, 72), "Resolución de prueba: la formalización requiere REINFO vigente.")
    doc.save(ruta_pdf)
    doc.close()

    extra = asesor._recuperar_fragmentos_relevantes("¿qué necesito para la formalización?")
    assert "jurisprudencia.pdf" in extra
    assert "la formalización requiere REINFO vigente" in extra


def test_extraer_texto_pdf_con_archivo_corrupto_no_revienta(tmp_path):
    # Best-effort: un PDF dañado o sin capa de texto aporta string vacío,
    # nunca tumba la carga del resto del contenido.
    ruta = tmp_path / "corrupto.pdf"
    ruta.write_bytes(b"esto no es un PDF valido")
    assert asesor._extraer_texto_pdf(ruta) == ""


def test_construir_system_prompt_no_crece_con_el_tamano_del_corpus(tmp_path, monkeypatch):
    # La garantía central de este diseño: sin importar cuántos archivos
    # tenga asesor_conocimiento/, el prompt final se queda acotado porque
    # solo se recuperan FRAGMENTOS_POR_PREGUNTA fragmentos — no todo el
    # corpus. Simula un corpus mucho más grande que cualquier ventana de
    # contexto real para probarlo.
    monkeypatch.setattr(asesor, "_RUTA_CONOCIMIENTO_EXTRA", tmp_path)
    monkeypatch.setattr(asesor, "_INDICE_CACHE", None)
    for i in range(200):
        (tmp_path / f"norma_{i}.md").write_text(
            f"Norma número {i}: disposición general sobre catastro minero. " * 20,
            encoding="utf-8",
        )

    system = asesor.construir_system_prompt("¿qué dice la norma sobre catastro minero?")
    # 200 archivos * ~1200 caracteres cada uno > 200,000 caracteres si se
    # mandara todo; el prompt real (núcleo + 8 fragmentos) debe quedarse
    # muy por debajo de eso.
    assert len(system) < 60_000


def test_system_prompt_es_generico_sin_caso_personal():
    # julio 2026, decisión explícita del dueño: el asesor público NO
    # conoce el caso de nadie en particular — construir_system_prompt()
    # nunca recibe ninguna operación, solo el texto de la pregunta.
    system = asesor.construir_system_prompt("¿qué es el REINFO?")
    assert "spec de MineLink" in system
    assert "ESTADO ACTUAL DE ESTA PERSONA" not in system

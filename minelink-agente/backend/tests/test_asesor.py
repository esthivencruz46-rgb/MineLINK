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


@pytest.mark.parametrize(
    "funcion,env_key,url,modelo_por_defecto",
    [
        (
            "_via_kimi",
            "MOONSHOT_API_KEY",
            "https://api.moonshot.ai/v1/chat/completions",
            "kimi-k2.6",
        ),
        (
            "_via_deepseek",
            "DEEPSEEK_API_KEY",
            "https://api.deepseek.com/chat/completions",
            "deepseek-chat",
        ),
        (
            "_via_qwen",
            "DASHSCOPE_API_KEY",
            "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
            "qwen-plus",
        ),
        (
            "_via_glm",
            "ZHIPU_API_KEY",
            "https://open.bigmodel.cn/api/paas/v4/chat/completions",
            "glm-4.5",
        ),
        (
            "_via_openai",
            "OPENAI_API_KEY",
            "https://api.openai.com/v1/chat/completions",
            "gpt-5.4-nano",
        ),
    ],
)
def test_adaptador_openai_compatible_arma_el_request_correcto(
    monkeypatch, funcion, env_key, url, modelo_por_defecto
):
    # Kimi, DeepSeek, Qwen, GLM y OpenAI comparten el mismo formato de
    # request (compatible con OpenAI) que Grok — un solo test parametrizado
    # cubre los 5 adaptadores (julio 2026, cadena de respaldo pedida por
    # Esthiven: "varias api... cuando se acaba la gratuidad pasa al otro").
    monkeypatch.setenv(env_key, "clave-de-prueba")
    historial = [{"rol": "usuario", "contenido": "¿qué es el REINFO?"}]
    with patch("requests.post") as mock_post:
        mock_post.return_value = _RespuestaFalsa(
            {"choices": [{"message": {"content": "El REINFO es..."}}]}
        )
        resultado = getattr(asesor, funcion)("eres un asesor", historial)

    assert resultado == "El REINFO es..."
    args, kwargs = mock_post.call_args
    assert args[0] == url
    assert kwargs["headers"]["Authorization"] == "Bearer clave-de-prueba"
    assert kwargs["json"]["model"] == modelo_por_defecto
    assert kwargs["json"]["messages"][0] == {"role": "system", "content": "eres un asesor"}
    assert kwargs["json"]["messages"][1] == {"role": "user", "content": "¿qué es el REINFO?"}


@pytest.mark.parametrize(
    "funcion,env_key",
    [
        ("_via_kimi", "MOONSHOT_API_KEY"),
        ("_via_deepseek", "DEEPSEEK_API_KEY"),
        ("_via_qwen", "DASHSCOPE_API_KEY"),
        ("_via_glm", "ZHIPU_API_KEY"),
        ("_via_openai", "OPENAI_API_KEY"),
    ],
)
def test_adaptador_openai_compatible_sin_clave_lanza_no_disponible(monkeypatch, funcion, env_key):
    monkeypatch.delenv(env_key, raising=False)
    with pytest.raises(asesor.AsesorNoDisponible):
        getattr(asesor, funcion)("system", [{"rol": "usuario", "contenido": "hola"}])


def test_modelo_para_respeta_override_por_proveedor(monkeypatch):
    # MINELINK_ASESOR_MODELO_<PROVEEDOR> pisa el modelo por defecto sin
    # tocar código — necesario porque cada proveedor de la cadena de
    # respaldo puede necesitar un modelo distinto al mismo tiempo (ya no
    # hay un único MINELINK_ASESOR_MODELO global como antes).
    monkeypatch.setenv("MINELINK_ASESOR_MODELO_KIMI", "kimi-k2.7-code")
    assert asesor._modelo_para("kimi") == "kimi-k2.7-code"
    assert asesor._modelo_para("deepseek") == "deepseek-chat"  # sin pisar, usa el default


def test_generar_respuesta_pasa_al_siguiente_proveedor_si_el_primero_falla(monkeypatch):
    # julio 2026, pedido explícito de Esthiven: "varias api, de modo que
    # cuando se acaba la gratuidad por día pasa al otro". Simula que kimi
    # falla (sin clave) y deepseek responde bien.
    monkeypatch.setattr(asesor, "PROVEEDORES", ["kimi", "deepseek"])
    monkeypatch.delenv("MOONSHOT_API_KEY", raising=False)
    monkeypatch.setenv("DEEPSEEK_API_KEY", "clave-de-prueba")
    historial = [{"rol": "usuario", "contenido": "hola"}]

    with patch("requests.post") as mock_post:
        mock_post.return_value = _RespuestaFalsa(
            {"choices": [{"message": {"content": "respuesta de deepseek"}}]}
        )
        resultado = asesor.generar_respuesta("system", historial)

    assert resultado == "respuesta de deepseek"
    mock_post.assert_called_once()
    assert mock_post.call_args[0][0] == "https://api.deepseek.com/chat/completions"


def test_generar_respuesta_lanza_no_disponible_si_todos_los_proveedores_fallan(monkeypatch):
    monkeypatch.setattr(asesor, "PROVEEDORES", ["kimi", "deepseek"])
    monkeypatch.delenv("MOONSHOT_API_KEY", raising=False)
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)

    with pytest.raises(asesor.AsesorNoDisponible):
        asesor.generar_respuesta("system", [{"rol": "usuario", "contenido": "hola"}])


def test_generar_respuesta_con_proveedor_devuelve_quien_respondio(monkeypatch):
    # julio 2026, para LlamadaAsesor: el dashboard admin necesita saber
    # QUÉ proveedor sirvió la respuesta, no solo que "algo respondió".
    monkeypatch.setattr(asesor, "PROVEEDORES", ["kimi", "deepseek"])
    monkeypatch.delenv("MOONSHOT_API_KEY", raising=False)
    monkeypatch.setenv("DEEPSEEK_API_KEY", "clave-de-prueba")
    historial = [{"rol": "usuario", "contenido": "hola"}]

    with patch("requests.post") as mock_post:
        mock_post.return_value = _RespuestaFalsa(
            {"choices": [{"message": {"content": "respuesta de deepseek"}}]}
        )
        respuesta, proveedor = asesor.generar_respuesta_con_proveedor("system", historial)

    assert respuesta == "respuesta de deepseek"
    assert proveedor == "deepseek"


def test_generar_respuesta_con_proveedor_en_modo_simulado(monkeypatch):
    monkeypatch.setattr(asesor, "PROVEEDORES", ["simulado"])
    historial = [{"rol": "usuario", "contenido": "hola"}]
    respuesta, proveedor = asesor.generar_respuesta_con_proveedor("system", historial)
    assert proveedor == "simulado"
    assert "simulado" in respuesta.lower()


def test_asesor_no_disponible_conserva_el_proveedor_que_fallo(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(asesor.AsesorNoDisponible) as excinfo:
        asesor._via_claude("system", [{"rol": "usuario", "contenido": "hola"}])
    assert excinfo.value.proveedor == "claude"


def test_generar_respuesta_con_proveedor_conserva_proveedor_del_ultimo_error(monkeypatch):
    monkeypatch.setattr(asesor, "PROVEEDORES", ["kimi", "deepseek"])
    monkeypatch.delenv("MOONSHOT_API_KEY", raising=False)
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)

    with pytest.raises(asesor.AsesorNoDisponible) as excinfo:
        asesor.generar_respuesta_con_proveedor("system", [{"rol": "usuario", "contenido": "hola"}])
    assert excinfo.value.proveedor == "deepseek"  # el último intentado


def test_generar_respuesta_con_proveedor_corta_la_cadena_si_se_agota_el_presupuesto(monkeypatch):
    # julio 2026, reportado en vivo: "Failed to fetch" en el navegador al
    # preguntarle al asesor -- con varios proveedores fallando en cadena,
    # el tiempo total podía acumularse tanto que el proxy del hosting
    # mataba la conexión antes de que el código respondiera un 503
    # limpio. Simula el reloj saltando de golpe tras el primer fallo
    # (kimi, falla al toque por falta de clave) para confirmar que NO
    # llega a intentar deepseek -- aunque deepseek sí tiene clave y
    # podría haber respondido.
    monkeypatch.setattr(asesor, "PROVEEDORES", ["kimi", "deepseek"])
    monkeypatch.delenv("MOONSHOT_API_KEY", raising=False)
    monkeypatch.setenv("DEEPSEEK_API_KEY", "clave-de-prueba")

    tiempos = iter([0.0, 100.0])  # inicio, luego chequeo antes de deepseek
    monkeypatch.setattr(asesor.time, "monotonic", lambda: next(tiempos))

    with patch("requests.post") as mock_post:
        with pytest.raises(asesor.AsesorNoDisponible) as excinfo:
            asesor.generar_respuesta_con_proveedor(
                "system", [{"rol": "usuario", "contenido": "hola"}]
            )

    mock_post.assert_not_called()  # nunca llegó a intentar deepseek
    assert excinfo.value.proveedor == "kimi"


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
    # El caché de fragmentos/tokens del filesystem (julio 2026, separado de
    # _INDICE_CACHE para no re-stemmear 1.5M de palabras en cada pregunta)
    # también hay que resetearlo -- si no, un test reusaría el filesystem
    # falso de OTRO test ya cacheado en memoria del proceso.
    monkeypatch.setattr(asesor, "_FRAGMENTOS_FS_CACHE", None)
    monkeypatch.setattr(asesor, "_TOKENS_FS_CACHE", None)
    _agregar_relleno(tmp_path)
    (tmp_path / "reinfo.md").write_text(
        "El REINFO puede suspenderse por incumplimiento de las obligaciones ambientales.",
        encoding="utf-8",
    )

    extra = asesor._recuperar_fragmentos_relevantes("¿por qué suspenden el REINFO?")
    assert "reinfo" in extra
    assert "suspenderse por incumplimiento" in extra
    assert "relleno" not in extra


def test_tokenizar_reduce_conjugaciones_a_la_misma_raiz():
    # julio 2026, hallazgo evaluando preguntas coloquiales reales: sin
    # stemming, "me suspendieron y no sé qué hacer" no encontraba NADA del
    # contenido real sobre suspensión del REINFO porque el documento usa
    # otra conjugación ("suspendido"). Verifica que ambas formas caen en
    # el mismo token.
    assert asesor._tokenizar("me suspendieron") == asesor._tokenizar("está suspendido")


def test_recuperar_fragmentos_relevantes_encuentra_pregunta_coloquial_por_conjugacion(
    tmp_path, monkeypatch
):
    # Reproduce el hallazgo real: la pregunta usa una conjugación distinta
    # ("suspendieron") a la del documento ("suspendido") — antes del
    # stemming esto devolvía vacío aunque el contenido exista.
    monkeypatch.setattr(asesor, "_RUTA_CONOCIMIENTO_EXTRA", tmp_path)
    monkeypatch.setattr(asesor, "_INDICE_CACHE", None)
    # El caché de fragmentos/tokens del filesystem (julio 2026, separado de
    # _INDICE_CACHE para no re-stemmear 1.5M de palabras en cada pregunta)
    # también hay que resetearlo -- si no, un test reusaría el filesystem
    # falso de OTRO test ya cacheado en memoria del proceso.
    monkeypatch.setattr(asesor, "_FRAGMENTOS_FS_CACHE", None)
    monkeypatch.setattr(asesor, "_TOKENS_FS_CACHE", None)
    _agregar_relleno(tmp_path)
    (tmp_path / "reinfo.md").write_text(
        "Si tu REINFO está suspendido debes regularizar tus obligaciones ambientales.",
        encoding="utf-8",
    )

    extra = asesor._recuperar_fragmentos_relevantes(
        "me suspendieron y no sé qué hacer, cómo lo soluciono"
    )
    assert "reinfo" in extra


def test_recuperar_fragmentos_relevantes_lee_subcarpetas(tmp_path, monkeypatch):
    # julio 2026: Esthiven organiza los PDFs en subcarpetas por tema (ej.
    # asesor_conocimiento/03_ambiental_seia/) — deben indexarse igual que
    # los que están sueltos, no solo los del nivel raíz. La etiqueta que
    # se le muestra al modelo ya no incluye la subcarpeta (ver
    # _etiqueta_citable), así que la ruta completa se verifica a nivel de
    # _cargar_fragmentos_extra(), no del texto final mandado al modelo.
    monkeypatch.setattr(asesor, "_RUTA_CONOCIMIENTO_EXTRA", tmp_path)
    monkeypatch.setattr(asesor, "_INDICE_CACHE", None)
    # El caché de fragmentos/tokens del filesystem (julio 2026, separado de
    # _INDICE_CACHE para no re-stemmear 1.5M de palabras en cada pregunta)
    # también hay que resetearlo -- si no, un test reusaría el filesystem
    # falso de OTRO test ya cacheado en memoria del proceso.
    monkeypatch.setattr(asesor, "_FRAGMENTOS_FS_CACHE", None)
    monkeypatch.setattr(asesor, "_TOKENS_FS_CACHE", None)
    _agregar_relleno(tmp_path)
    subcarpeta = tmp_path / "03_ambiental_seia"
    subcarpeta.mkdir()
    (subcarpeta / "norma.md").write_text(
        "El IGAFOM es el instrumento ambiental simplificado para la pequeña minería.",
        encoding="utf-8",
    )

    fragmentos = asesor._cargar_fragmentos_extra()
    assert any(etiqueta == "03_ambiental_seia/norma.md" for etiqueta, _ in fragmentos)

    extra = asesor._recuperar_fragmentos_relevantes("¿qué es el IGAFOM?")
    assert "instrumento ambiental simplificado" in extra


def test_etiqueta_citable_quita_subcarpeta_extension_y_guiones_bajos():
    # julio 2026, pedido explícito: que el asesor cite la norma exacta
    # ("según el Decreto Supremo N° 038-2017-EM...") — para eso la
    # etiqueta que ve el modelo debe leerse como una cita natural, no como
    # una ruta de archivo.
    assert (
        asesor._etiqueta_citable("02_formalizacion_integral/DS_038-2017-EM_Reglamento_IGAFOM.md")
        == "DS 038-2017-EM Reglamento IGAFOM"
    )
    assert asesor._etiqueta_citable("07_penal_control/Ley_27651_Pequena_Mineria.md") == (
        "Ley 27651 Pequena Mineria"
    )


def test_construir_system_prompt_instruye_citar_la_norma(tmp_path, monkeypatch):
    monkeypatch.setattr(asesor, "_RUTA_CONOCIMIENTO_EXTRA", tmp_path)
    monkeypatch.setattr(asesor, "_INDICE_CACHE", None)
    # El caché de fragmentos/tokens del filesystem (julio 2026, separado de
    # _INDICE_CACHE para no re-stemmear 1.5M de palabras en cada pregunta)
    # también hay que resetearlo -- si no, un test reusaría el filesystem
    # falso de OTRO test ya cacheado en memoria del proceso.
    monkeypatch.setattr(asesor, "_FRAGMENTOS_FS_CACHE", None)
    monkeypatch.setattr(asesor, "_TOKENS_FS_CACHE", None)
    _agregar_relleno(tmp_path)
    (tmp_path / "DS_038-2017-EM_Reglamento_IGAFOM.md").write_text(
        "El IGAFOM es el instrumento de gestión ambiental para la formalización.",
        encoding="utf-8",
    )

    system = asesor.construir_system_prompt("¿qué es el IGAFOM?")
    assert "CÍTALA" in system  # la regla de citación está presente
    assert "DS 038-2017-EM Reglamento IGAFOM" in system  # y la etiqueta citable llegó


def test_recuperar_fragmentos_relevantes_extrae_pdfs(tmp_path, monkeypatch):
    # julio 2026: Esthiven sube "más que todo" PDFs (normas publicadas en
    # El Peruano, jurisprudencia) — deben extraerse e indexarse solos, sin
    # que él tenga que convertir nada a mano primero.
    monkeypatch.setattr(asesor, "_RUTA_CONOCIMIENTO_EXTRA", tmp_path)
    monkeypatch.setattr(asesor, "_INDICE_CACHE", None)
    # El caché de fragmentos/tokens del filesystem (julio 2026, separado de
    # _INDICE_CACHE para no re-stemmear 1.5M de palabras en cada pregunta)
    # también hay que resetearlo -- si no, un test reusaría el filesystem
    # falso de OTRO test ya cacheado en memoria del proceso.
    monkeypatch.setattr(asesor, "_FRAGMENTOS_FS_CACHE", None)
    monkeypatch.setattr(asesor, "_TOKENS_FS_CACHE", None)
    _agregar_relleno(tmp_path)
    ruta_pdf = tmp_path / "jurisprudencia.pdf"
    doc = fitz.open()
    pagina = doc.new_page()
    pagina.insert_text((72, 72), "Resolución de prueba: la formalización requiere REINFO vigente.")
    doc.save(ruta_pdf)
    doc.close()

    extra = asesor._recuperar_fragmentos_relevantes("¿qué necesito para la formalización?")
    assert "jurisprudencia" in extra
    assert "la formalización requiere REINFO vigente" in extra


def test_extraer_texto_pdf_con_archivo_corrupto_no_revienta(tmp_path):
    # Best-effort: un PDF dañado o sin capa de texto aporta string vacío,
    # nunca tumba la carga del resto del contenido.
    ruta = tmp_path / "corrupto.pdf"
    ruta.write_bytes(b"esto no es un PDF valido")
    assert asesor._extraer_texto_pdf(ruta) == ""


def test_leer_texto_plano_con_codificacion_invalida_no_revienta(tmp_path):
    # julio 2026, hallazgo al revisar el asesor a fondo: los .md/.txt no
    # tenían la misma protección best-effort que ya tienen los PDF -- un
    # solo archivo con bytes que no son UTF-8 válido (ej. pegado desde
    # Word con codificación Windows-1252) tumbaba la reconstrucción del
    # índice ENTERA en vez de solo aportar menos contenido.
    ruta = tmp_path / "con_bytes_invalidos.md"
    ruta.write_bytes(b"\xff\xfe texto con bytes que no son UTF-8 valido")
    assert asesor._leer_texto_plano(ruta) == ""


def test_cargar_fragmentos_extra_ignora_archivo_con_codificacion_invalida(tmp_path, monkeypatch):
    monkeypatch.setattr(asesor, "_RUTA_CONOCIMIENTO_EXTRA", tmp_path)
    (tmp_path / "bueno.md").write_text(
        "Contenido válido sobre formalización minera.", encoding="utf-8"
    )
    (tmp_path / "malo.md").write_bytes(b"\xff\xfe bytes invalidos que no son UTF-8")

    fragmentos = asesor._cargar_fragmentos_extra()
    etiquetas = {etiqueta for etiqueta, _texto in fragmentos}
    assert "bueno.md" in etiquetas
    assert "malo.md" not in etiquetas  # se ignora, no revienta la carga entera


def test_extraer_texto_pdf_bytes_funciona_sin_archivo_en_disco():
    # Para el endpoint de subida en /admin (julio 2026) — recibe el PDF ya
    # en memoria (UploadFile), no debería necesitar escribirlo a disco.
    doc = fitz.open()
    pagina = doc.new_page()
    pagina.insert_text((72, 72), "Texto de prueba subido desde el panel admin.")
    contenido = doc.tobytes()
    doc.close()

    texto = asesor.extraer_texto_pdf_bytes(contenido)
    assert "Texto de prueba subido desde el panel admin." in texto


def test_extraer_texto_pdf_bytes_con_archivo_corrupto_no_revienta():
    assert asesor.extraer_texto_pdf_bytes(b"esto no es un PDF valido") == ""


def test_actualizar_documentos_admin_sin_bd_directa(tmp_path, monkeypatch):
    # julio 2026, pedido explícito ("imagina que ya no uso Claude Code"):
    # asesor.py NUNCA toca la base de datos — recibe los documentos ya
    # consultados y los mezcla con el contenido del filesystem al buscar.
    monkeypatch.setattr(asesor, "_RUTA_CONOCIMIENTO_EXTRA", tmp_path)
    monkeypatch.setattr(asesor, "_INDICE_CACHE", None)
    # El caché de fragmentos/tokens del filesystem (julio 2026, separado de
    # _INDICE_CACHE para no re-stemmear 1.5M de palabras en cada pregunta)
    # también hay que resetearlo -- si no, un test reusaría el filesystem
    # falso de OTRO test ya cacheado en memoria del proceso.
    monkeypatch.setattr(asesor, "_FRAGMENTOS_FS_CACHE", None)
    monkeypatch.setattr(asesor, "_TOKENS_FS_CACHE", None)
    monkeypatch.setattr(asesor, "_DOCUMENTOS_ADMIN", [])
    _agregar_relleno(tmp_path)

    asesor.actualizar_documentos_admin(
        [("RD_099-2026-MINEM", "07_penal_control", "El OEFA sanciona el incumplimiento ambiental minero.")]
    )
    extra = asesor._recuperar_fragmentos_relevantes("¿qué pasa si incumplo lo ambiental?")
    assert "RD 099-2026-MINEM" in extra  # etiqueta citable, igual que los del filesystem
    assert "El OEFA sanciona el incumplimiento ambiental minero." in extra


def test_documentos_admin_cambiaron_detecta_si_hay_diferencia(monkeypatch):
    # julio 2026, reescrito tras un incidente real: reconstruir el índice
    # sobre el corpus completo tarda 50+ segundos, así que el router
    # SIEMPRE debe poder decidir si hace falta reconstruir SIN pagar ese
    # costo -- esta comparación debe ser barata (no toca el índice).
    monkeypatch.setattr(asesor, "_DOCUMENTOS_ADMIN", [])

    assert asesor.documentos_admin_cambiaron([]) is False  # mismo resultado que ya había
    assert asesor.documentos_admin_cambiaron([("Norma X", None, "contenido")]) is True


def test_actualizar_documentos_admin_reconstruye_de_una_no_en_la_proxima_pregunta(monkeypatch, tmp_path):
    # julio 2026, incidente real: antes esta función solo invalidaba
    # (_INDICE_CACHE = None) y la reconstrucción de verdad quedaba para la
    # PRÓXIMA llamada a _indice_fragmentos() -- que en el router pasaba a
    # ser la MISMA pregunta que detectó el cambio, bloqueándola el minuto
    # entero que tarda reconstruir. Ahora debe llamarse SOLO desde tareas
    # en segundo plano (ver routers/asesor.py) y reconstruir de una, para
    # que la pregunta que la disparó no la pague.
    monkeypatch.setattr(asesor, "_RUTA_CONOCIMIENTO_EXTRA", tmp_path)
    monkeypatch.setattr(asesor, "_INDICE_CACHE", None)
    # El caché de fragmentos/tokens del filesystem (julio 2026, separado de
    # _INDICE_CACHE para no re-stemmear 1.5M de palabras en cada pregunta)
    # también hay que resetearlo -- si no, un test reusaría el filesystem
    # falso de OTRO test ya cacheado en memoria del proceso.
    monkeypatch.setattr(asesor, "_FRAGMENTOS_FS_CACHE", None)
    monkeypatch.setattr(asesor, "_TOKENS_FS_CACHE", None)
    monkeypatch.setattr(asesor, "_DOCUMENTOS_ADMIN", [])

    asesor.actualizar_documentos_admin([("Norma X", None, "contenido de la norma X")])
    assert asesor._INDICE_CACHE is not None  # ya quedó reconstruido, no en None
    fragmentos, _indice = asesor._INDICE_CACHE
    assert any("contenido de la norma X" in texto for _etiqueta, texto in fragmentos)


def test_fragmentos_de_filesystem_se_tokenizan_una_sola_vez_por_proceso(tmp_path, monkeypatch):
    # julio 2026, la optimización detrás del incidente real de los 50+
    # segundos: medido en vivo, el 99% de ese tiempo era re-stemmear los
    # fragmentos de asesor_conocimiento/ (que NO cambian sin un redeploy)
    # una y otra vez en cada reconstrucción. Confirma que una SEGUNDA
    # llamada a actualizar_documentos_admin (ej. subieron otro documento)
    # no vuelve a tokenizar el contenido del filesystem, solo lo nuevo.
    monkeypatch.setattr(asesor, "_RUTA_CONOCIMIENTO_EXTRA", tmp_path)
    monkeypatch.setattr(asesor, "_INDICE_CACHE", None)
    monkeypatch.setattr(asesor, "_FRAGMENTOS_FS_CACHE", None)
    monkeypatch.setattr(asesor, "_TOKENS_FS_CACHE", None)
    monkeypatch.setattr(asesor, "_DOCUMENTOS_ADMIN", [])
    _agregar_relleno(tmp_path, n=5)

    llamadas = {"n": 0}
    tokenizar_real = asesor._tokenizar

    def _tokenizar_contando(texto):
        llamadas["n"] += 1
        return tokenizar_real(texto)

    monkeypatch.setattr(asesor, "_tokenizar", _tokenizar_contando)

    asesor.actualizar_documentos_admin([("Norma A", None, "contenido de la norma A")])
    assert llamadas["n"] > 5  # tokenizó el relleno del filesystem + la norma A

    llamadas["n"] = 0
    asesor.actualizar_documentos_admin(
        [("Norma A", None, "contenido de la norma A"), ("Norma B", None, "contenido de la norma B")]
    )
    # Esta vez NO debería volver a tokenizar los 5 archivos de relleno del
    # filesystem -- solo los 2 documentos admin (chicos).
    assert llamadas["n"] <= 2


def test_indice_fragmentos_es_seguro_entre_hilos(tmp_path, monkeypatch):
    # julio 2026, bug real en producción encontrado por auditoría:
    # "unsupported operand type(s) for +: 'NoneType' and 'list'". FastAPI
    # corre los endpoints sync en un threadpool -- dos preguntas a la vez
    # (o una pregunta + el BackgroundTask de actualizar_documentos_admin)
    # podían entrar a _fragmentos_y_tokens_filesystem() al mismo tiempo;
    # sin lock, un hilo alcanzaba a leer _TOKENS_FS_CACHE todavía en None
    # justo después de que otro hilo ya había asignado
    # _FRAGMENTOS_FS_CACHE pero no _TOKENS_FS_CACHE (dos líneas, no
    # atómico). Lanza muchos hilos a la vez contra el caché recién
    # invalidado -- sin el lock, esto revienta con bastante regularidad.
    import threading

    monkeypatch.setattr(asesor, "_RUTA_CONOCIMIENTO_EXTRA", tmp_path)
    monkeypatch.setattr(asesor, "_INDICE_CACHE", None)
    monkeypatch.setattr(asesor, "_FRAGMENTOS_FS_CACHE", None)
    monkeypatch.setattr(asesor, "_TOKENS_FS_CACHE", None)
    monkeypatch.setattr(asesor, "_DOCUMENTOS_ADMIN", [("Norma A", "contenido de la norma A")])
    _agregar_relleno(tmp_path, n=10)

    errores: list[BaseException] = []

    def _llamar():
        try:
            asesor._indice_fragmentos()
        except BaseException as e:  # noqa: BLE001 -- justo lo que el test quiere atrapar
            errores.append(e)

    hilos = [threading.Thread(target=_llamar) for _ in range(20)]
    for h in hilos:
        h.start()
    for h in hilos:
        h.join()

    assert errores == []
    fragmentos, indice = asesor._INDICE_CACHE
    assert indice is not None
    assert any("contenido de la norma A" in texto for _etiqueta, texto in fragmentos)


def test_construir_system_prompt_no_crece_con_el_tamano_del_corpus(tmp_path, monkeypatch):
    # La garantía central de este diseño: sin importar cuántos archivos
    # tenga asesor_conocimiento/, el prompt final se queda acotado porque
    # solo se recuperan FRAGMENTOS_POR_PREGUNTA fragmentos — no todo el
    # corpus. Simula un corpus mucho más grande que cualquier ventana de
    # contexto real para probarlo.
    monkeypatch.setattr(asesor, "_RUTA_CONOCIMIENTO_EXTRA", tmp_path)
    monkeypatch.setattr(asesor, "_INDICE_CACHE", None)
    # El caché de fragmentos/tokens del filesystem (julio 2026, separado de
    # _INDICE_CACHE para no re-stemmear 1.5M de palabras en cada pregunta)
    # también hay que resetearlo -- si no, un test reusaría el filesystem
    # falso de OTRO test ya cacheado en memoria del proceso.
    monkeypatch.setattr(asesor, "_FRAGMENTOS_FS_CACHE", None)
    monkeypatch.setattr(asesor, "_TOKENS_FS_CACHE", None)
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

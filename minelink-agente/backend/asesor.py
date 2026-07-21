"""Asesor conversacional PÚBLICO (julio 2026): cualquier visitante, sin
registrarse, puede preguntar en lenguaje llano sobre formalización minera
según el modelo de MineLink ("¿qué es el REINFO?", "¿para qué sirve un
IGAFOM?"). Genérico a propósito (decisión explícita del dueño, no
personalizado a un caso): no conoce el diagnóstico de nadie en
particular, solo el spec de negocio. No genera archivos ni asesora
legalmente.

Arquitectura RAG deliberadamente simple para el tamaño actual del
contenido (unos cientos de líneas, no miles de páginas): el "retrieval"
es incluir TODO el spec en cada pregunta — no hace falta base de datos
vectorial ni embeddings todavía. Para nutrir al asesor con más contenido
(ley MAPE, jurisprudencia, reglamentos) NO hace falta tocar código: basta
con soltar un archivo .md, .txt o .pdf en `context/asesor_conocimiento/`
— se suma automáticamente al contenido de referencia en el próximo
arranque del servidor (ver `_cargar_base_conocimiento`). Los PDF se leen
con PyMuPDF (ya es dependencia del proyecto para las fotos de
documentos) extrayendo su texto — funciona bien con PDFs de texto real
(la mayoría de normas publicadas en El Peruano lo son), pero NO con un
PDF que es solo una foto/escaneo sin capa de texto (esos habría que
pasarlos por OCR aparte). Si ese contenido crece mucho (el reglamento
completo + jurisprudencia extensa, miles de líneas), esa sería la señal
para migrar a retrieval real (chunking + embeddings + pgvector); mientras
tanto sería complejidad sin beneficio.

Generación intercambiable entre proveedores (julio 2026, pedido
explícito): `generar_respuesta()` es la ÚNICA función que sabe hablar con
una API externa. Todo lo demás (el prompt, el historial, los
guardarraíles) no se entera de cuál IA responde por detrás. Cambiar de
proveedor es elegir `MINELINK_ASESOR_PROVEEDOR` — no reescribir nada.
"""
import os
from pathlib import Path

import fitz  # PyMuPDF
import requests

PROVEEDOR = os.environ.get("MINELINK_ASESOR_PROVEEDOR", "simulado")

# Modelos por defecto de cada proveedor — se pueden pisar con
# MINELINK_ASESOR_MODELO sin tocar código.
_MODELO_POR_DEFECTO = {
    "claude": "claude-haiku-4-5-20251001",
    "gemini": "gemini-2.5-flash",
    "grok": "grok-4-fast",
}
MODELO = os.environ.get("MINELINK_ASESOR_MODELO") or _MODELO_POR_DEFECTO.get(PROVEEDOR, "")

MAX_TURNOS_HISTORIAL = 6  # últimos N mensajes que se reenvían (controla el costo)

_RUTA_CONTEXTO = Path(__file__).parent.parent / "context"
# Carpeta de "nutrición" del asesor: cualquier .md/.txt que se suelte acá
# se suma al contenido de referencia sin tocar código (julio 2026).
_RUTA_CONOCIMIENTO_EXTRA = _RUTA_CONTEXTO / "asesor_conocimiento"


def _extraer_texto_pdf(ruta: Path) -> str:
    """Best-effort (mismo patrón que geocatmin.py/geoubicacion.py): un PDF
    dañado o sin capa de texto (foto escaneada) no debe tumbar el asesor
    entero, solo aportar menos contenido."""
    try:
        with fitz.open(ruta) as doc:
            return "\n".join(pagina.get_text() for pagina in doc)
    except Exception:
        return ""


def _cargar_base_conocimiento() -> str:
    """El spec de negocio completo (fuente de verdad ya existente del
    proyecto) + cualquier archivo extra en `asesor_conocimiento/` (ley
    MAPE, jurisprudencia, etc. — .md, .txt o .pdf) — se lee una sola vez y
    se cachea en memoria del proceso; no cambia mientras el servidor está
    corriendo (un redeploy sí lo vuelve a leer)."""
    partes = []
    for nombre in ("diagnostico_formalizacion.md", "perfil_usuario.md"):
        ruta = _RUTA_CONTEXTO / nombre
        if ruta.exists():
            partes.append(f"--- {nombre} ---\n{ruta.read_text(encoding='utf-8')}")
    if _RUTA_CONOCIMIENTO_EXTRA.exists():
        for ruta in sorted(_RUTA_CONOCIMIENTO_EXTRA.glob("*.md")):
            partes.append(f"--- {ruta.name} ---\n{ruta.read_text(encoding='utf-8')}")
        for ruta in sorted(_RUTA_CONOCIMIENTO_EXTRA.glob("*.txt")):
            partes.append(f"--- {ruta.name} ---\n{ruta.read_text(encoding='utf-8')}")
        for ruta in sorted(_RUTA_CONOCIMIENTO_EXTRA.glob("*.pdf")):
            texto = _extraer_texto_pdf(ruta)
            if texto.strip():
                partes.append(f"--- {ruta.name} ---\n{texto}")
    return "\n\n".join(partes)


_BASE_CONOCIMIENTO_CACHE: str | None = None


def _base_conocimiento() -> str:
    global _BASE_CONOCIMIENTO_CACHE
    if _BASE_CONOCIMIENTO_CACHE is None:
        _BASE_CONOCIMIENTO_CACHE = _cargar_base_conocimiento()
    return _BASE_CONOCIMIENTO_CACHE


SYSTEM_PROMPT_BASE = """Eres el asesor público de MineLink, una plataforma peruana que \
orienta a mineros artesanales en su proceso de formalización. Respondes preguntas \
GENERALES sobre formalización minera y sobre cómo funciona MineLink, en español simple y \
directo, sin jerga legal innecesaria. No conoces el caso particular de nadie — cualquier \
visitante, con o sin cuenta, puede preguntarte.

REGLAS QUE NUNCA ROMPES:
1. Respondes SOLO con base en el contenido que te doy abajo (el spec de MineLink). Nunca \
inventes trámites, plazos, montos ni artículos de ley que no estén en ese contenido.
2. Si la pregunta pide algo que no está en tu contenido (ej. un detalle de un reglamento que \
no tienes, o el caso particular de una persona específica), dilo con honestidad: "esto no lo \
tengo documentado, te recomiendo confirmarlo con un especialista o consultarlo directamente \
con las autoridades" — nunca completes el vacío adivinando.
3. NO eres un abogado ni das asesoría legal vinculante — al final de respuestas sobre temas \
legales o de riesgo (suspensión, caducidad, sanciones), recuerda brevemente que es \
orientación general, no asesoría legal.
4. No generas documentos, cartas ni escritos — solo explicas.
5. Respuestas cortas y claras (unos pocos párrafos como máximo), en el tono de alguien que \
ayuda de verdad, no de un manual.

CONTENIDO DE REFERENCIA (spec de MineLink):
{base_conocimiento}
"""


def construir_system_prompt() -> str:
    return SYSTEM_PROMPT_BASE.format(base_conocimiento=_base_conocimiento())


class AsesorNoDisponible(Exception):
    """El proveedor configurado no pudo responder (sin clave, error de red,
    error de la API) — el router lo traduce a un mensaje amable, nunca a
    un 500 crudo."""


def generar_respuesta(system: str, historial: list[dict]) -> str:
    """Única función que habla con un proveedor externo. `historial` es
    una lista de {"rol": "usuario"|"asesor", "contenido": str}, ya
    recortada a MAX_TURNOS_HISTORIAL por el caller."""
    if PROVEEDOR == "claude":
        return _via_claude(system, historial)
    if PROVEEDOR == "gemini":
        return _via_gemini(system, historial)
    if PROVEEDOR == "grok":
        return _via_grok(system, historial)
    return _via_simulado(system, historial)


def _via_simulado(system: str, historial: list[dict]) -> str:
    """Modo por defecto (sin ninguna API key configurada) — deja probar
    TODO el resto del sistema (retrieval, guardarraíles, límite de uso,
    interfaz de chat) sin gastar un centavo ni depender de nadie externo.
    Nunca se hace pasar por una respuesta real."""
    ultima_pregunta = historial[-1]["contenido"] if historial else ""
    return (
        "🔧 Modo simulado — el asesor todavía no está conectado a ningún proveedor de IA "
        f'(configura MINELINK_ASESOR_PROVEEDOR). Tu pregunta fue: "{ultima_pregunta}". '
        "Cuando se conecte una API real, aquí aparecerá la respuesta basada en el spec "
        "de MineLink."
    )


def _mensajes_openai_like(historial: list[dict]) -> list[dict]:
    """Formato compartido por Gemini (vía OpenAI-compat, si se usara) y
    Grok — rol 'user'/'assistant', no 'usuario'/'asesor'."""
    return [
        {"role": "user" if m["rol"] == "usuario" else "assistant", "content": m["contenido"]}
        for m in historial
    ]


def _via_claude(system: str, historial: list[dict]) -> str:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise AsesorNoDisponible("Falta ANTHROPIC_API_KEY en el entorno")
    try:
        resp = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": MODELO,
                "max_tokens": 800,
                "system": system,
                "messages": [
                    {"role": "user" if m["rol"] == "usuario" else "assistant", "content": m["contenido"]}
                    for m in historial
                ],
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        return "".join(bloque.get("text", "") for bloque in data.get("content", []))
    except (requests.RequestException, KeyError, ValueError) as e:
        raise AsesorNoDisponible(f"Claude no respondió: {e}") from e


def _via_gemini(system: str, historial: list[dict]) -> str:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise AsesorNoDisponible("Falta GEMINI_API_KEY en el entorno")
    try:
        resp = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{MODELO}:generateContent",
            params={"key": api_key},
            json={
                "systemInstruction": {"parts": [{"text": system}]},
                "contents": [
                    {
                        "role": "user" if m["rol"] == "usuario" else "model",
                        "parts": [{"text": m["contenido"]}],
                    }
                    for m in historial
                ],
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        partes = data["candidates"][0]["content"]["parts"]
        return "".join(p.get("text", "") for p in partes)
    except (requests.RequestException, KeyError, IndexError, ValueError) as e:
        raise AsesorNoDisponible(f"Gemini no respondió: {e}") from e


def _via_grok(system: str, historial: list[dict]) -> str:
    # xAI expone una API compatible con el formato de OpenAI.
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        raise AsesorNoDisponible("Falta XAI_API_KEY en el entorno")
    try:
        resp = requests.post(
            "https://api.x.ai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "content-type": "application/json"},
            json={
                "model": MODELO,
                "messages": [{"role": "system", "content": system}] + _mensajes_openai_like(historial),
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]
    except (requests.RequestException, KeyError, IndexError, ValueError) as e:
        raise AsesorNoDisponible(f"Grok no respondió: {e}") from e

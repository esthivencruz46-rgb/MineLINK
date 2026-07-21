"""Asesor conversacional del minero (julio 2026): responde preguntas en
lenguaje llano sobre SU propio diagnóstico ("¿por qué tengo que presentar
esto?", "¿a dónde voy si me suspendieron el REINFO?"). No genera archivos
ni asesora legalmente — solo explica, con base en el spec de negocio
(context/diagnostico_formalizacion.md) y el estado real de la operación.

Arquitectura RAG deliberadamente simple para el tamaño actual del
contenido (unos cientos de líneas, no miles de páginas): el "retrieval"
es incluir TODO el spec en cada pregunta — no hace falta base de datos
vectorial ni embeddings todavía. Si el contenido creciera mucho (ej. se
agrega el reglamento completo de la Ley MAPE), esa sería la señal para
migrar a retrieval real (chunking + embeddings + pgvector); mientras
tanto sería complejidad sin beneficio.

Generación intercambiable entre proveedores (julio 2026, pedido
explícito): `generar_respuesta()` es la ÚNICA función que sabe hablar con
una API externa. Todo lo demás (el prompt, el historial, los
guardarraíles) no se entera de cuál IA responde por detrás. Cambiar de
proveedor es elegir `MINELINK_ASESOR_PROVEEDOR` — no reescribir nada.
"""
import os
from pathlib import Path

import requests

import models
from scoring import estado_seguimiento

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


def _cargar_base_conocimiento() -> str:
    """El spec de negocio completo (fuente de verdad ya existente del
    proyecto) — se lee una sola vez y se cachea en memoria del proceso;
    no cambia mientras el servidor está corriendo."""
    partes = []
    for nombre in ("diagnostico_formalizacion.md", "perfil_usuario.md"):
        ruta = _RUTA_CONTEXTO / nombre
        if ruta.exists():
            partes.append(f"--- {nombre} ---\n{ruta.read_text(encoding='utf-8')}")
    return "\n\n".join(partes)


_BASE_CONOCIMIENTO_CACHE: str | None = None


def _base_conocimiento() -> str:
    global _BASE_CONOCIMIENTO_CACHE
    if _BASE_CONOCIMIENTO_CACHE is None:
        _BASE_CONOCIMIENTO_CACHE = _cargar_base_conocimiento()
    return _BASE_CONOCIMIENTO_CACHE


def _snapshot_operacion(operacion: models.Operacion) -> str:
    """El "retrieval" de la parte personal: el estado REAL y actual de
    esta operación específica — no la declaración original sin procesar,
    sino lo mismo que ya ve el minero en su cuenta (recalculado con
    scoring.estado_seguimiento, incluye brechas resueltas por admin)."""
    est = estado_seguimiento(operacion)
    legible = lambda codigos: ", ".join(c.replace("_", " ") for c in codigos) or "ninguna"
    lineas = [
        f"Perfil: {est.get('perfil') or 'sin determinar'}",
        f"Semáforo legal: {est.get('semaforo_legal') or 'sin datos'}",
        f"Semáforo técnico: {est.get('semaforo_tecnico') or 'no aplica a este perfil'}",
        f"Índice de madurez: {est.get('indice_madurez')}/5"
        if est.get("indice_madurez") is not None
        else "Índice de madurez: no aplica",
        f"Brechas pendientes (lo que le falta): {legible(est.get('brechas_pendientes') or [])}",
        f"Brechas ya resueltas: {legible(est.get('brechas_resueltas') or [])}",
        f"¿Apto para inversionistas ahora mismo?: {'sí' if est.get('apto_inversionistas') else 'no'}",
    ]
    if est.get("etiquetas_bloqueantes"):
        lineas.append(
            "Bloqueantes legales activos: " + "; ".join(est["etiquetas_bloqueantes"])
        )
    return "\n".join(lineas)


SYSTEM_PROMPT_BASE = """Eres el asesor de MineLink, una plataforma peruana que orienta a \
mineros artesanales en su proceso de formalización. Respondes preguntas del minero sobre \
SU propia situación, en español simple y directo, sin jerga legal innecesaria.

REGLAS QUE NUNCA ROMPES:
1. Respondes SOLO con base en el contenido que te doy abajo (el spec de MineLink) y en el \
estado del diagnóstico de esta persona. Nunca inventes trámites, plazos, montos ni artículos \
de ley que no estén en ese contenido.
2. Si la pregunta pide algo que no está en tu contenido (ej. un detalle de un reglamento que \
no tienes, o una situación jurídica particular), dilo con honestidad: "esto no lo tengo \
documentado, te recomiendo confirmarlo con un especialista o consultarlo directamente con \
las autoridades" — nunca completes el vacío adivinando.
3. NO eres un abogado ni dabas asesoría legal vinculante — al final de respuestas sobre \
temas legales o de riesgo (suspensión, caducidad, sanciones), recuerda brevemente que es \
orientación general, no asesoría legal.
4. No generas documentos, cartas ni escritos — solo explicas.
5. Respuestas cortas y claras (unos pocos párrafos como máximo), en el tono de alguien que \
ayuda de verdad, no de un manual.

CONTENIDO DE REFERENCIA (spec de MineLink):
{base_conocimiento}

ESTADO ACTUAL DE ESTA PERSONA:
{snapshot}
"""


def construir_system_prompt(operacion: models.Operacion) -> str:
    return SYSTEM_PROMPT_BASE.format(
        base_conocimiento=_base_conocimiento(),
        snapshot=_snapshot_operacion(operacion),
    )


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
        "Cuando se conecte una API real, aquí aparecerá la respuesta basada en tu "
        "diagnóstico y el spec de MineLink."
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

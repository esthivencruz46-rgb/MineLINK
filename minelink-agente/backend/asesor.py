"""Asesor conversacional PÚBLICO (julio 2026): cualquier visitante, sin
registrarse, puede preguntar en lenguaje llano sobre formalización minera
según el modelo de MineLink ("¿qué es el REINFO?", "¿para qué sirve un
IGAFOM?"). Genérico a propósito (decisión explícita del dueño, no
personalizado a un caso): no conoce el diagnóstico de nadie en
particular, solo el spec de negocio. No genera archivos ni asesora
legalmente.

Retrieval real (julio 2026, "Nivel 1.5"): `context/asesor_conocimiento/`
(recursivo — cualquier subcarpeta por tema) ya pasó de unas pocas páginas
a decenas de normas/guías completas (millones de caracteres) — mandar
TODO en cada pregunta ya no cabe en la ventana de contexto de un
proveedor real. En vez de eso, cada archivo se parte en fragmentos
(`_trocear`) y se indexan con BM25 (`rank_bm25`, búsqueda léxica por
palabras clave — sin base de datos vectorial ni embeddings, sin conectar
ningún servicio nuevo): por cada pregunta se recuperan solo los
`FRAGMENTOS_POR_PREGUNTA` fragmentos más relevantes
(`_recuperar_fragmentos_relevantes`) y esos son los que se mandan. El
núcleo (`diagnostico_formalizacion.md` + `perfil_usuario.md`, ~8K tokens)
siempre va completo porque es pequeño y describe MineLink mismo, casi
siempre relevante. Nutrir al asesor sigue siendo soltar un .md/.txt/.pdf
en `asesor_conocimiento/` (cualquier subcarpeta) sin tocar código; los
PDF se leen con PyMuPDF extrayendo su texto — funciona con PDFs de texto
real (la mayoría de normas de El Peruano lo son), no con un escaneo sin
capa de texto. BM25 es bueno con terminología exacta (REINFO, IGAFOM,
SEIA); las palabras se reducen a su raíz con `snowballstemmer` antes de
indexar/buscar (ej. "suspendieron"/"suspendido"/"suspender" cuentan como
la misma palabra) — evaluado contra preguntas coloquiales reales (julio
2026): sin esto, "me suspendieron y no sé qué hacer" no encontraba NADA
del contenido real sobre suspensión del REINFO, aunque exista, solo
porque el documento usa otra conjugación. Si tras esto las preguntas
coloquiales siguen sin encontrar lo que buscan, esa sería la señal para
sumar embeddings encima (ver conversación con Esthiven, julio 2026).

Segunda vía de nutrición — sin git (julio 2026, pedido explícito: "imagina
que ya no uso Claude Code"): documentos subidos desde /admin, guardados
como texto ya extraído en la tabla `DocumentoAsesor` (modelo
`routers/admin.py`). Este módulo NUNCA importa `database`/`models` ni abre
una sesión — sus tests deben poder correr sin base de datos. En vez de
eso, `actualizar_documentos_admin(documentos)` recibe la lista ya
consultada (nombre, categoría, texto) y la mezcla con los fragmentos del
filesystem al construir el índice; la llama `routers/asesor.py` (que sí
tiene sesión vía `Depends(get_db)`) antes de cada pregunta. Es barato
comparar y solo se reconstruye BM25 si los documentos admin cambiaron
desde la última pregunta.

Generación intercambiable entre proveedores (julio 2026, pedido
explícito): `generar_respuesta()` es la ÚNICA función que sabe hablar con
una API externa. Todo lo demás (el prompt, el historial, los
guardarraíles) no se entera de cuál IA responde por detrás.

Cadena de respaldo entre proveedores (julio 2026, pedido explícito de
Esthiven: "varias api, de modo que cuando se acaba la gratuidad por día
pasa al otro"): `MINELINK_ASESOR_PROVEEDORES` es una lista separada por
comas, en orden de prioridad (ej. "kimi,deepseek,qwen,glm").
`generar_respuesta()` prueba cada uno; si el que le toca falla por
CUALQUIER motivo (sin cuota, clave inválida, error de red — todo se
traduce a `AsesorNoDisponible`), pasa al siguiente de la lista sin que el
usuario note nada. Solo si TODOS fallan se avisa que el asesor no está
disponible. `MINELINK_ASESOR_PROVEEDOR` (singular) sigue funcionando para
un solo proveedor, por compatibilidad.
"""
import os
import re
from pathlib import Path

import fitz  # PyMuPDF
import requests
import snowballstemmer
from rank_bm25 import BM25Okapi

_STEMMER_ES = snowballstemmer.stemmer("spanish")

PROVEEDORES = [
    p.strip().lower()
    for p in (
        os.environ.get("MINELINK_ASESOR_PROVEEDORES")
        or os.environ.get("MINELINK_ASESOR_PROVEEDOR")
        or "simulado"
    ).split(",")
    if p.strip()
] or ["simulado"]

# Modelos por defecto de cada proveedor — se pueden pisar con
# MINELINK_ASESOR_MODELO_<PROVEEDOR> (ej. MINELINK_ASESOR_MODELO_KIMI=...)
# sin tocar código.
_MODELO_POR_DEFECTO = {
    "claude": "claude-haiku-4-5-20251001",
    # "flash" (no "flash-lite") devolvía 503 "high demand" de forma
    # consistente con el prompt real (~10K tokens) — verificado en vivo
    # julio 2026: 4/4 intentos con flash-lite respondieron bien en ~2s,
    # flash falló en 2 de 3 intentos incluso sin "thinking". Modelo nuevo
    # y popular = más saturado en el nivel gratis; flash-lite es más liviano.
    "gemini": "gemini-3.5-flash-lite",
    "grok": "grok-4-fast",
    "kimi": "kimi-k2.6",
    "deepseek": "deepseek-chat",
    "qwen": "qwen-plus",
    "glm": "glm-4.5",
    "openai": "gpt-5.4-nano",
}


def _modelo_para(proveedor: str) -> str:
    return os.environ.get(f"MINELINK_ASESOR_MODELO_{proveedor.upper()}") or _MODELO_POR_DEFECTO.get(
        proveedor, ""
    )


MAX_TURNOS_HISTORIAL = 6  # últimos N mensajes que se reenvían (controla el costo)

_RUTA_CONTEXTO = Path(__file__).parent.parent / "context"
# Carpeta de "nutrición" del asesor: cualquier .md/.txt/.pdf que se
# suelte acá (en cualquier subcarpeta) se suma al contenido de
# referencia sin tocar código (julio 2026).
_RUTA_CONOCIMIENTO_EXTRA = _RUTA_CONTEXTO / "asesor_conocimiento"

TAM_FRAGMENTO = 1200  # caracteres por fragmento (~300 tokens)
SOLAPE_FRAGMENTO = 150  # evita perder una idea que cae justo en el corte
FRAGMENTOS_POR_PREGUNTA = 8  # cuántos fragmentos se mandan como contexto por pregunta


def _extraer_texto_pdf(ruta: Path) -> str:
    """Best-effort (mismo patrón que geocatmin.py/geoubicacion.py): un PDF
    dañado o sin capa de texto (foto escaneada) no debe tumbar el asesor
    entero, solo aportar menos contenido."""
    try:
        with fitz.open(ruta) as doc:
            return "\n".join(pagina.get_text() for pagina in doc)
    except Exception:
        return ""


def extraer_texto_pdf_bytes(contenido: bytes) -> str:
    """Misma extracción que `_extraer_texto_pdf` pero desde bytes en
    memoria (para el endpoint de subida en /admin, que recibe un
    UploadFile y no debería escribir un archivo temporal en disco)."""
    try:
        with fitz.open(stream=contenido, filetype="pdf") as doc:
            return "\n".join(pagina.get_text() for pagina in doc)
    except Exception:
        return ""


def _cargar_nucleo() -> str:
    """El spec de negocio (fuente de verdad ya existente del proyecto):
    pequeño (~8K tokens) y casi siempre relevante porque describe
    MineLink mismo — va COMPLETO en cada pregunta, sin pasar por
    búsqueda."""
    partes = []
    for nombre in ("diagnostico_formalizacion.md", "perfil_usuario.md"):
        ruta = _RUTA_CONTEXTO / nombre
        if ruta.exists():
            partes.append(f"--- {nombre} ---\n{ruta.read_text(encoding='utf-8')}")
    return "\n\n".join(partes)


def _trocear(texto: str, tam: int = TAM_FRAGMENTO, solape: int = SOLAPE_FRAGMENTO) -> list[str]:
    """Ventana deslizante simple: no le importa cortar una oración a la
    mitad — el solape asegura que la idea completa aparezca en algún
    fragmento vecino de todas formas."""
    fragmentos = []
    inicio = 0
    n = len(texto)
    while inicio < n:
        fin = min(inicio + tam, n)
        fragmento = texto[inicio:fin].strip()
        if fragmento:
            fragmentos.append(fragmento)
        if fin == n:
            break
        inicio = fin - solape
    return fragmentos


# Sin esto, BM25 puede rankear más alto un documento que repite mucho
# "qué"/"es"/"el" (ej. un cuestionario) que uno con el término exacto
# buscado — verificado con el corpus real (julio 2026): "¿qué es el
# IGAFOM?" traía fragmentos de un manual sobre mercurio en vez del
# reglamento del IGAFOM, porque ese manual repetía "qué" muchas veces.
_STOPWORDS_ES = frozenset(
    """
    de la que el en y a los del se las por un para con no una su al lo como
    más pero sus le ya o este sí porque esta entre cuando muy sin sobre
    también me hasta hay donde quien desde todo nos durante todos uno les
    ni contra otros ese eso ante ellos e esto mí antes algunos qué unos yo
    otro otras otra él tanto esa estos mucho quienes nada muchos cual poco
    ella estar estas algunas algo nosotros mi mis tú te ti tu tus ellas
    estoy estás está estamos estáis están esté estés estemos estéis estén
    nosotras vosotros vosotras os mío mía míos mías tuyo tuya tuyos tuyas
    suyo suya suyos suyas nuestro nuestra nuestros nuestras vuestro
    vuestra vuestros vuestras esos esas es soy eres somos sois son sea
    seas seamos seáis sean seré serás será seremos seréis serán sería
    serías seríamos seríais serían era eras éramos erais eran fui fuiste
    fue fuimos fuisteis fueron he has ha hemos habéis han haya hayas
    hayamos hayáis hayan había habías habíamos habíais habían sino cada
    cómo cuál cuáles cuándo cuánto cuánta cuántos cuántas dónde puede
    pueden puedo podemos podría podrían debe deben así solo sólo vez
    hacer hace hacen
    """.split()
)


def _tokenizar(texto: str) -> list[str]:
    """Reduce cada palabra a su raíz (`suspendieron`/`suspendido`/
    `suspender` → `suspend`) para que BM25 encuentre coincidencias entre
    conjugaciones distintas de una misma palabra — verificado contra
    preguntas coloquiales reales, ver docstring del módulo."""
    palabras = [t for t in re.findall(r"\w+", texto.lower()) if t not in _STOPWORDS_ES]
    return _STEMMER_ES.stemWords(palabras)


def _cargar_fragmentos_extra() -> list[tuple[str, str]]:
    """Recorre `asesor_conocimiento/` (recursivo — cualquier subcarpeta
    por tema) y devuelve (etiqueta, texto_del_fragmento) por cada
    fragmento de cada archivo. La etiqueta incluye la ruta relativa para
    que el subtema quede visible (ej. "03_ambiental_seia/DS_016...")."""
    fragmentos: list[tuple[str, str]] = []
    if not _RUTA_CONOCIMIENTO_EXTRA.exists():
        return fragmentos

    def _agregar(ruta: Path, texto: str) -> None:
        etiqueta = ruta.relative_to(_RUTA_CONOCIMIENTO_EXTRA).as_posix()
        for trozo in _trocear(texto):
            fragmentos.append((etiqueta, trozo))

    for ruta in sorted(_RUTA_CONOCIMIENTO_EXTRA.rglob("*.md")):
        _agregar(ruta, ruta.read_text(encoding="utf-8"))
    for ruta in sorted(_RUTA_CONOCIMIENTO_EXTRA.rglob("*.txt")):
        _agregar(ruta, ruta.read_text(encoding="utf-8"))
    for ruta in sorted(_RUTA_CONOCIMIENTO_EXTRA.rglob("*.pdf")):
        texto = _extraer_texto_pdf(ruta)
        if texto.strip():
            _agregar(ruta, texto)
    return fragmentos


_NUCLEO_CACHE: str | None = None
_INDICE_CACHE: tuple[list[tuple[str, str]], BM25Okapi | None] | None = None
# Documentos subidos desde /admin (tabla DocumentoAsesor) — julio 2026,
# para que Esthiven pueda nutrir al asesor sin git ni Claude Code. Este
# módulo NUNCA toca la base de datos directamente (para que sus tests
# sigan corriendo sin BD): el router del asesor consulta la tabla con su
# propia sesión y llama a actualizar_documentos_admin() con el resultado
# antes de cada pregunta.
_DOCUMENTOS_ADMIN: list[tuple[str, str]] = []  # (etiqueta, texto completo)


def _nucleo() -> str:
    global _NUCLEO_CACHE
    if _NUCLEO_CACHE is None:
        _NUCLEO_CACHE = _cargar_nucleo()
    return _NUCLEO_CACHE


def actualizar_documentos_admin(documentos: list[tuple[str, str | None, str]]) -> None:
    """`documentos`: (nombre, categoria, texto) — ya extraído, tal como
    vive en DocumentoAsesor.activo=True. Se compara contra lo que ya
    había: si no cambió nada, no se invalida el índice (evita reconstruir
    BM25 sobre TODO el corpus en cada pregunta solo por una consulta que
    siempre devuelve lo mismo)."""
    global _DOCUMENTOS_ADMIN, _INDICE_CACHE
    nuevos = [
        (f"{categoria}/{nombre}" if categoria else nombre, texto)
        for nombre, categoria, texto in documentos
    ]
    if nuevos != _DOCUMENTOS_ADMIN:
        _DOCUMENTOS_ADMIN = nuevos
        _INDICE_CACHE = None  # fuerza reconstrucción en la próxima pregunta


def _indice_fragmentos() -> tuple[list[tuple[str, str]], BM25Okapi | None]:
    """Se construye una sola vez por proceso (o hasta que cambien los
    documentos admin) — trocear + indexar decenas de PDFs tarda varios
    segundos, no queremos pagar ese costo en cada pregunta."""
    global _INDICE_CACHE
    if _INDICE_CACHE is None:
        fragmentos = _cargar_fragmentos_extra()
        for etiqueta, texto in _DOCUMENTOS_ADMIN:
            fragmentos.extend((etiqueta, trozo) for trozo in _trocear(texto))
        indice = BM25Okapi([_tokenizar(texto) for _, texto in fragmentos]) if fragmentos else None
        _INDICE_CACHE = (fragmentos, indice)
    return _INDICE_CACHE


def _etiqueta_citable(etiqueta: str) -> str:
    """Convierte '02_formalizacion_integral/DS_038-2017-EM_Reglamento_IGAFOM.md'
    en 'DS 038-2017-EM Reglamento IGAFOM' — sin subcarpeta ni guiones bajos,
    para que el modelo la use directo como cita natural (julio 2026, pedido
    explícito: que responda "según el Decreto Supremo..." en vez de sonar
    genérico). Los nombres de archivo ya siguen el patrón de cita peruano
    (DS_NNN-AAAA-EM, Ley_NNNNN, RM_NNN-AAAA-MEM_DM...) porque así los
    organizó Esthiven al nutrir al asesor."""
    nombre = etiqueta.rsplit("/", 1)[-1]
    nombre = re.sub(r"\.(md|txt|pdf)$", "", nombre)
    return nombre.replace("_", " ")


def _recuperar_fragmentos_relevantes(pregunta: str, k: int = FRAGMENTOS_POR_PREGUNTA) -> str:
    """Búsqueda léxica (BM25, no semántica): encuentra los fragmentos
    donde más se repiten las palabras de la pregunta, ponderando más las
    palabras específicas (ej. "REINFO") que las comunes. Si la pregunta
    no comparte ninguna palabra con el corpus extra, no se fuerza
    contenido al azar — se devuelve vacío y el asesor responde solo con
    el núcleo."""
    fragmentos, indice = _indice_fragmentos()
    if not fragmentos or indice is None:
        return ""
    puntajes = indice.get_scores(_tokenizar(pregunta))
    mejores = sorted(range(len(fragmentos)), key=lambda i: puntajes[i], reverse=True)[:k]
    mejores = [i for i in mejores if puntajes[i] > 0]
    partes = [
        f"--- {_etiqueta_citable(fragmentos[i][0])} ---\n{fragmentos[i][1]}" for i in mejores
    ]
    return "\n\n".join(partes)


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
6. Cuando tu respuesta se base en una norma legal (marcada abajo con su nombre, ej. "DS \
038-2017-EM Reglamento IGAFOM" o "Ley 27651 Pequeña Mineria"), CÍTALA de forma natural \
dentro de tu respuesta — ej. "según el Decreto Supremo N° 038-2017-EM..." o "de acuerdo \
con la Ley N° 27651...". Le da formalidad a tu respuesta y permite verificar la fuente. \
Solo cita lo que de verdad viene marcado así en tu contenido — nunca inventes un número \
de norma que no esté ahí. Si la respuesta viene del spec de MineLink (no de una norma \
legal), simplemente explica, sin forzar una cita.

CONTENIDO DE REFERENCIA (spec de MineLink + normas legales que Esthiven cargó):
{base_conocimiento}
"""


def construir_system_prompt(pregunta: str) -> str:
    contenido = _nucleo()
    extra = _recuperar_fragmentos_relevantes(pregunta)
    if extra:
        contenido = f"{contenido}\n\n{extra}"
    return SYSTEM_PROMPT_BASE.format(base_conocimiento=contenido)


class AsesorNoDisponible(Exception):
    """El proveedor configurado no pudo responder (sin clave, error de red,
    error de la API) — el router lo traduce a un mensaje amable, nunca a
    un 500 crudo."""


def generar_respuesta(system: str, historial: list[dict]) -> str:
    """Única función que habla con un proveedor externo. `historial` es
    una lista de {"rol": "usuario"|"asesor", "contenido": str}, ya
    recortada a MAX_TURNOS_HISTORIAL por el caller.

    Prueba cada proveedor de PROVEEDORES en orden (cadena de respaldo): si
    el que le toca falla por lo que sea (sin cuota gratis del día, clave
    inválida, error de red), pasa solo al siguiente configurado — el
    usuario nunca lo nota. Si TODOS fallan, se propaga el último error
    para que el router avise que el asesor no está disponible."""
    adaptadores = {
        "claude": _via_claude,
        "gemini": _via_gemini,
        "grok": _via_grok,
        "kimi": _via_kimi,
        "deepseek": _via_deepseek,
        "qwen": _via_qwen,
        "glm": _via_glm,
        "openai": _via_openai,
    }
    if PROVEEDORES == ["simulado"]:
        return _via_simulado(system, historial)

    ultimo_error: AsesorNoDisponible | None = None
    for proveedor in PROVEEDORES:
        adaptador = adaptadores.get(proveedor)
        if adaptador is None:
            continue
        try:
            return adaptador(system, historial)
        except AsesorNoDisponible as e:
            ultimo_error = e
    if ultimo_error is not None:
        raise ultimo_error
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
                "model": _modelo_para("claude"),
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
            f"https://generativelanguage.googleapis.com/v1beta/models/{_modelo_para('gemini')}:generateContent",
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
                "model": _modelo_para("grok"),
                "messages": [{"role": "system", "content": system}] + _mensajes_openai_like(historial),
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]
    except (requests.RequestException, KeyError, IndexError, ValueError) as e:
        raise AsesorNoDisponible(f"Grok no respondió: {e}") from e


def _via_kimi(system: str, historial: list[dict]) -> str:
    # Moonshot AI (Kimi) — API compatible con el formato de OpenAI, mismo
    # patrón que _via_grok.
    api_key = os.environ.get("MOONSHOT_API_KEY")
    if not api_key:
        raise AsesorNoDisponible("Falta MOONSHOT_API_KEY en el entorno")
    try:
        resp = requests.post(
            "https://api.moonshot.ai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "content-type": "application/json"},
            json={
                "model": _modelo_para("kimi"),
                "messages": [{"role": "system", "content": system}] + _mensajes_openai_like(historial),
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]
    except (requests.RequestException, KeyError, IndexError, ValueError) as e:
        raise AsesorNoDisponible(f"Kimi no respondió: {e}") from e


def _via_deepseek(system: str, historial: list[dict]) -> str:
    # DeepSeek — API compatible con el formato de OpenAI.
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise AsesorNoDisponible("Falta DEEPSEEK_API_KEY en el entorno")
    try:
        resp = requests.post(
            "https://api.deepseek.com/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "content-type": "application/json"},
            json={
                "model": _modelo_para("deepseek"),
                "messages": [{"role": "system", "content": system}] + _mensajes_openai_like(historial),
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]
    except (requests.RequestException, KeyError, IndexError, ValueError) as e:
        raise AsesorNoDisponible(f"DeepSeek no respondió: {e}") from e


def _via_qwen(system: str, historial: list[dict]) -> str:
    # Qwen / DashScope (Alibaba Cloud) — modo compatible con OpenAI,
    # endpoint internacional (no el de China continental).
    api_key = os.environ.get("DASHSCOPE_API_KEY")
    if not api_key:
        raise AsesorNoDisponible("Falta DASHSCOPE_API_KEY en el entorno")
    try:
        resp = requests.post(
            "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "content-type": "application/json"},
            json={
                "model": _modelo_para("qwen"),
                "messages": [{"role": "system", "content": system}] + _mensajes_openai_like(historial),
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]
    except (requests.RequestException, KeyError, IndexError, ValueError) as e:
        raise AsesorNoDisponible(f"Qwen no respondió: {e}") from e


def _via_glm(system: str, historial: list[dict]) -> str:
    # GLM / Zhipu AI (bigmodel.cn) — modo compatible con OpenAI.
    api_key = os.environ.get("ZHIPU_API_KEY")
    if not api_key:
        raise AsesorNoDisponible("Falta ZHIPU_API_KEY en el entorno")
    try:
        resp = requests.post(
            "https://open.bigmodel.cn/api/paas/v4/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "content-type": "application/json"},
            json={
                "model": _modelo_para("glm"),
                "messages": [{"role": "system", "content": system}] + _mensajes_openai_like(historial),
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]
    except (requests.RequestException, KeyError, IndexError, ValueError) as e:
        raise AsesorNoDisponible(f"GLM no respondió: {e}") from e


def _via_openai(system: str, historial: list[dict]) -> str:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise AsesorNoDisponible("Falta OPENAI_API_KEY en el entorno")
    try:
        resp = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "content-type": "application/json"},
            json={
                "model": _modelo_para("openai"),
                "messages": [{"role": "system", "content": system}] + _mensajes_openai_like(historial),
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]
    except (requests.RequestException, KeyError, IndexError, ValueError) as e:
        raise AsesorNoDisponible(f"ChatGPT no respondió: {e}") from e

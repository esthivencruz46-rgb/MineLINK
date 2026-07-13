from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from catalogo_diagnostico import validar_respuestas

TIPOS_MINA = ("subterranea", "tajo_abierto")


def normalizar_whatsapp(v: str) -> str:
    """Acepta '+51 987654321', '987654321' o '+51987654321' y guarda
    siempre '+51987654321' (los enlaces wa.me necesitan el formato pegado)."""
    v = v.replace(" ", "").replace("-", "")
    if v and not v.startswith("+"):
        v = f"+51{v}"
    if not v.startswith("+51") or not v[1:].isdigit():
        raise ValueError("WhatsApp debe ser +51 seguido del número (ej. +51 987654321)")
    return v


def normalizar_respuesta_seguridad(v: str) -> str:
    """La respuesta de la pregunta de seguridad se compara sin importar
    mayúsculas ni espacios extra (igual que un humano la recordaría)."""
    v = v.strip().lower()
    if not v:
        raise ValueError("La respuesta de seguridad es obligatoria")
    return v


def normalizar_colegiatura(v: str) -> str:
    """Solo el número de colegiatura: se descarta 'CIP', espacios, etc."""
    numero = "".join(c for c in v if c.isdigit())
    if not numero:
        raise ValueError("La colegiatura debe ser solo el número (ej. 123456)")
    return numero


# ---------- Diagnostico ----------

class DiagnosticoRequest(BaseModel):
    respuestas: dict[str, str]
    region: str
    mineral: str
    tipo_mina: Literal["subterranea", "tajo_abierto"]
    situacion: Literal["minero_artesanal", "concesionario"] = "minero_artesanal"
    estado_formalizacion: Optional[str] = None
    nombre_minero: Optional[str] = None
    codigo_reinfo: Optional[str] = None
    produccion_mensual: Optional[str] = None
    maquinaria: Optional[str] = None
    num_trabajadores: Optional[str] = None
    estado_operacion: Optional[str] = None
    tipo_explotacion: Optional[str] = None
    material_comercializado: Optional[str] = None
    forma_comercializacion: Optional[str] = None
    tiempo_operacion: Optional[str] = None
    ley_promedio: Optional[str] = None
    ley_como_obtenida: Optional[str] = None
    especie_mineral: Optional[str] = None
    tiene_resultados_laboratorio: Optional[str] = None
    modalidad_trabajadores: Optional[str] = None
    provincia: Optional[str] = None
    sustancias_toxicas: Optional[str] = None
    gestion_sustancias: Optional[str] = None
    incidentes_previos: Optional[str] = None
    permisos_comunitarios: Optional[str] = None
    acceso_logistico: Optional[str] = None
    experiencia_operador: Optional[str] = None
    capacitacion_operador: Optional[str] = None
    documentacion_disponible: Optional[str] = None
    plan_formalizacion: Optional[str] = None
    prioridad_crecimiento: Optional[str] = None
    concesion_vigente: Optional[str] = None
    tipo_deposito: Optional[str] = None
    etapa_proyecto: Optional[str] = None
    trabajos_exploracion_json: Optional[list[str]] = None
    info_geologica_disponible: Optional[str] = None
    tiene_estimaciones_leyes: Optional[str] = None
    pagos_vigencia_al_dia: Optional[str] = None
    toneladas_estimadas: Optional[str] = None
    ley_esperada: Optional[str] = None
    capital_disponible: Optional[str] = None
    estudio_previo: Optional[str] = None
    historial_operacion: Optional[str] = None
    pasivos_ambientales: Optional[str] = None
    experiencia_titular: Optional[str] = None
    background_titular: Optional[str] = None
    equipo_tecnico: Optional[str] = None
    tipo_socio_buscado: Optional[str] = None
    siguiente_hito: Optional[str] = None
    timeline_operacion: Optional[str] = None
    motivo_inicio: Optional[str] = None
    documento_autorizacion: Optional[str] = None
    tipo_apoyo_json: Optional[list[str]] = None
    tipo_apoyo: Optional[str] = None
    acceso_agua: Optional[str] = None
    acceso_energia: Optional[str] = None
    conflictividad_social: Optional[str] = None
    estructura_propiedad: Optional[str] = None
    moneda_capital: Optional[str] = None
    monto_requerido: Optional[str] = None
    plazo_capital: Optional[str] = None
    motivo_capital: Optional[str] = None
    produccion_objetivo: Optional[str] = None
    uso_fondos_diagnostico: Optional[str] = None


class DiagnosticoResponse(BaseModel):
    id: str
    perfil: str
    clasificacion: Optional[str] = None
    semaforo_legal: str
    bloqueantes: list[str]
    etiquetas_bloqueantes: list[str]
    semaforo_tecnico: Optional[str] = None
    indice_madurez: Optional[int] = None
    riesgo_caducidad: bool
    apto_inversionistas: bool
    urgencia: Optional[dict] = None
    reloj_produccion: Optional[dict] = None
    brechas: list[str]
    salidas: list[str]


# ---------- Empresa / Consultor ----------
# "tipo" distingue empresas (persona jurídica, RUC) de consultores
# independientes (profesionales colegiados, sin RUC obligatorio).

class EmpresaBase(BaseModel):
    tipo: Literal["empresa", "consultor"] = "empresa"
    nombre: str
    ruc: Optional[str] = None
    colegiatura: Optional[str] = None
    cv_filename: Optional[str] = None
    anios_servicio: int
    regiones_json: list[str]
    estudios_json: list[str]
    whatsapp: str
    email: Optional[str] = None
    activa: bool = True
    # Calificación (0-5) y reseñas que la respaldan — solo visible en el
    # admin por ahora; ordena internamente los listados públicos
    rating: Optional[float] = None
    num_resenas: Optional[int] = None

    @field_validator("rating")
    @classmethod
    def validar_rating(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (0 <= v <= 5):
            raise ValueError("rating debe estar entre 0 y 5")
        return v

    @field_validator("ruc")
    @classmethod
    def validar_ruc(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not (v.isdigit() and len(v) == 11):
            raise ValueError("RUC debe tener exactamente 11 dígitos numéricos")
        return v

    @field_validator("whatsapp")
    @classmethod
    def validar_whatsapp(cls, v: str) -> str:
        return normalizar_whatsapp(v)

    @field_validator("colegiatura")
    @classmethod
    def validar_colegiatura(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        return normalizar_colegiatura(v)

    @field_validator("regiones_json")
    @classmethod
    def validar_regiones(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("Debe marcar al menos 1 departamento")
        return v

    @field_validator("estudios_json")
    @classmethod
    def validar_estudios(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("Debe marcar al menos 1 estudio")
        return v

    @model_validator(mode="after")
    def validar_segun_tipo(self) -> "EmpresaBase":
        if self.tipo == "empresa" and not self.ruc:
            raise ValueError("Las empresas deben tener RUC (11 dígitos)")
        if self.tipo == "consultor" and not self.colegiatura:
            raise ValueError("Los consultores independientes deben indicar su colegiatura")
        return self


class EmpresaCreate(EmpresaBase):
    pass


class EmpresaUpdate(EmpresaBase):
    pass


class EmpresaOut(EmpresaBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class EmpresaPublicoOut(BaseModel):
    """Lo que ve el minero en /empresas — sin whatsapp ni email. El
    contacto directo por WhatsApp se reemplazó por "Me interesa"
    (POST /empresas/{id}/interes): Esthiven ve el interés en /admin y es
    quien escribe a la empresa desde su propio número, dándole el
    contacto del minero. Así ningún visitante se va del sitio sin que
    quede registro, y Esthiven siempre puede hacer seguimiento."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    tipo: Literal["empresa", "consultor"]
    nombre: str
    ruc: Optional[str] = None
    colegiatura: Optional[str] = None
    anios_servicio: int
    regiones_json: list[str]
    estudios_json: list[str]
    activa: bool
    created_at: datetime
    # No se muestra en la UI pública, pero el frontend lo usa para ordenar
    # internamente los bloques (Empresas / Consultores) de mejor a peor.
    rating: Optional[float] = None
    num_resenas: Optional[int] = None


class MejorOpcionOut(BaseModel):
    modo: Literal["empresa_unica", "por_brecha"]
    empresa_unica: Optional[EmpresaOut] = None
    mejores_por_brecha: Optional[dict[str, Optional[EmpresaOut]]] = None


# ---------- Postulación pública de consultor independiente ----------
# Requisitos duros pedidos por el negocio: mínimo 3 años de experiencia
# y colegiatura vigente. Queda SIEMPRE inactiva hasta que Esthiven la
# apruebe desde el panel admin (mismo patrón que "nunca inventar
# empresas": aquí nadie se publica solo).

class PostulacionConsultorCreate(BaseModel):
    nombre: str
    colegiatura: str
    anios_servicio: int
    regiones_json: list[str]
    estudios_json: list[str]
    whatsapp: str
    email: Optional[str] = None

    @field_validator("colegiatura")
    @classmethod
    def validar_colegiatura(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("La colegiatura es obligatoria")
        return normalizar_colegiatura(v)

    @field_validator("anios_servicio")
    @classmethod
    def validar_experiencia_minima(cls, v: int) -> int:
        if v < 3:
            raise ValueError("Se requiere un mínimo de 3 años de experiencia")
        return v

    @field_validator("whatsapp")
    @classmethod
    def validar_whatsapp(cls, v: str) -> str:
        return normalizar_whatsapp(v)

    @field_validator("regiones_json")
    @classmethod
    def validar_regiones(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("Debe marcar al menos 1 departamento")
        return v

    @field_validator("estudios_json")
    @classmethod
    def validar_estudios(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("Debe marcar al menos 1 estudio en el que ayudas")
        return v


# ---------- Lead ----------

class LeadCreate(BaseModel):
    nombre: str
    whatsapp: str
    operacion_id: str
    region: str
    username: str
    password: str
    pregunta_seguridad: str
    respuesta_seguridad: str
    email: Optional[str] = None
    nombre_operacion: Optional[str] = None
    codigo_reinfo: Optional[str] = None

    @field_validator("region")
    @classmethod
    def validar_region(cls, v: str) -> str:
        v = v.strip().lower()
        if not v:
            raise ValueError("El departamento es obligatorio")
        return v

    @field_validator("whatsapp")
    @classmethod
    def validar_whatsapp(cls, v: str) -> str:
        return normalizar_whatsapp(v)

    @field_validator("username")
    @classmethod
    def validar_username(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("El usuario debe tener al menos 3 caracteres")
        if not v.replace("_", "").replace(".", "").isalnum():
            raise ValueError("El usuario solo puede tener letras, números, '_' o '.'")
        return v.lower()

    @field_validator("password")
    @classmethod
    def validar_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("La contraseña debe tener al menos 6 caracteres")
        return v

    @field_validator("pregunta_seguridad")
    @classmethod
    def validar_pregunta_seguridad(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("La pregunta de seguridad es obligatoria")
        return v

    @field_validator("respuesta_seguridad")
    @classmethod
    def validar_respuesta_seguridad(cls, v: str) -> str:
        return normalizar_respuesta_seguridad(v)


class MineroLogin(BaseModel):
    username: str
    password: str


class PreguntaSeguridadOut(BaseModel):
    pregunta: str


class RecuperarPasswordRequest(BaseModel):
    username: str
    respuesta_seguridad: str
    nueva_password: str

    @field_validator("respuesta_seguridad")
    @classmethod
    def validar_respuesta_seguridad(cls, v: str) -> str:
        return normalizar_respuesta_seguridad(v)

    @field_validator("nueva_password")
    @classmethod
    def validar_nueva_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("La contraseña debe tener al menos 6 caracteres")
        return v


class DocumentoOperacionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    categoria: str
    nombre_original: str
    content_type: str
    created_at: datetime
    # Revisión del admin (julio 2026): "pendiente" | "aprobado" | "rechazado".
    estado_revision: str = "pendiente"
    motivo_rechazo: Optional[str] = None


class RevisarDocumentoRequest(BaseModel):
    """Body de PUT /admin/documentos/{id}/revision."""

    estado_revision: Literal["aprobado", "rechazado"]
    motivo_rechazo: Optional[str] = None

    @field_validator("motivo_rechazo")
    @classmethod
    def exigir_motivo_si_rechaza(cls, v, info):
        if info.data.get("estado_revision") == "rechazado" and not (v and v.strip()):
            raise ValueError("Indica el motivo del rechazo")
        return v


# ---------- Módulo INV (perfil de inversión) ----------

class EnviarInversionRequest(BaseModel):
    """Body de POST /mineros/inversion. Los valores son string para
    preguntas de opción única, o list[str] para las multi-selección
    (INV_0_2/INV_0_4) — ver catalogo_inversion.validar_respuestas_inversion."""

    respuestas: dict[str, str | list[str]]


class CategoriaRequeridaOut(BaseModel):
    categoria: str
    etiqueta: str
    aprobado: bool


class AlertaInversionOut(BaseModel):
    codigo: str
    texto: str


class InversionEstadoOut(BaseModel):
    """Respuesta de GET /mineros/inversion — todo lo que la cuenta del
    minero necesita para decidir qué mostrar (no aplica/wizard/enviado/
    publicado). La publicación en la cartera es automática al enviarse,
    no hay un visto bueno manual del admin que esperar."""

    ofrece: bool
    prioridad: Optional[str] = None
    motivo: Optional[str] = None
    respuestas: dict[str, str | list[str]] = {}
    enviado: bool = False
    categorias_requeridas: list[CategoriaRequeridaOut] = []


class InversionAdminOut(BaseModel):
    """Respuesta de GET /admin/operaciones/{operacion_id}/inversion — solo
    informativo (respuestas + alertas + documentos), sin acción de
    aprobación asociada."""

    respuestas: dict[str, str | list[str]] = {}
    enviado: bool = False
    alertas: list[AlertaInversionOut] = []
    categorias_requeridas: list[CategoriaRequeridaOut] = []


class NotificacionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tipo: str
    mensaje: str
    leida: bool
    created_at: datetime


class CategoriaFotoOut(BaseModel):
    categoria: str
    etiqueta: str


class EstudioAplicableOut(BaseModel):
    """Un estudio que el minero puede respaldar con foto — incluye qué
    respondió (pregunta_id + valor crudo) para que el frontend muestre su
    propia declaración al lado del slot (ej. "Marcaste: En trámite")."""
    codigo: str
    pregunta_id: str
    valor: str


class MineroPerfilOut(BaseModel):
    # El id de la Operacion (no el del Lead) — lo necesita el frontend para
    # el flujo "Me interesa" de /empresas cuando llega desde una cuenta ya
    # autenticada (antes solo existía justo después del diagnóstico, vía
    # sessionStorage — un usuario que vuelve más tarde no lo tenía).
    operacion_id: str
    nombre: str
    whatsapp: str
    email: Optional[str] = None
    nombre_operacion: Optional[str] = None
    region: str
    mineral: str
    tipo_mina: str
    codigo_reinfo: Optional[str] = None
    created_at: datetime
    # Ruta 1 (minero_artesanal) vs Ruta 2 (concesionario) — decide qué
    # ventana ve el usuario: /mi-cuenta o /mi-concesion
    situacion: str = "minero_artesanal"
    # Estado en el pipeline de formalización (None = diagnóstico viejo)
    estado_formalizacion: Optional[str] = None
    # Declaración original del diagnóstico
    score_total: int
    bloqueado: bool
    brechas: list[str]
    # Seguimiento del admin (progreso desde el diagnóstico original)
    brechas_resueltas: list[str]
    brechas_pendientes: list[str]
    score_actual: int = 0
    bloqueado_actual: bool = False
    # Track Legal / Track Técnico del nuevo modelo (julio 2026), recalculados
    # en cada lectura vía scoring.estado_seguimiento — reemplazan score_actual/
    # bloqueado_actual en la UI (esos dos siguen aquí por compatibilidad).
    # None en diagnósticos del modelo anterior (sin catálogo con que cruzar).
    perfil: Optional[str] = None
    clasificacion: Optional[str] = None
    semaforo_legal: Optional[str] = None
    bloqueantes: list[str] = []
    etiquetas_bloqueantes: list[str] = []
    semaforo_tecnico: Optional[str] = None
    indice_madurez: Optional[int] = None
    riesgo_caducidad: bool = False
    apto_inversionistas: bool = False
    urgencia: Optional[dict] = None
    reloj_produccion: Optional[dict] = None
    salidas: list[str] = []
    # Perfil de inversión (opcional, ver PerfilInversionUpdate)
    descripcion_operacion: Optional[str] = None
    capacidad_produccion: Optional[str] = None
    capital_buscado: Optional[str] = None
    uso_fondos: Optional[str] = None
    ubicacion_maps: Optional[str] = None
    # "buscando" → "contactado": estado del acompañamiento de MineLink
    estado_contacto: str = "buscando"
    # Perfil capturado en el diagnóstico (ver context/criterios_score.md) —
    # informativo, declaración original, no editable desde aquí
    estado_operacion: Optional[str] = None
    tipo_explotacion: Optional[str] = None
    material_comercializado: Optional[str] = None
    forma_comercializacion: Optional[str] = None
    tiempo_operacion: Optional[str] = None
    ley_promedio: Optional[str] = None
    ley_como_obtenida: Optional[str] = None
    # Especie mineralógica declarada por elemento (ej. "Cobre: Calcopirita,
    # Malaquita"), no solo el elemento económico — ver criterios_score.md.
    especie_mineral: Optional[str] = None
    tiene_resultados_laboratorio: Optional[str] = None
    modalidad_trabajadores: Optional[str] = None
    provincia: Optional[str] = None
    sustancias_toxicas: Optional[str] = None
    gestion_sustancias: Optional[str] = None
    incidentes_previos: Optional[str] = None
    permisos_comunitarios: Optional[str] = None
    acceso_logistico: Optional[str] = None
    experiencia_operador: Optional[str] = None
    capacitacion_operador: Optional[str] = None
    documentacion_disponible: Optional[str] = None
    plan_formalizacion: Optional[str] = None
    prioridad_crecimiento: Optional[str] = None
    concesion_vigente: Optional[str] = None
    tipo_deposito: Optional[str] = None
    etapa_proyecto: Optional[str] = None
    trabajos_exploracion_json: Optional[list[str]] = None
    info_geologica_disponible: Optional[str] = None
    tiene_estimaciones_leyes: Optional[str] = None
    pagos_vigencia_al_dia: Optional[str] = None
    toneladas_estimadas: Optional[str] = None
    ley_esperada: Optional[str] = None
    capital_disponible: Optional[str] = None
    estudio_previo: Optional[str] = None
    historial_operacion: Optional[str] = None
    pasivos_ambientales: Optional[str] = None
    experiencia_titular: Optional[str] = None
    background_titular: Optional[str] = None
    equipo_tecnico: Optional[str] = None
    tipo_socio_buscado: Optional[str] = None
    siguiente_hito: Optional[str] = None
    timeline_operacion: Optional[str] = None
    motivo_inicio: Optional[str] = None
    documento_autorizacion: Optional[str] = None
    tipo_apoyo_json: Optional[list[str]] = None
    tipo_apoyo: Optional[str] = None
    acceso_agua: Optional[str] = None
    acceso_energia: Optional[str] = None
    conflictividad_social: Optional[str] = None
    estructura_propiedad: Optional[str] = None
    moneda_capital: Optional[str] = None
    monto_requerido: Optional[str] = None
    plazo_capital: Optional[str] = None
    motivo_capital: Optional[str] = None
    produccion_objetivo: Optional[str] = None
    uso_fondos_diagnostico: Optional[str] = None
    # Estudios del catálogo que aplican a su tipo_mina/situación (ver
    # routers.mineros._estudios_aplicables) — para que pueda subir una foto
    # de respaldo por cada uno desde /mi-cuenta o /mi-concesion, junto con
    # lo que declaró en el diagnóstico para ese estudio.
    estudios_aplicables: list[EstudioAplicableOut] = []
    # Fotos condicionadas al PERFIL informativo (mineral que extrae, camino
    # de acceso, fuente de agua/energía) — solo si el minero declaró ese
    # dato, con su propia respuesta ya incluida en la etiqueta (ver
    # uploads_config.categorias_perfil_foto_aplicables).
    fotos_perfil: list[CategoriaFotoOut] = []
    # True si declaró ser titular de la concesión (L2), False si no, None
    # si por algún motivo no se pudo determinar — para mostrar en
    # "Documentos legales" SOLO el slot que le aplica ("Título de
    # concesión" si es titular, "Contrato de explotación" si no) en vez de
    # los dos, que confundía (julio 2026).
    es_titular_concesion: Optional[bool] = None
    # El minero ya pulsó "Guardar archivos" en "Respalda tu declaración".
    # Ya NO hay un visto_bueno del admin que desbloquee nada — la
    # publicación en la cartera es automática al enviar (ver
    # apto_inversionistas en scoring.estado_seguimiento). El admin puede
    # seguir aprobando/rechazando documentos puntuales (informativo, ver
    # DocumentoOperacion.estado_revision), pero eso ya no bloquea nada.
    documentos_enviados: bool = False
    # Módulo INV (julio 2026) — si se ofrece a este minero y en qué estado
    # está su envío, para que la cuenta muestre el botón correcto.
    inversion_ofrecida: bool = False
    inversion_prioridad: Optional[str] = None
    inv_enviado: bool = False
    # Documentos de sustento del Módulo INV (liquidaciones de venta, etc.)
    # — para que la cuenta los muestre igual que "Respalda tu declaración"
    # de formalización, no solo dentro del wizard de /mi-inversion.
    categorias_requeridas_inversion: list[CategoriaRequeridaOut] = []
    # "Respalda tu inversión": evidencia puntual de LO QUE RESPONDIÓ en el
    # Módulo INV (ej. si dijo que aporta maquinaria, foto de la maquinaria;
    # si dijo que vende a alguien, foto/liquidación de esa venta) — igual
    # que estudios_aplicables pero para las respuestas de inversión (ver
    # catalogo_inversion.respaldos_declarados_inversion).
    respaldos_declarados_inversion: list[EstudioAplicableOut] = []


class ProyectoPublicoOut(BaseModel):
    """Vista pública de un proyecto registrado, para la sección
    "Proyectos" del inicio. NUNCA incluye nombre real, WhatsApp ni email
    — esos datos de contacto son solo para el panel admin."""

    operacion_id: str
    nombre_proyecto: str
    region: str
    mineral: str
    tipo_mina: str
    situacion: str
    # Perfil del pipeline (A/A_avanzado/B/C/D; guardado en la columna
    # estado_formalizacion). None = fila del modelo anterior.
    estado_formalizacion: Optional[str] = None
    perfil: Optional[str] = None
    # Tarjeta del spec (julio 2026): dos semáforos independientes + Índice
    # de Madurez 0-5 — reemplazan a los scores 0-100 retirados.
    semaforo_legal: Optional[str] = None
    semaforo_tecnico: Optional[str] = None
    indice_madurez: Optional[int] = None
    # Avance documentario del perfil C ("5/7 documentos")
    docs_completados: Optional[int] = None
    docs_totales: Optional[int] = None
    # ¿Vende con liquidación formal? (evidencia de flujo de caja, perfil C)
    vende_liquidacion: Optional[bool] = None
    # Informativo (true = tiene un bloqueante legal activo); el listado ya
    # viene filtrado por la regla de bloqueo del spec.
    bloqueado_actual: bool = False
    descripcion_operacion: Optional[str] = None
    capacidad_produccion: Optional[str] = None
    capital_buscado: Optional[str] = None
    uso_fondos: Optional[str] = None
    created_at: datetime
    # Primera foto de la mina (miniatura para la tarjeta en /proyectos)
    foto_portada_url: Optional[str] = None


class FotoPublicaOut(BaseModel):
    id: int
    url: str


class DimensionOut(BaseModel):
    puntaje: int
    maximo: int


class ProyectoDetalleOut(ProyectoPublicoOut):
    """Detalle público de un proyecto (al hacer clic desde /proyectos).
    Además del resumen, incluye las fotos de la mina y las fotos de los
    documentos legales que presentó el minero (todo se sube o se convierte
    a foto, nunca se guarda un PDF crudo — ver
    imagenes.convertir_pdf_a_imagen)."""

    fotos: list[FotoPublicaOut] = []
    documentos_presentados: dict[str, bool] = {}
    documentos_legales: dict[str, list[FotoPublicaOut]] = {}
    # Fotos de respaldo por estudio (misma idea que documentos_legales pero
    # para el catálogo de estudios de formalización, no solo los 5 legales
    # fijos — ver uploads_config.CATEGORIAS_ESTUDIO).
    documentos_estudios: dict[str, list[FotoPublicaOut]] = {}
    # Subconjunto de brechas_resueltas que además tiene foto de respaldo
    # subida. El diagnóstico es autodeclarado (el minero puede responder
    # "sí" a todo sin sustento), así que el check ✓ en la ficha pública
    # solo se muestra para brechas en esta lista, no para brechas_resueltas.
    brechas_verificadas: list[str] = []
    # True si declaró ser titular de la concesión, False si no, None si no
    # aplica — el frontend usa esto para mostrar solo el documento legal que
    # corresponde (Título de concesión O Contrato de explotación, nunca
    # ambos), igual que en su propia cuenta (julio 2026).
    es_titular_concesion: Optional[bool] = None
    # Enlace de Google Maps que dejó el minero (público a propósito:
    # el inversionista necesita saber la zona; el contacto sigue privado)
    ubicacion_maps: Optional[str] = None
    # Coordenadas "lat,lng" para el mapa incrustado (None si no se pudieron
    # resolver del enlace)
    ubicacion_coords: Optional[str] = None
    # Descripción redactada automáticamente a partir de los datos REALES
    # del diagnóstico y el perfil — nunca inventa cifras
    descripcion_generada: Optional[str] = None
    # Igual que en /admin/leads: brechas = estudios que le faltan al
    # proyecto, por código (ej. "sctr", "iperc") — el frontend ya tiene
    # las etiquetas legibles y a qué dimensión pertenece cada una.
    brechas_pendientes: list[str] = []
    brechas_resueltas: list[str] = []
    dimensiones: Optional[dict[str, DimensionOut]] = None
    # Desglose del Score de Atractivo de Inversión (Fase 2): formalizacion,
    # escala_economica, viabilidad_tecnica, riesgo_ambiental_social,
    # capacidad_equipo, claridad_oportunidad — ver scoring.PESOS_INVERSION.
    dimensiones_inversion: dict[str, DimensionOut] = {}
    # Perfil informativo del diagnóstico (Fase 1) — antes solo se usaba
    # para calcular score_inversion, invisible al inversionista. Ahora
    # también se expone tal cual para la sección "Perfil del proyecto" de
    # la ficha pública (nunca datos de contacto, solo info del negocio).
    tiempo_operacion: Optional[str] = None
    ley_promedio: Optional[str] = None
    ley_como_obtenida: Optional[str] = None
    # Especie mineralógica declarada por elemento (ej. "Cobre: Calcopirita,
    # Malaquita"), no solo el elemento económico — ver criterios_score.md.
    especie_mineral: Optional[str] = None
    tiene_resultados_laboratorio: Optional[str] = None
    num_trabajadores: Optional[str] = None
    modalidad_trabajadores: Optional[str] = None
    maquinaria: Optional[str] = None
    provincia: Optional[str] = None
    sustancias_toxicas: Optional[str] = None
    gestion_sustancias: Optional[str] = None
    acceso_agua: Optional[str] = None
    acceso_energia: Optional[str] = None
    tipo_apoyo: Optional[str] = None
    moneda_capital: Optional[str] = None
    monto_requerido: Optional[str] = None
    plazo_capital: Optional[str] = None
    uso_fondos_diagnostico: Optional[str] = None
    motivo_capital: Optional[str] = None
    produccion_objetivo: Optional[str] = None
    incidentes_previos: Optional[str] = None
    conflictividad_social: Optional[str] = None
    permisos_comunitarios: Optional[str] = None
    acceso_logistico: Optional[str] = None
    experiencia_operador: Optional[str] = None
    capacitacion_operador: Optional[str] = None
    documentacion_disponible: Optional[str] = None
    estructura_propiedad: Optional[str] = None
    plan_formalizacion: Optional[str] = None
    prioridad_crecimiento: Optional[str] = None
    concesion_vigente: Optional[str] = None
    pagos_vigencia_al_dia: Optional[str] = None
    tipo_deposito: Optional[str] = None
    toneladas_estimadas: Optional[str] = None
    ley_esperada: Optional[str] = None
    etapa_proyecto: Optional[str] = None
    trabajos_exploracion_json: Optional[list[str]] = None
    info_geologica_disponible: Optional[str] = None
    tiene_estimaciones_leyes: Optional[str] = None
    capital_disponible: Optional[str] = None
    estudio_previo: Optional[str] = None
    historial_operacion: Optional[str] = None
    pasivos_ambientales: Optional[str] = None
    experiencia_titular: Optional[str] = None
    background_titular: Optional[str] = None
    equipo_tecnico: Optional[str] = None
    tipo_socio_buscado: Optional[str] = None
    siguiente_hito: Optional[str] = None
    timeline_operacion: Optional[str] = None
    motivo_inicio: Optional[str] = None
    documento_autorizacion: Optional[str] = None


class PerfilInversionUpdate(BaseModel):
    descripcion_operacion: Optional[str] = None
    capacidad_produccion: Optional[str] = None
    capital_buscado: Optional[str] = None
    uso_fondos: Optional[str] = None
    ubicacion_maps: Optional[str] = None

    @field_validator("ubicacion_maps")
    @classmethod
    def validar_enlace_maps(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        enlace = v.strip()
        dominios_maps = (
            "google.com/maps",
            "maps.google.",
            "maps.app.goo.gl",
            "goo.gl/maps",
        )
        if not enlace.startswith(("http://", "https://")) or not any(
            d in enlace for d in dominios_maps
        ):
            raise ValueError(
                "La ubicación debe ser un enlace de Google Maps "
                "(compártelo desde la app de Maps con el botón Compartir)"
            )
        return enlace


class InteresInversionCreate(BaseModel):
    nombre: str
    username: str
    password: str
    pregunta_seguridad: str
    respuesta_seguridad: str
    telefono: Optional[str] = None
    email: Optional[str] = None
    motivo_inversion: Optional[str] = None
    monto: Optional[str] = None
    informacion_requerida: Optional[str] = None
    mensaje: Optional[str] = None

    @field_validator("pregunta_seguridad")
    @classmethod
    def validar_pregunta_seguridad(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("La pregunta de seguridad es obligatoria")
        return v

    @field_validator("respuesta_seguridad")
    @classmethod
    def validar_respuesta_seguridad(cls, v: str) -> str:
        return normalizar_respuesta_seguridad(v)

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("El nombre es obligatorio")
        return v.strip()

    @field_validator("email")
    @classmethod
    def validar_email(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.strip():
            if "@" not in v:
                raise ValueError("Email inválido")
            return v.strip()
        return None

    @field_validator("username")
    @classmethod
    def validar_username(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("El usuario debe tener al menos 3 caracteres")
        if not v.replace("_", "").replace(".", "").isalnum():
            raise ValueError("El usuario solo puede tener letras, números, '_' o '.'")
        return v.lower()

    @field_validator("password")
    @classmethod
    def validar_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("La contraseña debe tener al menos 6 caracteres")
        return v


class InteresInversionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    operacion_id: str
    nombre: str
    telefono: Optional[str] = None
    email: Optional[str] = None
    motivo_inversion: Optional[str] = None
    monto: Optional[str] = None
    informacion_requerida: Optional[str] = None
    mensaje: Optional[str] = None
    created_at: datetime


# ---------- Interés del minero en una empresa/consultor puntual ----------
# Reemplaza el botón "Escribir por WhatsApp" de /empresas: en vez de que
# el minero salga del sitio a hablar directo con la empresa (sin que
# Esthiven se entere), deja su contacto para ESA empresa en particular y
# Esthiven hace de intermediario manualmente (mismo patrón que
# InteresInversion, pero sin crear una cuenta nueva — el minero ya pasó
# por el diagnóstico, solo se pide nombre + WhatsApp).

class InteresEmpresaCreate(BaseModel):
    operacion_id: str
    nombre: str
    whatsapp: str
    brecha: Optional[str] = None
    mensaje: Optional[str] = None

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("El nombre es obligatorio")
        return v.strip()

    @field_validator("whatsapp")
    @classmethod
    def validar_whatsapp(cls, v: str) -> str:
        return normalizar_whatsapp(v)


class InteresEmpresaOut(BaseModel):
    id: int
    operacion_id: str
    empresa_id: int
    empresa_nombre: str
    empresa_whatsapp: str
    nombre: str
    whatsapp: str
    brecha: Optional[str] = None
    mensaje: Optional[str] = None
    estado_contacto: str
    created_at: datetime


class InversionistaLogin(BaseModel):
    username: str
    password: str


class InversionistaPerfilOut(BaseModel):
    nombre: str
    telefono: Optional[str] = None
    email: Optional[str] = None
    motivo_inversion: Optional[str] = None
    monto: Optional[str] = None
    informacion_requerida: Optional[str] = None
    mensaje: Optional[str] = None
    operacion_id: str
    created_at: datetime


class LeadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    operacion_id: str
    nombre: str
    whatsapp: str
    email: Optional[str] = None
    nombre_operacion: Optional[str] = None
    region: str
    codigo_reinfo: Optional[str] = None
    created_at: datetime


# ---------- Admin auth ----------

class AdminLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------- Admin: leads y dashboard ----------

class LeadConDiagnostico(BaseModel):
    id: int
    operacion_id: str
    nombre: str
    whatsapp: str
    email: Optional[str] = None
    nombre_operacion: Optional[str] = None
    region: str
    codigo_reinfo: Optional[str] = None
    created_at: datetime
    # Declaración original del minero — INMUTABLE, nunca se edita
    score_total: int
    bloqueado: bool
    brechas: list[str]
    # Seguimiento del admin: recalculado a partir de brechas_resueltas,
    # sin tocar lo de arriba
    brechas_resueltas: list[str]
    brechas_pendientes: list[str]
    score_actual: int = 0
    bloqueado_actual: bool = False
    # Perfil de inversión que el minero llenó desde /mi-cuenta (opcional)
    descripcion_operacion: Optional[str] = None
    capacidad_produccion: Optional[str] = None
    capital_buscado: Optional[str] = None
    uso_fondos: Optional[str] = None
    ubicacion_maps: Optional[str] = None
    estado_contacto: str = "buscando"
    situacion: str = "minero_artesanal"
    estado_formalizacion: Optional[str] = None
    # Perfil de la operación (Ruta 1) / concesión (Ruta 2) — informativo
    estado_operacion: Optional[str] = None
    tipo_explotacion: Optional[str] = None
    material_comercializado: Optional[str] = None
    forma_comercializacion: Optional[str] = None
    tiempo_operacion: Optional[str] = None
    ley_promedio: Optional[str] = None
    ley_como_obtenida: Optional[str] = None
    # Especie mineralógica declarada por elemento (ej. "Cobre: Calcopirita,
    # Malaquita"), no solo el elemento económico — ver criterios_score.md.
    especie_mineral: Optional[str] = None
    num_trabajadores: Optional[str] = None
    maquinaria: Optional[str] = None
    tiene_resultados_laboratorio: Optional[str] = None
    modalidad_trabajadores: Optional[str] = None
    provincia: Optional[str] = None
    sustancias_toxicas: Optional[str] = None
    gestion_sustancias: Optional[str] = None
    incidentes_previos: Optional[str] = None
    permisos_comunitarios: Optional[str] = None
    acceso_logistico: Optional[str] = None
    experiencia_operador: Optional[str] = None
    capacitacion_operador: Optional[str] = None
    documentacion_disponible: Optional[str] = None
    plan_formalizacion: Optional[str] = None
    prioridad_crecimiento: Optional[str] = None
    concesion_vigente: Optional[str] = None
    tipo_deposito: Optional[str] = None
    etapa_proyecto: Optional[str] = None
    trabajos_exploracion_json: Optional[list[str]] = None
    info_geologica_disponible: Optional[str] = None
    tiene_estimaciones_leyes: Optional[str] = None
    pagos_vigencia_al_dia: Optional[str] = None
    toneladas_estimadas: Optional[str] = None
    ley_esperada: Optional[str] = None
    capital_disponible: Optional[str] = None
    estudio_previo: Optional[str] = None
    historial_operacion: Optional[str] = None
    pasivos_ambientales: Optional[str] = None
    experiencia_titular: Optional[str] = None
    background_titular: Optional[str] = None
    equipo_tecnico: Optional[str] = None
    tipo_socio_buscado: Optional[str] = None
    siguiente_hito: Optional[str] = None
    timeline_operacion: Optional[str] = None
    motivo_inicio: Optional[str] = None
    documento_autorizacion: Optional[str] = None
    tipo_apoyo_json: Optional[list[str]] = None
    tipo_apoyo: Optional[str] = None
    acceso_agua: Optional[str] = None
    acceso_energia: Optional[str] = None
    conflictividad_social: Optional[str] = None
    estructura_propiedad: Optional[str] = None
    moneda_capital: Optional[str] = None
    monto_requerido: Optional[str] = None
    plazo_capital: Optional[str] = None
    motivo_capital: Optional[str] = None
    produccion_objetivo: Optional[str] = None
    uso_fondos_diagnostico: Optional[str] = None
    # ver MineroPerfilOut — el minero ya pulsó "Guardar archivos"
    documentos_enviados: bool = False


class ActualizarEstadoContactoRequest(BaseModel):
    estado_contacto: str

    @field_validator("estado_contacto")
    @classmethod
    def validar_estado(cls, v: str) -> str:
        if v not in ("buscando", "contactado"):
            raise ValueError("estado_contacto debe ser 'buscando' o 'contactado'")
        return v


class ActualizarBrechasResueltasRequest(BaseModel):
    brechas_resueltas: list[str]


class OperacionSeguimientoOut(BaseModel):
    operacion_id: str
    score_total: int
    brechas: list[str]
    brechas_resueltas: list[str]
    brechas_pendientes: list[str]
    score_actual: int = 0
    bloqueado_actual: bool = False


class TopBrecha(BaseModel):
    estudio: str
    conteo: int


class UltimoLead(BaseModel):
    nombre: str
    region: str
    score_total: int
    created_at: datetime


class DashboardOut(BaseModel):
    diagnosticos_hoy: int
    diagnosticos_total: int
    leads_hoy: int
    leads_total: int
    score_promedio: float
    top_brechas: list[TopBrecha]
    ultimos_leads: list[UltimoLead]
    # Embudo: dónde se caen los usuarios (iniciado → completado → registrado)
    diagnosticos_iniciados: int = 0


TIPOS_EVENTO_VALIDOS = ("diagnostico_iniciado",)


class EventoCreate(BaseModel):
    tipo: str

    @field_validator("tipo")
    @classmethod
    def validar_tipo(cls, v: str) -> str:
        if v not in TIPOS_EVENTO_VALIDOS:
            raise ValueError(f"tipo debe ser uno de: {TIPOS_EVENTO_VALIDOS}")
        return v

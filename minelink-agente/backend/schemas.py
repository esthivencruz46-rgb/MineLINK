from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from scoring import ids_esperados_para

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
    respuestas: dict[str, bool]
    region: str
    mineral: str
    tipo_mina: Literal["subterranea", "tajo_abierto"]
    # Formulario dinámico: la situación decide qué preguntas aplican
    # (default = comportamiento original)
    situacion: Literal["minero_artesanal", "concesionario"] = "minero_artesanal"
    nombre_minero: Optional[str] = None
    codigo_reinfo: Optional[str] = None
    # Informativas de Operativo — nunca puntúan, texto libre o ausentes
    # ("prefiero no decirlo" = None/omitido)
    produccion_mensual: Optional[str] = None
    maquinaria: Optional[str] = None
    num_trabajadores: Optional[str] = None

    @model_validator(mode="after")
    def validar_ids_segun_tipo_mina(self) -> "DiagnosticoRequest":
        esperados = ids_esperados_para(self.tipo_mina, self.situacion)
        if set(self.respuestas.keys()) != esperados:
            raise ValueError(
                f"Para tipo_mina={self.tipo_mina} y situacion={self.situacion} "
                f"deben venir exactamente estos ids: {sorted(esperados)}"
            )
        return self


class DimensionOut(BaseModel):
    puntaje: int
    maximo: int


class DiagnosticoResponse(BaseModel):
    id: str
    score_total: int
    dimensiones: dict[str, DimensionOut]
    bloqueado: bool
    brechas: list[str]


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
    username: str
    password: str
    pregunta_seguridad: str
    respuesta_seguridad: str
    email: Optional[str] = None
    nombre_operacion: Optional[str] = None
    codigo_reinfo: Optional[str] = None

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


class MineroPerfilOut(BaseModel):
    nombre: str
    whatsapp: str
    email: Optional[str] = None
    nombre_operacion: Optional[str] = None
    region: str
    mineral: str
    tipo_mina: str
    codigo_reinfo: Optional[str] = None
    created_at: datetime
    # Declaración original del diagnóstico
    score_total: int
    bloqueado: bool
    brechas: list[str]
    # Seguimiento del admin (progreso desde el diagnóstico original)
    brechas_resueltas: list[str]
    brechas_pendientes: list[str]
    score_actual: int
    bloqueado_actual: bool
    # Perfil de inversión (opcional, ver PerfilInversionUpdate)
    descripcion_operacion: Optional[str] = None
    capacidad_produccion: Optional[str] = None
    capital_buscado: Optional[str] = None
    uso_fondos: Optional[str] = None
    ubicacion_maps: Optional[str] = None
    # "buscando" → "contactado": estado del acompañamiento de MineLink
    estado_contacto: str = "buscando"


class ProyectoPublicoOut(BaseModel):
    """Vista pública de un proyecto registrado, para la sección
    "Proyectos" del inicio. NUNCA incluye nombre real, WhatsApp ni email
    — esos datos de contacto son solo para el panel admin."""

    operacion_id: str
    nombre_proyecto: str
    region: str
    mineral: str
    tipo_mina: str
    score_actual: int
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


class ProyectoDetalleOut(ProyectoPublicoOut):
    """Detalle público de un proyecto (al hacer clic desde /proyectos).
    Además del resumen, incluye las fotos de la mina y un check de qué
    documentos legales presentó — NUNCA el archivo en sí (pueden tener
    nombre completo/DNI del minero), solo si lo presentó o no."""

    fotos: list[FotoPublicaOut] = []
    documentos_presentados: dict[str, bool] = {}
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
    score_actual: int
    bloqueado_actual: bool
    # Perfil de inversión que el minero llenó desde /mi-cuenta (opcional)
    descripcion_operacion: Optional[str] = None
    capacidad_produccion: Optional[str] = None
    capital_buscado: Optional[str] = None
    uso_fondos: Optional[str] = None
    ubicacion_maps: Optional[str] = None
    estado_contacto: str = "buscando"


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
    score_actual: int
    bloqueado_actual: bool


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

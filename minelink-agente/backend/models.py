import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship

from database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Operacion(Base):
    __tablename__ = "operaciones"

    id = Column(String, primary_key=True, default=_uuid)
    nombre_minero = Column(String, nullable=True)
    codigo_reinfo = Column(String, nullable=True)
    region = Column(String, nullable=False, index=True)
    mineral = Column(String, nullable=False, index=True)
    tipo_mina = Column(String, nullable=False, default="subterranea")  # "subterranea" | "tajo_abierto"
    score_total = Column(Integer, nullable=False)
    bloqueado = Column(Boolean, nullable=False, default=False, index=True)
    respuestas_json = Column(JSON, nullable=False)
    brechas_json = Column(JSON, nullable=False)
    # Seguimiento del admin: brechas que Esthiven marcó como resueltas
    # DESPUÉS del diagnóstico (ej. se enteró por WhatsApp). NUNCA modifica
    # respuestas_json/brechas_json/score_total, que son la declaración
    # original del minero — esto es una capa aparte de seguimiento.
    brechas_resueltas_json = Column(JSON, nullable=False, default=list)
    # Informativas de Operativo, nunca puntúan (ver criterios_score.md)
    produccion_mensual = Column(String, nullable=True)
    maquinaria = Column(String, nullable=True)
    num_trabajadores = Column(String, nullable=True)
    created_at = Column(DateTime, default=_now)

    leads = relationship("Lead", back_populates="operacion")
    documentos = relationship("DocumentoOperacion", back_populates="operacion")


class Empresa(Base):
    __tablename__ = "empresas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tipo = Column(String, nullable=False, default="empresa")  # "empresa" | "consultor"
    nombre = Column(String, nullable=False)
    ruc = Column(String(11), nullable=True, unique=True)
    colegiatura = Column(String, nullable=True, unique=True)  # solo consultores independientes; CIP único
    cv_filename = Column(String, nullable=True)  # PDF del CV, solo consultores
    anios_servicio = Column(Integer, nullable=False)
    regiones_json = Column(JSON, nullable=False)
    estudios_json = Column(JSON, nullable=False)
    whatsapp = Column(String, nullable=False)
    email = Column(String, nullable=True)
    activa = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=_now)


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, autoincrement=True)
    operacion_id = Column(String, ForeignKey("operaciones.id"), nullable=False, index=True)
    nombre = Column(String, nullable=False)
    whatsapp = Column(String, nullable=False, unique=True)
    email = Column(String, nullable=True)
    nombre_operacion = Column(String, nullable=True)
    region = Column(String, nullable=False)
    codigo_reinfo = Column(String, nullable=True, unique=True)
    # Cuenta del minero: elegida al registrarse, para volver a ver sus
    # datos sin repetir el cuestionario. Nullable por leads viejos
    # creados antes de que esto existiera.
    username = Column(String, nullable=True, unique=True)
    password_hash = Column(String, nullable=True)
    # Perfil de inversión: preparación para la futura ventana de
    # inversionistas (esa lógica de match/publicación todavía NO existe).
    # Todo opcional, el minero lo completa cuando quiera desde /mi-cuenta.
    descripcion_operacion = Column(String, nullable=True)
    capacidad_produccion = Column(String, nullable=True)
    capital_buscado = Column(String, nullable=True)
    uso_fondos = Column(String, nullable=True)
    # Enlace de Google Maps con la ubicación de la operación — se muestra
    # públicamente en la ficha del proyecto (/proyectos/{id}).
    ubicacion_maps = Column(String, nullable=True)
    # Estado del acompañamiento: "buscando" (default) → "contactado"
    # (el admin ya le escribió por WhatsApp). Visible para el minero
    # en /mi-cuenta para cerrar el ciclo de su registro.
    estado_contacto = Column(String, nullable=False, default="buscando", server_default="buscando")
    created_at = Column(DateTime, default=_now)

    operacion = relationship("Operacion", back_populates="leads")


class DocumentoOperacion(Base):
    """Archivos que el minero sube desde /mi-cuenta (fotos de la mina,
    informe de leyes, catastro, RUC, contrato de explotación, título de
    concesión). Preparación para un futuro nivel de "conectar con
    inversiones" — esa lógica de match todavía NO existe."""

    __tablename__ = "documentos_operacion"

    id = Column(Integer, primary_key=True, autoincrement=True)
    operacion_id = Column(String, ForeignKey("operaciones.id"), nullable=False, index=True)
    categoria = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    nombre_original = Column(String, nullable=False)
    content_type = Column(String, nullable=False)
    created_at = Column(DateTime, default=_now)

    operacion = relationship("Operacion", back_populates="documentos")


class InteresInversion(Base):
    """Un inversionista que dejó sus datos desde la página pública de un
    proyecto (/proyectos/{id}). NUNCA se le muestra el WhatsApp/email del
    minero — Esthiven ve este interés en el panel admin y hace de
    intermediario manualmente, igual que con leads de empresas.

    También es la cuenta del inversionista (mismo patrón que Lead para el
    minero): username/password para volver a entrar a /mi-cuenta-inversionista,
    que por ahora es una ventana vacía (sin match ni contacto directo)."""

    __tablename__ = "intereses_inversion"

    id = Column(Integer, primary_key=True, autoincrement=True)
    operacion_id = Column(String, ForeignKey("operaciones.id"), nullable=False, index=True)
    nombre = Column(String, nullable=False)
    email = Column(String, nullable=True)
    telefono = Column(String, nullable=True)
    motivo_inversion = Column(String, nullable=True)
    monto = Column(String, nullable=True)
    informacion_requerida = Column(String, nullable=True)
    mensaje = Column(String, nullable=True)
    username = Column(String, nullable=True, unique=True)
    password_hash = Column(String, nullable=True)
    created_at = Column(DateTime, default=_now)


class Evento(Base):
    """Eventos simples de uso para métricas del embudo (cuántos empiezan
    el diagnóstico vs. cuántos lo terminan vs. cuántos se registran).
    Sin datos personales: solo el tipo de evento y cuándo ocurrió."""

    __tablename__ = "eventos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tipo = Column(String, nullable=False, index=True)
    created_at = Column(DateTime, default=_now)

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String
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
    # Verificación MANUAL del código REINFO por Esthiven (julio 2026): el
    # cotejo automático contra el padrón del MINEM quedó desactivado (ver
    # reinfo.py — el scraper con `requests` da falsos "no_encontrado").
    # Esthiven confirma el código a mano (código único o RUC) desde el
    # admin; reinfo_verificado_en queda null mientras no se confirme, y se
    # limpia si el admin desmarca la verificación.
    reinfo_verificado_manual = Column(Boolean, nullable=False, default=False)
    reinfo_verificado_en = Column(DateTime, nullable=True)
    region = Column(String, nullable=False, index=True)
    mineral = Column(String, nullable=False, index=True)
    tipo_mina = Column(String, nullable=False, default="subterranea")  # "subterranea" | "tajo_abierto"
    # Situación del usuario (formulario dinámico, ver scoring.SITUACIONES):
    # minero_artesanal | concesionario
    situacion = Column(
        String, nullable=False, default="minero_artesanal", server_default="minero_artesanal"
    )
    # Estado en el pipeline real de formalización (pregunta de apertura del
    # diagnóstico, ver scoring.ESTADOS_FORMALIZACION): sin_tramite |
    # reinfo_en_tramite | reinfo_vigente | en_formalizacion | formal.
    # NULL = diagnóstico anterior a la reestructura de julio 2026.
    estado_formalizacion = Column(String, nullable=True, index=True)
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

    # Perfil de la operación (Ruta 1 — minero_artesanal): informativo,
    # nunca puntúa. Se recoge ANTES de las preguntas Sí/No de formalización.
    estado_operacion = Column(String, nullable=True)  # activa | no_activa | temporal
    tipo_explotacion = Column(String, nullable=True)  # subterranea|tajo_abierto|aluvial|mixta|otro (deriva tipo_mina)
    material_comercializado = Column(String, nullable=True)
    forma_comercializacion = Column(String, nullable=True)
    tiempo_operacion = Column(String, nullable=True)
    ley_promedio = Column(String, nullable=True)  # valor+unidad combinados, ej. "2.5 g/t"
    ley_como_obtenida = Column(String, nullable=True)
    # Especie mineralógica por elemento, ej. "Cobre: Calcopirita, Malaquita"
    # — no solo el elemento económico (oro/cobre/etc.), que ya vive en `mineral`.
    especie_mineral = Column(String, nullable=True)
    # Antes Boolean (Sí/No); ahora String de 3 opciones ("No" / "Sí, algunos"
    # / "Sí, completos") — bloque "Fase 1: preguntas del diagnóstico".
    tiene_resultados_laboratorio = Column(String, nullable=True)
    modalidad_trabajadores = Column(String, nullable=True)  # planilla | destajo | combinado
    provincia = Column(String, nullable=True)
    sustancias_toxicas = Column(String, nullable=True)  # no|mercurio|cianuro|relaves|multiples — también decide si A4 aplica
    gestion_sustancias = Column(String, nullable=True)  # condicional, prellena A4
    incidentes_previos = Column(String, nullable=True)
    permisos_comunitarios = Column(String, nullable=True)
    acceso_logistico = Column(String, nullable=True)
    experiencia_operador = Column(String, nullable=True)
    capacitacion_operador = Column(String, nullable=True)
    documentacion_disponible = Column(String, nullable=True)  # prellena T7 (Ruta 1)
    plan_formalizacion = Column(String, nullable=True)
    prioridad_crecimiento = Column(String, nullable=True)

    # Perfil de la concesión (Ruta 2 — concesionario): informativo, nunca puntúa.
    # Antes Boolean; ahora String (ver nota de tiene_resultados_laboratorio).
    concesion_vigente = Column(String, nullable=True)  # también prellena L6
    tipo_deposito = Column(String, nullable=True)
    etapa_proyecto = Column(String, nullable=True)
    trabajos_exploracion_json = Column(JSON, nullable=True)  # lista: muestreo/calicatas/etc.
    info_geologica_disponible = Column(String, nullable=True)
    tiene_estimaciones_leyes = Column(String, nullable=True)
    pagos_vigencia_al_dia = Column(String, nullable=True)
    toneladas_estimadas = Column(String, nullable=True)
    ley_esperada = Column(String, nullable=True)
    capital_disponible = Column(String, nullable=True)
    estudio_previo = Column(String, nullable=True)  # prellena T7 (Ruta 2)
    historial_operacion = Column(String, nullable=True)
    pasivos_ambientales = Column(String, nullable=True)  # prellena A1 (Ruta 2)
    experiencia_titular = Column(String, nullable=True)
    background_titular = Column(String, nullable=True)
    equipo_tecnico = Column(String, nullable=True)
    tipo_socio_buscado = Column(String, nullable=True)
    siguiente_hito = Column(String, nullable=True)
    timeline_operacion = Column(String, nullable=True)
    motivo_inicio = Column(String, nullable=True)

    # Compartidos por ambas rutas
    documento_autorizacion = Column(String, nullable=True)  # cuando titular=No
    tipo_apoyo_json = Column(JSON, nullable=True)  # histórico, ya no se escribe (ver tipo_apoyo)
    tipo_apoyo = Column(String, nullable=True)  # opción única, reemplaza tipo_apoyo_json
    acceso_agua = Column(String, nullable=True)
    acceso_energia = Column(String, nullable=True)
    conflictividad_social = Column(String, nullable=True)  # prellena R1 (Ruta 2)
    estructura_propiedad = Column(String, nullable=True)
    # "soles" | "dolares" | "no_se" — fija la moneda del bucket de abajo y
    # bloquea el selector de moneda en /mi-cuenta (PerfilInversionForm) para
    # que no declare en una moneda y luego pida en otra.
    moneda_capital = Column(String, nullable=True)
    monto_requerido = Column(String, nullable=True)  # bucket, copiado a Lead.capital_buscado al registrarse
    plazo_capital = Column(String, nullable=True)
    motivo_capital = Column(String, nullable=True)
    produccion_objetivo = Column(String, nullable=True)
    uso_fondos_diagnostico = Column(String, nullable=True)  # copiado a Lead.uso_fondos al registrarse

    # documentos_enviados_en: el minero pulsó "Guardar archivos" en "Respalda
    # tu declaración" (null = todavía subiendo). Junto con inv_enviado_en más
    # abajo, decide si la operación es "apto_inversionistas" (ver
    # scoring.estado_seguimiento) — la publicación en la cartera pública es
    # automática al enviar, sin aprobación manual (julio 2026: se decidió que
    # son los propios inversionistas quienes verifican los datos, no Esthiven).
    # visto_bueno_documentos queda SIN USO (ver_bueno manual retirado) — no se
    # borra la columna para no migrar de nuevo; siempre False de aquí en más.
    documentos_enviados_en = Column(DateTime, nullable=True)
    visto_bueno_documentos = Column(Boolean, nullable=False, default=False)

    # Módulo INV — perfil de inversión (julio 2026), ver catalogo_inversion.py.
    # No exige documentos_enviados_en primero — el minero puede llenarlo en
    # la misma sesión que sube sus documentos de formalización, sin esperar
    # entre uno y otro (ver enviar_inversion en routers/mineros.py). Reenviar
    # SOBREESCRIBE (permite corregir sin crear versiones). inv_visto_bueno
    # queda SIN USO por la misma razón que visto_bueno_documentos, arriba.
    inv_respuestas_json = Column(JSON, nullable=True)
    inv_enviado_en = Column(DateTime, nullable=True)
    inv_visto_bueno = Column(Boolean, nullable=False, default=False)

    # Fechas/datos que el minero declara junto a los slots de "Respalda tu
    # declaración" (julio 2026): dict categoria→valor, ej.
    # {"autorizacion_drem": "2024-03-15", "vigencia_concesion": "2026-01-10"}.
    # Actualización parcial por clave desde PUT /mineros/perfil-inversion.
    # ⚠️ Requiere correr seeds/migrar_datos_formalizacion.py contra Supabase.
    datos_formalizacion_json = Column(JSON, nullable=True)

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
    # Calificación del profesional (0-5, ej. 4.7) y cuántas reseñas la
    # respaldan. Viene de la base de datos externa de profesionales o la
    # asigna Esthiven al revisar el CV. Por ahora SOLO se ve en el admin
    # (no en la web pública); internamente ordena los listados.
    rating = Column(Float, nullable=True)
    num_resenas = Column(Integer, nullable=True)
    # Datos de contexto de la base externa de profesionales (julio 2026,
    # pedido de Esthiven): vienen del CSV de scraping (Google Maps) y le
    # sirven al admin para evaluar/contactar antes de activar la empresa.
    # `telefono` es la línea tal cual vino (puede ser fija) — distinta de
    # `whatsapp`, que exige formato +51 y es el canal real de contacto.
    web = Column(String, nullable=True)
    telefono = Column(String, nullable=True)
    direccion = Column(String, nullable=True)
    categoria = Column(String, nullable=True)
    keyword = Column(String, nullable=True)
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
    # Coordenadas "lat,lng" resueltas del enlace (para el mapa incrustado);
    # se calculan al guardar el perfil (geoubicacion.py), no en cada visita.
    ubicacion_coords = Column(String, nullable=True)
    # Estado del acompañamiento: "buscando" (default) → "contactado"
    # (el admin ya le escribió por WhatsApp). Visible para el minero
    # en /mi-cuenta para cerrar el ciclo de su registro.
    estado_contacto = Column(String, nullable=False, default="buscando", server_default="buscando")
    # Recuperación de contraseña autoservicio: el minero elige su propia
    # pregunta (texto libre) al registrarse. La respuesta se guarda
    # hasheada (igual que la contraseña), nunca en texto plano. Nullable
    # porque los leads creados antes de esta función no la tienen — para
    # esos, sigue existiendo el reseteo manual del admin como respaldo.
    pregunta_seguridad = Column(String, nullable=True)
    respuesta_seguridad_hash = Column(String, nullable=True)
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
    # Revisión del admin (julio 2026): "pendiente" | "aprobado" | "rechazado".
    # motivo_rechazo solo tiene sentido cuando estado_revision == "rechazado".
    estado_revision = Column(String, nullable=False, default="pendiente")
    motivo_rechazo = Column(String, nullable=True)
    revisado_en = Column(DateTime, nullable=True)
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
    # Recuperación de contraseña autoservicio (mismo patrón que Lead)
    pregunta_seguridad = Column(String, nullable=True)
    respuesta_seguridad_hash = Column(String, nullable=True)
    # Seguimiento para el inversionista (julio 2026): "recibido" →
    # "en_intermediacion" → "contactado". Lo avanza Esthiven desde el
    # admin; el inversionista lo ve como línea de tiempo en su cuenta —
    # antes dejaba su interés y no sabía nunca si alguien lo había visto.
    estado_contacto = Column(
        String, nullable=False, default="recibido", server_default="recibido"
    )
    created_at = Column(DateTime, default=_now)


class InteresEmpresa(Base):
    """El minero deja su interés en que UNA empresa/consultor específico lo
    contacte, en vez de escribirle directo por WhatsApp (eso lo sacaba del
    sitio, sin que Esthiven se enterara). Esthiven ve este interés en el
    panel admin (junto al lead) y es quien escribe a la empresa desde su
    propio WhatsApp, dándole el contacto del minero — mismo patrón de
    intermediación que InteresInversion."""

    __tablename__ = "intereses_empresa"

    id = Column(Integer, primary_key=True, autoincrement=True)
    operacion_id = Column(String, ForeignKey("operaciones.id"), nullable=False, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"), nullable=False, index=True)
    nombre = Column(String, nullable=False)
    whatsapp = Column(String, nullable=False)
    # Estudio/brecha puntual que motivó el interés (opcional: puede venir
    # de "me interesa" general sin brecha específica marcada)
    brecha = Column(String, nullable=True)
    mensaje = Column(String, nullable=True)
    # Igual que Lead.estado_contacto: "buscando" → "contactado" cuando
    # Esthiven ya le escribió a la empresa.
    estado_contacto = Column(String, nullable=False, default="buscando", server_default="buscando")
    created_at = Column(DateTime, default=_now)


class Notificacion(Base):
    """Aviso para el minero cuando el admin resuelve algo sobre su cuenta
    (documento rechazado con motivo, documentos/inversión aprobados) — ver
    NotificacionesBell.tsx. En pausa el envío real por push (Firebase);
    esto es un panel dentro de la app que el minero revisa al entrar."""

    __tablename__ = "notificaciones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False, index=True)
    tipo = Column(String, nullable=False)
    mensaje = Column(String, nullable=False)
    leida = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=_now)


class Evento(Base):
    """Eventos simples de uso para métricas del embudo (cuántos empiezan
    el diagnóstico vs. cuántos lo terminan vs. cuántos se registran).
    Sin datos personales: solo el tipo de evento y cuándo ocurrió."""

    __tablename__ = "eventos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tipo = Column(String, nullable=False, index=True)
    created_at = Column(DateTime, default=_now)

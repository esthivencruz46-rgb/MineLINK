import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

import models
import schemas
import storage
from auth import create_minero_token, get_current_lead_id, hash_password, verify_password
from database import get_db
from geoubicacion import resolver_coordenadas
from imagenes import comprimir_si_es_imagen, convertir_pdf_a_imagen
from scoring import estado_seguimiento
from catalogo_diagnostico import BRECHA_POR_PREGUNTA, ids_esperados
from security import (
    contenido_coincide_con_tipo,
    intentos_recuperacion_restantes,
    limitar_intentos_login,
    limitar_intentos_recuperacion,
    registrar_intento_fallido_recuperacion,
    resetear_intentos_recuperacion,
)
from uploads_config import (
    CATEGORIAS_DOCUMENTO,
    CATEGORIAS_ESTUDIO,
    CATEGORIAS_FOTO_PERFIL,
    DOCUMENTO_TAMANO_MAXIMO_BYTES,
    FOTOS_MINA_MAXIMO,
    TIPOS_PDF_O_IMAGEN,
    categoria_equivalente,
    categorias_perfil_foto_aplicables,
)

router = APIRouter(prefix="/mineros", tags=["mineros"])


def _operacion_del_lead(db: Session, lead_id: int) -> tuple[models.Lead, models.Operacion]:
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if lead is None:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    operacion = (
        db.query(models.Operacion)
        .filter(models.Operacion.id == lead.operacion_id)
        .first()
    )
    if operacion is None:
        raise HTTPException(status_code=404, detail="Diagnóstico no encontrado")

    return lead, operacion


def _estudios_aplicables(operacion: models.Operacion) -> list[str]:
    """Estudios que el minero declaró SÍ tener (respondió Sí, o el admin
    marcó la brecha como resuelta después) — para que "Respalda tu
    declaración" solo le pida foto de lo que realmente tiene, no de todo
    el catálogo de su ruta. Pedirle que suba prueba de algo que ya dijo
    que NO tiene no tiene sentido y solo lo satura de archivos.

    Tampoco se listan los estudios que en la práctica piden la MISMA foto
    que ya se pide en "Documentos legales" u otro estudio (ver
    `uploads_config.categoria_equivalente`) — evita pedir la misma foto
    dos veces con nombres distintos."""
    situacion = operacion.situacion or "minero_artesanal"
    respuestas = operacion.respuestas_json or {}
    try:
        ids = ids_esperados(respuestas)
    except (ValueError, TypeError):
        # Diagnóstico del modelo anterior: sin catálogo con que cruzar.
        return []
    todos = {BRECHA_POR_PREGUNTA[i][1] for i in ids if i in BRECHA_POR_PREGUNTA}
    pendientes = set(estado_seguimiento(operacion)["brechas_pendientes"])
    return sorted(
        e for e in todos
        if e not in pendientes and categoria_equivalente(e, situacion) is None
    )


def _es_titular_concesion(operacion: models.Operacion) -> bool | None:
    """True si es titular de su concesión, False si trabaja en concesión
    ajena, None si no se puede determinar (perfiles A/B, que todavía no
    fijan titularidad; filas del modelo viejo). Perfil C pregunta la
    titularidad aparte (C1_3, porque ahí M0_1 ya no distingue propia/
    contrato, solo si opera o no); Perfil D siempre es M0_1=concesion_propia
    (no tiene C1_3) así que se deriva directo de ahí."""
    respuestas = operacion.respuestas_json or {}
    if not isinstance(respuestas, dict):
        return None
    c1_3 = respuestas.get("C1_3")
    if c1_3 == "titular":
        return True
    if c1_3 == "contrato":
        return False
    if respuestas.get("M0_1") == "concesion_propia":
        return True
    return None


def _perfil_out(lead: models.Lead, operacion: models.Operacion) -> schemas.MineroPerfilOut:
    return schemas.MineroPerfilOut(
        nombre=lead.nombre,
        whatsapp=lead.whatsapp,
        email=lead.email,
        nombre_operacion=lead.nombre_operacion,
        region=operacion.region,
        mineral=operacion.mineral,
        tipo_mina=operacion.tipo_mina,
        codigo_reinfo=lead.codigo_reinfo,
        created_at=lead.created_at,
        situacion=operacion.situacion or "minero_artesanal",
        estado_formalizacion=operacion.estado_formalizacion,
        score_total=operacion.score_total,
        bloqueado=operacion.bloqueado,
        brechas=operacion.brechas_json,
        descripcion_operacion=lead.descripcion_operacion,
        capacidad_produccion=lead.capacidad_produccion,
        capital_buscado=lead.capital_buscado,
        uso_fondos=lead.uso_fondos,
        ubicacion_maps=lead.ubicacion_maps,
        estado_contacto=lead.estado_contacto or "buscando",
        estado_operacion=operacion.estado_operacion,
        tipo_explotacion=operacion.tipo_explotacion,
        material_comercializado=operacion.material_comercializado,
        forma_comercializacion=operacion.forma_comercializacion,
        tiempo_operacion=operacion.tiempo_operacion,
        ley_promedio=operacion.ley_promedio,
        ley_como_obtenida=operacion.ley_como_obtenida,
        especie_mineral=operacion.especie_mineral,
        tiene_resultados_laboratorio=operacion.tiene_resultados_laboratorio,
        modalidad_trabajadores=operacion.modalidad_trabajadores,
        provincia=operacion.provincia,
        sustancias_toxicas=operacion.sustancias_toxicas,
        gestion_sustancias=operacion.gestion_sustancias,
        incidentes_previos=operacion.incidentes_previos,
        permisos_comunitarios=operacion.permisos_comunitarios,
        acceso_logistico=operacion.acceso_logistico,
        experiencia_operador=operacion.experiencia_operador,
        capacitacion_operador=operacion.capacitacion_operador,
        documentacion_disponible=operacion.documentacion_disponible,
        plan_formalizacion=operacion.plan_formalizacion,
        prioridad_crecimiento=operacion.prioridad_crecimiento,
        concesion_vigente=operacion.concesion_vigente,
        tipo_deposito=operacion.tipo_deposito,
        etapa_proyecto=operacion.etapa_proyecto,
        trabajos_exploracion_json=operacion.trabajos_exploracion_json,
        info_geologica_disponible=operacion.info_geologica_disponible,
        tiene_estimaciones_leyes=operacion.tiene_estimaciones_leyes,
        pagos_vigencia_al_dia=operacion.pagos_vigencia_al_dia,
        toneladas_estimadas=operacion.toneladas_estimadas,
        ley_esperada=operacion.ley_esperada,
        capital_disponible=operacion.capital_disponible,
        estudio_previo=operacion.estudio_previo,
        historial_operacion=operacion.historial_operacion,
        pasivos_ambientales=operacion.pasivos_ambientales,
        experiencia_titular=operacion.experiencia_titular,
        background_titular=operacion.background_titular,
        equipo_tecnico=operacion.equipo_tecnico,
        tipo_socio_buscado=operacion.tipo_socio_buscado,
        siguiente_hito=operacion.siguiente_hito,
        timeline_operacion=operacion.timeline_operacion,
        motivo_inicio=operacion.motivo_inicio,
        documento_autorizacion=operacion.documento_autorizacion,
        tipo_apoyo_json=operacion.tipo_apoyo_json,
        tipo_apoyo=operacion.tipo_apoyo,
        acceso_agua=operacion.acceso_agua,
        acceso_energia=operacion.acceso_energia,
        conflictividad_social=operacion.conflictividad_social,
        estructura_propiedad=operacion.estructura_propiedad,
        moneda_capital=operacion.moneda_capital,
        monto_requerido=operacion.monto_requerido,
        plazo_capital=operacion.plazo_capital,
        motivo_capital=operacion.motivo_capital,
        produccion_objetivo=operacion.produccion_objetivo,
        uso_fondos_diagnostico=operacion.uso_fondos_diagnostico,
        estudios_aplicables=_estudios_aplicables(operacion),
        fotos_perfil=[
            schemas.CategoriaFotoOut(categoria=c, etiqueta=e)
            for c, e in categorias_perfil_foto_aplicables(operacion)
        ],
        es_titular_concesion=_es_titular_concesion(operacion),
        **estado_seguimiento(operacion),
    )


@router.post("/login", response_model=schemas.Token)
def login(
    payload: schemas.MineroLogin,
    db: Session = Depends(get_db),
    _: None = Depends(limitar_intentos_login),
):
    lead = (
        db.query(models.Lead)
        .filter(models.Lead.username == payload.username.strip().lower())
        .first()
    )
    if lead is None or lead.password_hash is None or not verify_password(
        payload.password, lead.password_hash
    ):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    return schemas.Token(access_token=create_minero_token(lead.id))


@router.get("/pregunta-seguridad/{username}", response_model=schemas.PreguntaSeguridadOut)
def obtener_pregunta_seguridad(
    username: str,
    db: Session = Depends(get_db),
    _: None = Depends(limitar_intentos_login),
):
    lead = (
        db.query(models.Lead)
        .filter(models.Lead.username == username.strip().lower())
        .first()
    )
    if lead is None or not lead.pregunta_seguridad:
        raise HTTPException(
            status_code=404,
            detail=(
                "No encontramos una pregunta de seguridad para ese usuario. "
                "Escríbenos por WhatsApp para restablecer tu contraseña."
            ),
        )
    return schemas.PreguntaSeguridadOut(pregunta=lead.pregunta_seguridad)


@router.post("/recuperar-password", response_model=schemas.Token)
def recuperar_password(
    payload: schemas.RecuperarPasswordRequest,
    db: Session = Depends(get_db),
    _: None = Depends(limitar_intentos_login),
):
    lead = (
        db.query(models.Lead)
        .filter(models.Lead.username == payload.username.strip().lower())
        .first()
    )
    if lead is None or not lead.respuesta_seguridad_hash:
        raise HTTPException(status_code=404, detail="No pudimos procesar tu solicitud.")

    clave = f"minero:{lead.id}"
    limitar_intentos_recuperacion(clave)

    if not verify_password(payload.respuesta_seguridad, lead.respuesta_seguridad_hash):
        registrar_intento_fallido_recuperacion(clave)
        restantes = intentos_recuperacion_restantes(clave)
        if restantes == 0:
            raise HTTPException(
                status_code=429,
                detail=(
                    "Respuesta incorrecta. Superaste los 4 intentos permitidos. "
                    "Escríbenos por WhatsApp para restablecer tu contraseña."
                ),
            )
        raise HTTPException(
            status_code=400,
            detail=f"Respuesta incorrecta. Te queda{'n' if restantes != 1 else ''} {restantes} intento{'s' if restantes != 1 else ''}.",
        )

    resetear_intentos_recuperacion(clave)
    lead.password_hash = hash_password(payload.nueva_password)
    db.commit()
    return schemas.Token(access_token=create_minero_token(lead.id))


@router.get("/me", response_model=schemas.MineroPerfilOut)
def perfil(db: Session = Depends(get_db), lead_id: int = Depends(get_current_lead_id)):
    lead, operacion = _operacion_del_lead(db, lead_id)
    return _perfil_out(lead, operacion)


@router.put("/perfil-inversion", response_model=schemas.MineroPerfilOut)
def actualizar_perfil_inversion(
    payload: schemas.PerfilInversionUpdate,
    db: Session = Depends(get_db),
    lead_id: int = Depends(get_current_lead_id),
):
    """Guarda las respuestas del minero para su futuro perfil de
    inversionistas (todas opcionales, se pueden dejar en blanco y
    completar después). Todavía NO existe la ventana de inversionistas
    ni ninguna lógica de match; esto solo guarda los datos."""
    lead, operacion = _operacion_del_lead(db, lead_id)

    lead.descripcion_operacion = payload.descripcion_operacion
    lead.capacidad_produccion = payload.capacidad_produccion
    lead.capital_buscado = payload.capital_buscado
    lead.uso_fondos = payload.uso_fondos
    if payload.ubicacion_maps != lead.ubicacion_maps:
        lead.ubicacion_maps = payload.ubicacion_maps
        # Coordenadas para el mapa incrustado de la ficha pública;
        # best-effort: si no se resuelven, solo se muestra el botón de Maps.
        lead.ubicacion_coords = resolver_coordenadas(payload.ubicacion_maps)
    db.commit()
    db.refresh(lead)

    return _perfil_out(lead, operacion)


@router.get("/documentos", response_model=list[schemas.DocumentoOperacionOut])
def listar_documentos(
    db: Session = Depends(get_db), lead_id: int = Depends(get_current_lead_id)
):
    _lead, operacion = _operacion_del_lead(db, lead_id)
    return (
        db.query(models.DocumentoOperacion)
        .filter(models.DocumentoOperacion.operacion_id == operacion.id)
        .order_by(models.DocumentoOperacion.created_at.desc())
        .all()
    )


@router.post(
    "/documentos", response_model=schemas.DocumentoOperacionOut, status_code=201
)
async def subir_documento(
    categoria: str = Form(...),
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    lead_id: int = Depends(get_current_lead_id),
):
    """Sube un archivo del minero: foto de la mina, informe de leyes,
    catastro, RUC, contrato de explotación, título de concesión, o una foto
    de respaldo para cualquier estudio/trámite del catálogo (ver
    uploads_config.CATEGORIAS_ESTUDIO) — esto último para que las
    respuestas Sí/No del diagnóstico no queden solo en la palabra del
    minero. Preparación para un futuro nivel de inversión — esa lógica de
    match NO existe todavía, esto solo guarda el archivo."""
    _lead, operacion = _operacion_del_lead(db, lead_id)

    if categoria in CATEGORIAS_DOCUMENTO:
        tipos_aceptados, _etiqueta = CATEGORIAS_DOCUMENTO[categoria]
    elif categoria in CATEGORIAS_ESTUDIO:
        tipos_aceptados = TIPOS_PDF_O_IMAGEN
    elif categoria in CATEGORIAS_FOTO_PERFIL:
        tipos_aceptados, _etiqueta = CATEGORIAS_FOTO_PERFIL[categoria]
    else:
        raise HTTPException(
            422,
            "Categoría inválida. Debe ser una de: "
            f"{sorted(set(CATEGORIAS_DOCUMENTO) | CATEGORIAS_ESTUDIO | set(CATEGORIAS_FOTO_PERFIL))}",
        )

    if archivo.content_type not in tipos_aceptados:
        raise HTTPException(
            422, f"Para '{categoria}' el archivo debe ser: {', '.join(tipos_aceptados)}"
        )

    # La autorización DREM/GREM solo tiene sentido para quien declaró ser
    # formal — es el respaldo de la insignia "Formal" en la vitrina.
    # La autorización DREM/GREM es el respaldo del perfil D (formal pleno).
    if categoria == "autorizacion_drem" and operacion.estado_formalizacion != "D":
        raise HTTPException(
            422,
            "La autorización DREM/GREM solo aplica si declaraste que ya eres "
            "formal en tu diagnóstico.",
        )

    if categoria == "fotos_mina":
        fotos_actuales = (
            db.query(models.DocumentoOperacion)
            .filter(
                models.DocumentoOperacion.operacion_id == operacion.id,
                models.DocumentoOperacion.categoria == "fotos_mina",
            )
            .count()
        )
        if fotos_actuales >= FOTOS_MINA_MAXIMO:
            raise HTTPException(
                422,
                f"Ya tienes {FOTOS_MINA_MAXIMO} fotos (el máximo). "
                "Elimina alguna para subir una nueva.",
            )

    contenido = await archivo.read()
    if len(contenido) > DOCUMENTO_TAMANO_MAXIMO_BYTES:
        raise HTTPException(422, "El archivo no debe superar 10MB")
    if len(contenido) == 0:
        raise HTTPException(422, "El archivo está vacío")
    if not contenido_coincide_con_tipo(contenido, archivo.content_type or ""):
        raise HTTPException(
            422, "El contenido del archivo no coincide con su tipo declarado"
        )

    tipo_declarado = archivo.content_type or ""
    # En "Documentación" todo se muestra como foto: si suben un PDF,
    # convertimos la primera hoja a imagen aquí mismo y guardamos SOLO esa
    # imagen (nunca el PDF crudo).
    if tipo_declarado == "application/pdf":
        convertido = convertir_pdf_a_imagen(contenido)
        if convertido is None:
            raise HTTPException(
                422,
                "No pudimos leer ese PDF. Sube una foto del documento en su lugar.",
            )
        contenido = convertido
        tipo_declarado = "image/jpeg"

    # Las fotos se comprimen para cuidar el almacenamiento (1 GB gratis)
    contenido, tipo_final, extension_forzada = comprimir_si_es_imagen(
        contenido, tipo_declarado
    )
    extension = extension_forzada or (
        (archivo.filename or "").rsplit(".", 1)[-1].lower() if "." in (archivo.filename or "") else "bin"
    )
    nombre_archivo = f"{uuid.uuid4()}.{extension}"
    storage.guardar("documentos_mineros", nombre_archivo, contenido, tipo_final)

    documento = models.DocumentoOperacion(
        operacion_id=operacion.id,
        categoria=categoria,
        filename=nombre_archivo,
        nombre_original=archivo.filename or nombre_archivo,
        content_type=tipo_final,
    )
    db.add(documento)
    db.commit()
    db.refresh(documento)
    return documento


@router.delete("/documentos/{documento_id}", status_code=204)
def eliminar_documento(
    documento_id: int,
    db: Session = Depends(get_db),
    lead_id: int = Depends(get_current_lead_id),
):
    _lead, operacion = _operacion_del_lead(db, lead_id)
    documento = (
        db.query(models.DocumentoOperacion)
        .filter(
            models.DocumentoOperacion.id == documento_id,
            models.DocumentoOperacion.operacion_id == operacion.id,
        )
        .first()
    )
    if documento is None:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    storage.eliminar("documentos_mineros", documento.filename)
    db.delete(documento)
    db.commit()


@router.get("/documentos/{documento_id}/archivo")
def ver_documento(
    documento_id: int,
    db: Session = Depends(get_db),
    lead_id: int = Depends(get_current_lead_id),
):
    _lead, operacion = _operacion_del_lead(db, lead_id)
    documento = (
        db.query(models.DocumentoOperacion)
        .filter(
            models.DocumentoOperacion.id == documento_id,
            models.DocumentoOperacion.operacion_id == operacion.id,
        )
        .first()
    )
    if documento is None:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    contenido = storage.leer("documentos_mineros", documento.filename)
    if contenido is None:
        raise HTTPException(status_code=404, detail="El archivo no se encuentra")

    return Response(
        content=contenido,
        media_type=documento.content_type,
        headers={
            "Content-Disposition": storage.content_disposition(
                "inline", documento.nombre_original
            )
        },
    )

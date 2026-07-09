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
    DOCUMENTO_TAMANO_MAXIMO_BYTES,
    FOTOS_MINA_MAXIMO,
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
        tiene_resultados_laboratorio=operacion.tiene_resultados_laboratorio,
        concesion_vigente=operacion.concesion_vigente,
        tipo_deposito=operacion.tipo_deposito,
        etapa_proyecto=operacion.etapa_proyecto,
        trabajos_exploracion_json=operacion.trabajos_exploracion_json,
        info_geologica_disponible=operacion.info_geologica_disponible,
        tiene_estimaciones_leyes=operacion.tiene_estimaciones_leyes,
        documento_autorizacion=operacion.documento_autorizacion,
        tipo_apoyo_json=operacion.tipo_apoyo_json,
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
    """Sube un archivo del minero (foto de la mina, informe de leyes,
    catastro, RUC, contrato de explotación o título de concesión).
    Preparación para un futuro nivel de inversión — esa lógica de match
    NO existe todavía, esto solo guarda el archivo."""
    _lead, operacion = _operacion_del_lead(db, lead_id)

    info_categoria = CATEGORIAS_DOCUMENTO.get(categoria)
    if info_categoria is None:
        raise HTTPException(
            422, f"Categoría inválida. Debe ser una de: {sorted(CATEGORIAS_DOCUMENTO)}"
        )
    tipos_aceptados, _etiqueta = info_categoria

    if archivo.content_type not in tipos_aceptados:
        raise HTTPException(
            422, f"Para '{categoria}' el archivo debe ser: {', '.join(tipos_aceptados)}"
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

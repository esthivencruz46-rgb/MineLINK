from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from auth import hash_password
from database import get_db
from security import limitar_creaciones_publicas

router = APIRouter(tags=["leads"])


@router.post("/leads", response_model=schemas.LeadOut, status_code=201)
def crear_lead(
    payload: schemas.LeadCreate,
    db: Session = Depends(get_db),
    _limite: None = Depends(limitar_creaciones_publicas),
):
    operacion = (
        db.query(models.Operacion)
        .filter(models.Operacion.id == payload.operacion_id)
        .first()
    )
    if operacion is None:
        raise HTTPException(status_code=404, detail="Operación no encontrada")

    ya_registrado = (
        db.query(models.Lead).filter(models.Lead.whatsapp == payload.whatsapp).first()
    )
    if ya_registrado is not None:
        raise HTTPException(
            status_code=409, detail="Este número de WhatsApp ya está registrado"
        )

    codigo_reinfo = payload.codigo_reinfo or operacion.codigo_reinfo
    if codigo_reinfo:
        ya_con_reinfo = (
            db.query(models.Lead)
            .filter(models.Lead.codigo_reinfo == codigo_reinfo)
            .first()
        )
        if ya_con_reinfo is not None:
            raise HTTPException(
                status_code=409, detail="Este código REINFO ya está registrado"
            )

    usuario_existente = (
        db.query(models.Lead).filter(models.Lead.username == payload.username).first()
    )
    if usuario_existente is not None:
        raise HTTPException(
            status_code=409, detail="Ese nombre de usuario ya está en uso"
        )

    lead = models.Lead(
        operacion_id=payload.operacion_id,
        nombre=payload.nombre,
        whatsapp=payload.whatsapp,
        email=payload.email,
        nombre_operacion=payload.nombre_operacion,
        region=payload.region,
        codigo_reinfo=codigo_reinfo,
        username=payload.username,
        password_hash=hash_password(payload.password),
        pregunta_seguridad=payload.pregunta_seguridad,
        respuesta_seguridad_hash=hash_password(payload.respuesta_seguridad),
        # El monto/uso de fondos ya se preguntaron en el diagnóstico (Bloque
        # 5) — se copian como valor inicial; el minero los puede afinar
        # después desde /mi-cuenta (PerfilInversionForm ya no los obliga).
        capital_buscado=operacion.monto_requerido,
        uso_fondos=operacion.uso_fondos_diagnostico,
    )
    # El diagnóstico ya no pregunta departamento (queda "no especificado");
    # el del registro es el dato real — se refleja en la operación para que
    # el filtro por departamento de /proyectos tenga sentido.
    operacion.region = payload.region
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead

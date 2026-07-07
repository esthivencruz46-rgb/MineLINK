from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from scoring import calcular_diagnostico

router = APIRouter(tags=["diagnostico"])


@router.post("/diagnostico", response_model=schemas.DiagnosticoResponse)
def crear_diagnostico(
    payload: schemas.DiagnosticoRequest, db: Session = Depends(get_db)
):
    resultado = calcular_diagnostico(payload.respuestas, payload.tipo_mina)

    operacion = models.Operacion(
        nombre_minero=payload.nombre_minero,
        codigo_reinfo=payload.codigo_reinfo,
        region=payload.region,
        mineral=payload.mineral,
        tipo_mina=payload.tipo_mina,
        score_total=resultado["score_total"],
        bloqueado=resultado["bloqueado"],
        respuestas_json=payload.respuestas,
        brechas_json=resultado["brechas"],
        produccion_mensual=payload.produccion_mensual,
        maquinaria=payload.maquinaria,
        num_trabajadores=payload.num_trabajadores,
    )
    db.add(operacion)
    db.commit()
    db.refresh(operacion)

    return schemas.DiagnosticoResponse(
        id=operacion.id,
        score_total=resultado["score_total"],
        dimensiones=resultado["dimensiones"],
        bloqueado=resultado["bloqueado"],
        brechas=resultado["brechas"],
    )

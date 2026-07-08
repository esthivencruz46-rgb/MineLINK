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
    resultado = calcular_diagnostico(
        payload.respuestas, payload.tipo_mina, payload.situacion
    )

    operacion = models.Operacion(
        nombre_minero=payload.nombre_minero,
        codigo_reinfo=payload.codigo_reinfo,
        region=payload.region,
        mineral=payload.mineral,
        tipo_mina=payload.tipo_mina,
        situacion=payload.situacion,
        score_total=resultado["score_total"],
        bloqueado=resultado["bloqueado"],
        respuestas_json=payload.respuestas,
        brechas_json=resultado["brechas"],
        produccion_mensual=payload.produccion_mensual,
        maquinaria=payload.maquinaria,
        num_trabajadores=payload.num_trabajadores,
        estado_operacion=payload.estado_operacion,
        tipo_explotacion=payload.tipo_explotacion,
        material_comercializado=payload.material_comercializado,
        forma_comercializacion=payload.forma_comercializacion,
        tiempo_operacion=payload.tiempo_operacion,
        ley_promedio=payload.ley_promedio,
        ley_como_obtenida=payload.ley_como_obtenida,
        tiene_resultados_laboratorio=payload.tiene_resultados_laboratorio,
        concesion_vigente=payload.concesion_vigente,
        tipo_deposito=payload.tipo_deposito,
        etapa_proyecto=payload.etapa_proyecto,
        trabajos_exploracion_json=payload.trabajos_exploracion_json,
        info_geologica_disponible=payload.info_geologica_disponible,
        tiene_estimaciones_leyes=payload.tiene_estimaciones_leyes,
        documento_autorizacion=payload.documento_autorizacion,
        tipo_apoyo_json=payload.tipo_apoyo_json,
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

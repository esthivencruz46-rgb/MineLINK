from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from scoring import calcular_diagnostico
from security import limitar_creaciones_publicas

router = APIRouter(tags=["diagnostico"])


@router.post("/diagnostico", response_model=schemas.DiagnosticoResponse)
def crear_diagnostico(
    payload: schemas.DiagnosticoRequest,
    db: Session = Depends(get_db),
    _limite: None = Depends(limitar_creaciones_publicas),
):
    try:
        resultado = calcular_diagnostico(payload.respuestas)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    operacion = models.Operacion(
        nombre_minero=payload.nombre_minero,
        codigo_reinfo=payload.codigo_reinfo,
        region=payload.region,
        mineral=payload.mineral,
        tipo_mina=payload.tipo_mina,
        situacion=payload.situacion,
        # El perfil (A/A_avanzado/B/C/D) se deriva SIEMPRE en el servidor a
        # partir de las respuestas del Módulo 0 — nunca se confía en el
        # cliente (evita desfases catálogo frontend/backend).
        estado_formalizacion=resultado["perfil"],
        score_total=0,
        bloqueado=not resultado["apto_inversionistas"],
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
        especie_mineral=payload.especie_mineral,
        tiene_resultados_laboratorio=payload.tiene_resultados_laboratorio,
        modalidad_trabajadores=payload.modalidad_trabajadores,
        provincia=payload.provincia,
        sustancias_toxicas=payload.sustancias_toxicas,
        gestion_sustancias=payload.gestion_sustancias,
        incidentes_previos=payload.incidentes_previos,
        permisos_comunitarios=payload.permisos_comunitarios,
        acceso_logistico=payload.acceso_logistico,
        experiencia_operador=payload.experiencia_operador,
        capacitacion_operador=payload.capacitacion_operador,
        documentacion_disponible=payload.documentacion_disponible,
        plan_formalizacion=payload.plan_formalizacion,
        prioridad_crecimiento=payload.prioridad_crecimiento,
        concesion_vigente=payload.concesion_vigente,
        tipo_deposito=payload.tipo_deposito,
        etapa_proyecto=payload.etapa_proyecto,
        trabajos_exploracion_json=payload.trabajos_exploracion_json,
        info_geologica_disponible=payload.info_geologica_disponible,
        tiene_estimaciones_leyes=payload.tiene_estimaciones_leyes,
        pagos_vigencia_al_dia=payload.pagos_vigencia_al_dia,
        toneladas_estimadas=payload.toneladas_estimadas,
        ley_esperada=payload.ley_esperada,
        capital_disponible=payload.capital_disponible,
        estudio_previo=payload.estudio_previo,
        historial_operacion=payload.historial_operacion,
        pasivos_ambientales=payload.pasivos_ambientales,
        experiencia_titular=payload.experiencia_titular,
        background_titular=payload.background_titular,
        equipo_tecnico=payload.equipo_tecnico,
        tipo_socio_buscado=payload.tipo_socio_buscado,
        siguiente_hito=payload.siguiente_hito,
        timeline_operacion=payload.timeline_operacion,
        motivo_inicio=payload.motivo_inicio,
        documento_autorizacion=payload.documento_autorizacion,
        tipo_apoyo_json=payload.tipo_apoyo_json,
        tipo_apoyo=payload.tipo_apoyo,
        acceso_agua=payload.acceso_agua,
        acceso_energia=payload.acceso_energia,
        conflictividad_social=payload.conflictividad_social,
        estructura_propiedad=payload.estructura_propiedad,
        moneda_capital=payload.moneda_capital,
        monto_requerido=payload.monto_requerido,
        plazo_capital=payload.plazo_capital,
        motivo_capital=payload.motivo_capital,
        produccion_objetivo=payload.produccion_objetivo,
        uso_fondos_diagnostico=payload.uso_fondos_diagnostico,
    )
    db.add(operacion)
    db.commit()
    db.refresh(operacion)

    return schemas.DiagnosticoResponse(
        id=operacion.id,
        perfil=resultado["perfil"],
        clasificacion=resultado["clasificacion"],
        semaforo_legal=resultado["semaforo_legal"],
        bloqueantes=resultado["bloqueantes"],
        etiquetas_bloqueantes=resultado["etiquetas_bloqueantes"],
        semaforo_tecnico=resultado["semaforo_tecnico"],
        indice_madurez=resultado["indice_madurez"],
        riesgo_caducidad=resultado["riesgo_caducidad"],
        apto_inversionistas=resultado["apto_inversionistas"],
        urgencia=resultado["urgencia"],
        reloj_produccion=resultado["reloj_produccion"],
        brechas=resultado["brechas"],
        brechas_en_proceso=resultado["brechas_en_proceso"],
        salidas=resultado["salidas"],
    )

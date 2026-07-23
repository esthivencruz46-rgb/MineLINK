from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import asesor
import models
import schemas
from database import get_db
from security import limitar_preguntas_asesor

router = APIRouter(prefix="/asesor", tags=["asesor"])


@router.post("", response_model=schemas.AsesorRespuestaOut)
def preguntar_asesor(
    payload: schemas.AsesorPreguntaRequest,
    db: Session = Depends(get_db),
    _limite: None = Depends(limitar_preguntas_asesor),
):
    """Asesor conversacional PÚBLICO (julio 2026, decisión explícita del
    dueño: "cualquier persona sin registrarse lo pueda usar"). Genérico —
    no conoce el caso de nadie en particular, solo el spec de negocio de
    MineLink (`asesor.py`). Nunca genera documentos ni asesora legalmente."""
    historial = [
        {"rol": m.rol, "contenido": m.contenido} for m in payload.historial
    ][-asesor.MAX_TURNOS_HISTORIAL :]
    historial.append({"rol": "usuario", "contenido": payload.pregunta})

    # Documentos subidos desde /admin (sin git) — barato de consultar; solo
    # reconstruye el índice de búsqueda si de verdad cambió algo desde la
    # última pregunta (ver asesor.actualizar_documentos_admin).
    documentos_admin = db.query(models.DocumentoAsesor).filter(
        models.DocumentoAsesor.activo == True  # noqa: E712
    ).all()
    asesor.actualizar_documentos_admin(
        [(d.nombre, d.categoria, d.texto) for d in documentos_admin]
    )

    system = asesor.construir_system_prompt(payload.pregunta)
    try:
        respuesta = asesor.generar_respuesta(system, historial)
    except asesor.AsesorNoDisponible:
        # "asesor_fallo"/"asesor_respondido" son eventos SOLO del servidor
        # (nunca pasan por POST /eventos ni su lista validada de tipos) —
        # existen para que el dashboard admin muestre si el asesor está
        # fallando hoy sin que Esthiven tenga que probarlo a mano (julio
        # 2026, tras un incidente real: una clave de API incompleta en
        # Render pasó desapercibida hasta que él mismo lo notó por casualidad).
        db.add(models.Evento(tipo="asesor_fallo"))
        db.commit()
        raise HTTPException(
            status_code=503,
            detail="El asesor no está disponible en este momento. Intenta de nuevo en un rato.",
        )
    db.add(models.Evento(tipo="asesor_respondido"))
    db.commit()
    return schemas.AsesorRespuestaOut(respuesta=respuesta)

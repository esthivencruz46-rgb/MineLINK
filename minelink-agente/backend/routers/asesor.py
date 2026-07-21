from fastapi import APIRouter, Depends, HTTPException

import asesor
import schemas
from security import limitar_preguntas_asesor

router = APIRouter(prefix="/asesor", tags=["asesor"])


@router.post("", response_model=schemas.AsesorRespuestaOut)
def preguntar_asesor(
    payload: schemas.AsesorPreguntaRequest,
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

    system = asesor.construir_system_prompt()
    try:
        respuesta = asesor.generar_respuesta(system, historial)
    except asesor.AsesorNoDisponible:
        raise HTTPException(
            status_code=503,
            detail="El asesor no está disponible en este momento. Intenta de nuevo en un rato.",
        )
    return schemas.AsesorRespuestaOut(respuesta=respuesta)

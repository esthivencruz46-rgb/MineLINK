from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from security import limitar_creaciones_publicas

router = APIRouter(prefix="/eventos", tags=["eventos"])


@router.post("", status_code=201)
def registrar_evento(
    payload: schemas.EventoCreate,
    db: Session = Depends(get_db),
    _limite: None = Depends(limitar_creaciones_publicas),
):
    """Registra un evento anónimo de uso (ej. "diagnostico_iniciado") para
    las métricas del embudo en el dashboard admin. Sin datos personales."""
    evento = models.Evento(tipo=payload.tipo)
    db.add(evento)
    db.commit()
    return {"ok": True}

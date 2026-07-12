"""Helper mínimo para crear notificaciones del minero (ver models.Notificacion).
No hace commit — el caller ya está dentro de una transacción propia (revisar
un documento, dar un visto bueno) y se agrupan en el mismo commit."""

import models
from sqlalchemy.orm import Session


def crear_notificacion(db: Session, lead_id: int, tipo: str, mensaje: str) -> None:
    db.add(models.Notificacion(lead_id=lead_id, tipo=tipo, mensaje=mensaje))

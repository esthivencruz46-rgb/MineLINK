"""Helper mínimo para crear notificaciones del minero (ver models.Notificacion).
No hace commit — el caller ya está dentro de una transacción propia (revisar
un documento, dar un visto bueno) y se agrupan en el mismo commit."""

import models
from sqlalchemy.orm import Session

from scoring import estado_seguimiento


def crear_notificacion(db: Session, lead_id: int, tipo: str, mensaje: str) -> None:
    db.add(models.Notificacion(lead_id=lead_id, tipo=tipo, mensaje=mensaje))


def notificar_publicacion_si_corresponde(
    db: Session, lead: models.Lead, operacion: models.Operacion
) -> None:
    """Si la operación acaba de quedar apta para la cartera pública (ver
    scoring.estado_seguimiento — perfil B/C/D + semáforo legal no rojo +
    documentos de formalización Y de inversión enviados), notifica al
    minero UNA sola vez. Vive aquí (no en routers/mineros.py) porque
    admin.py también la necesita — cuando Esthiven marca resuelta la
    brecha que tenía el semáforo en rojo, el proyecto se publica solo y
    antes el minero no se enteraba (julio 2026, hallazgo de auditoría) —
    y un router nunca debe importar de otro router."""
    if not estado_seguimiento(operacion).get("apto_inversionistas"):
        return
    ya_notificado = (
        db.query(models.Notificacion)
        .filter(
            models.Notificacion.lead_id == lead.id,
            models.Notificacion.tipo == "publicado_cartera",
        )
        .first()
    )
    if ya_notificado is not None:
        return
    crear_notificacion(
        db,
        lead.id,
        "publicado_cartera",
        "Tu proyecto ya está publicado en la cartera para inversionistas.",
    )
    db.commit()

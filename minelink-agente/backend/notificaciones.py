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


def notificar_empresa_disponible(db: Session, empresa: models.Empresa) -> None:
    """"Avísenme cuando haya" (julio 2026): antes ese botón solo abría el
    registro y no guardaba nada — nadie volvía a saber si apareció una
    empresa. Ahora, cuando una empresa queda ACTIVA con estudios y
    regiones, se avisa a todo minero con una brecha pendiente que calce en
    su región. Se llama desde routers/admin.py al crear/activar una
    empresa — nunca al desactivarla ni al importar en lote (esas nacen
    inactivas a propósito). No hay deduplicación entre activaciones
    repetidas de la misma empresa (reactivar dos veces puede re-notificar)
    — caso raro, no vale una tabla nueva solo para eso."""
    if not empresa.activa:
        return
    regiones = {r.lower() for r in (empresa.regiones_json or [])}
    estudios = set(empresa.estudios_json or [])
    if not regiones or not estudios:
        return

    leads = db.query(models.Lead).filter(models.Lead.region.in_(regiones)).all()
    if not leads:
        return
    operaciones = {
        o.id: o
        for o in db.query(models.Operacion)
        .filter(models.Operacion.id.in_([lead.operacion_id for lead in leads]))
        .all()
    }
    for lead in leads:
        operacion = operaciones.get(lead.operacion_id)
        if operacion is None:
            continue
        pendientes = set(estado_seguimiento(operacion).get("brechas_pendientes") or [])
        if not (pendientes & estudios):
            continue
        crear_notificacion(
            db,
            lead.id,
            "empresa_disponible",
            f'"{empresa.nombre}" ya está disponible en tu región y puede ayudarte con '
            "algo que te falta. Revisa la sección de empresas.",
        )
    db.commit()

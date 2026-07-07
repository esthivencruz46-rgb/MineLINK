from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

import models
import schemas
from auth import hash_password
from database import get_db
from scoring import estado_seguimiento
from uploads_config import CATEGORIAS_DOCUMENTO, DOCUMENTOS_MINERO_DIR

router = APIRouter(prefix="/proyectos", tags=["proyectos"])

CATEGORIAS_LEGALES = [c for c in CATEGORIAS_DOCUMENTO if c != "fotos_mina"]


def _nombre_proyecto(lead: models.Lead, operacion: models.Operacion) -> str:
    return lead.nombre_operacion or f"Proyecto minero en {operacion.region.title()}"


def _proyectos_visibles(db: Session):
    """Operaciones con cuenta registrada (Lead), con REINFO vigente
    (nunca bloqueadas) — misma regla dura que el resto del proyecto:
    sin REINFO, la operación no se lista ni recibe score público."""
    filas = (
        db.query(models.Lead, models.Operacion)
        .join(models.Operacion, models.Lead.operacion_id == models.Operacion.id)
        .filter(models.Operacion.bloqueado.is_(False))
        .order_by(models.Lead.created_at.desc())
        .all()
    )
    return filas


def _proyecto_publico_out(lead: models.Lead, operacion: models.Operacion) -> schemas.ProyectoPublicoOut:
    seguimiento = estado_seguimiento(operacion)
    return schemas.ProyectoPublicoOut(
        operacion_id=operacion.id,
        nombre_proyecto=_nombre_proyecto(lead, operacion),
        region=operacion.region,
        mineral=operacion.mineral,
        tipo_mina=operacion.tipo_mina,
        score_actual=seguimiento["score_actual"],
        descripcion_operacion=lead.descripcion_operacion,
        capacidad_produccion=lead.capacidad_produccion,
        capital_buscado=lead.capital_buscado,
        uso_fondos=lead.uso_fondos,
        created_at=lead.created_at,
    )


@router.get("", response_model=list[schemas.ProyectoPublicoOut])
def listar_proyectos(
    mineral: Optional[str] = None,
    region: Optional[str] = None,
    db: Session = Depends(get_db),
):
    filas = _proyectos_visibles(db)

    resultado = []
    for lead, operacion in filas:
        if mineral and mineral.strip().lower() not in operacion.mineral.lower():
            continue
        if region and operacion.region.lower() != region.strip().lower():
            continue
        resultado.append(_proyecto_publico_out(lead, operacion))
    return resultado


@router.get("/minerales", response_model=list[str])
def listar_minerales(db: Session = Depends(get_db)):
    filas = _proyectos_visibles(db)
    minerales = sorted({operacion.mineral for _lead, operacion in filas})
    return minerales


def _lead_y_operacion_visibles(db: Session, operacion_id: str) -> tuple[models.Lead, models.Operacion]:
    fila = (
        db.query(models.Lead, models.Operacion)
        .join(models.Operacion, models.Lead.operacion_id == models.Operacion.id)
        .filter(models.Operacion.id == operacion_id, models.Operacion.bloqueado.is_(False))
        .first()
    )
    if fila is None:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    return fila


@router.get("/{operacion_id}", response_model=schemas.ProyectoDetalleOut)
def detalle_proyecto(operacion_id: str, db: Session = Depends(get_db)):
    lead, operacion = _lead_y_operacion_visibles(db, operacion_id)
    base = _proyecto_publico_out(lead, operacion)

    documentos = (
        db.query(models.DocumentoOperacion)
        .filter(models.DocumentoOperacion.operacion_id == operacion_id)
        .all()
    )
    fotos = [
        schemas.FotoPublicaOut(id=d.id, url=f"/proyectos/{operacion_id}/fotos/{d.id}")
        for d in documentos
        if d.categoria == "fotos_mina"
    ]
    categorias_presentadas = {d.categoria for d in documentos}
    documentos_presentados = {c: c in categorias_presentadas for c in CATEGORIAS_LEGALES}

    seguimiento = estado_seguimiento(operacion)

    return schemas.ProyectoDetalleOut(
        **base.model_dump(),
        fotos=fotos,
        documentos_presentados=documentos_presentados,
        brechas_pendientes=seguimiento["brechas_pendientes"],
        brechas_resueltas=seguimiento["brechas_resueltas"],
        dimensiones=seguimiento["dimensiones"],
    )


@router.post("/{operacion_id}/interes", response_model=schemas.InteresInversionOut, status_code=201)
def registrar_interes(
    operacion_id: str,
    payload: schemas.InteresInversionCreate,
    db: Session = Depends(get_db),
):
    """Un inversionista deja sus datos desde la ficha pública del proyecto Y
    crea su cuenta en el mismo paso (usuario/contraseña, mismo patrón que el
    registro del minero). NUNCA le damos el WhatsApp/email del minero —
    Esthiven ve este interés en el panel admin y hace de intermediario."""
    _lead_y_operacion_visibles(db, operacion_id)

    ya_existe = (
        db.query(models.InteresInversion)
        .filter(models.InteresInversion.username == payload.username)
        .first()
    )
    if ya_existe is not None:
        raise HTTPException(status_code=409, detail="Ese nombre de usuario ya está en uso")

    interes = models.InteresInversion(
        operacion_id=operacion_id,
        nombre=payload.nombre,
        telefono=payload.telefono,
        email=payload.email,
        motivo_inversion=payload.motivo_inversion,
        monto=payload.monto,
        informacion_requerida=payload.informacion_requerida,
        mensaje=payload.mensaje,
        username=payload.username,
        password_hash=hash_password(payload.password),
    )
    db.add(interes)
    db.commit()
    db.refresh(interes)
    return interes


@router.get("/{operacion_id}/fotos/{documento_id}")
def foto_proyecto(operacion_id: str, documento_id: int, db: Session = Depends(get_db)):
    """Sirve SOLO fotos de la mina (categoría fotos_mina), nunca los PDFs
    legales — esos pueden tener nombre completo/DNI y quedan privados."""
    _lead_y_operacion_visibles(db, operacion_id)

    documento = (
        db.query(models.DocumentoOperacion)
        .filter(
            models.DocumentoOperacion.id == documento_id,
            models.DocumentoOperacion.operacion_id == operacion_id,
            models.DocumentoOperacion.categoria == "fotos_mina",
        )
        .first()
    )
    if documento is None:
        raise HTTPException(status_code=404, detail="Foto no encontrada")

    ruta = DOCUMENTOS_MINERO_DIR / documento.filename
    if not ruta.exists():
        raise HTTPException(status_code=404, detail="El archivo no se encuentra")

    return FileResponse(ruta, media_type=documento.content_type)

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

import models
import schemas
import storage
from auth import hash_password
from database import get_db
from scoring import estado_seguimiento
from uploads_config import CATEGORIAS_DOCUMENTO

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


def _proyecto_publico_out(
    lead: models.Lead,
    operacion: models.Operacion,
    foto_portada_url: Optional[str] = None,
) -> schemas.ProyectoPublicoOut:
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
        foto_portada_url=foto_portada_url,
    )


def _fotos_portada(db: Session, operacion_ids: list[str]) -> dict[str, str]:
    """Primera foto de mina de cada operación (una sola consulta), como URL
    pública servida por el backend."""
    if not operacion_ids:
        return {}
    fotos = (
        db.query(models.DocumentoOperacion)
        .filter(
            models.DocumentoOperacion.operacion_id.in_(operacion_ids),
            models.DocumentoOperacion.categoria == "fotos_mina",
        )
        .order_by(models.DocumentoOperacion.created_at.asc())
        .all()
    )
    portada: dict[str, str] = {}
    for f in fotos:
        if f.operacion_id not in portada:
            portada[f.operacion_id] = f"/proyectos/{f.operacion_id}/fotos/{f.id}"
    return portada


@router.get("", response_model=list[schemas.ProyectoPublicoOut])
def listar_proyectos(
    mineral: Optional[str] = None,
    region: Optional[str] = None,
    db: Session = Depends(get_db),
):
    filas = _proyectos_visibles(db)

    visibles = []
    for lead, operacion in filas:
        if mineral and mineral.strip().lower() not in operacion.mineral.lower():
            continue
        if region and operacion.region.lower() != region.strip().lower():
            continue
        visibles.append((lead, operacion))

    portadas = _fotos_portada(db, [o.id for _l, o in visibles])
    return [
        _proyecto_publico_out(lead, operacion, portadas.get(operacion.id))
        for lead, operacion in visibles
    ]


@router.get("/minerales", response_model=list[str])
def listar_minerales(db: Session = Depends(get_db)):
    filas = _proyectos_visibles(db)
    minerales = sorted({operacion.mineral for _lead, operacion in filas})
    return minerales


def _generar_descripcion(
    lead: models.Lead,
    operacion: models.Operacion,
    seguimiento: dict,
    n_fotos: int,
    n_docs_legales: int,
) -> str:
    """Redacta la descripción pública del proyecto a partir de los datos
    REALES del diagnóstico y del perfil del minero — nunca inventa cifras.
    Si un dato no existe, simplemente no se menciona."""
    tipo_legible = "subterránea" if operacion.tipo_mina == "subterranea" else "a tajo abierto"
    partes = [
        f"Operación minera de {operacion.mineral.lower()} {tipo_legible} "
        f"ubicada en {operacion.region.title()}, registrada en REINFO."
    ]

    score = seguimiento["score_actual"]
    pendientes = len(seguimiento["brechas_pendientes"])
    if pendientes == 0:
        partes.append(
            f"Alcanzó un MineScore de {score}/100 y completó todos los "
            "requisitos del diagnóstico de formalización."
        )
    else:
        partes.append(
            f"Tiene un MineScore de {score}/100, con {pendientes} "
            f"requisito{'s' if pendientes != 1 else ''} de formalización en proceso."
        )

    if lead.capacidad_produccion:
        partes.append(f"Producción y reservas declaradas: {lead.capacidad_produccion.strip()}.")

    if lead.capital_buscado and lead.uso_fondos:
        partes.append(
            f"Busca {lead.capital_buscado.strip()} de inversión, "
            f"destinados a: {lead.uso_fondos.strip()}."
        )
    elif lead.capital_buscado:
        partes.append(f"Busca {lead.capital_buscado.strip()} de inversión.")
    elif lead.uso_fondos:
        partes.append(f"Busca inversión destinada a: {lead.uso_fondos.strip()}.")

    respaldo = []
    if n_fotos > 0:
        respaldo.append(f"{n_fotos} foto{'s' if n_fotos != 1 else ''} de la operación")
    if n_docs_legales > 0:
        respaldo.append(
            f"{n_docs_legales} documento{'s' if n_docs_legales != 1 else ''} legal"
            f"{'es' if n_docs_legales != 1 else ''} presentado"
            f"{'s' if n_docs_legales != 1 else ''}"
        )
    if respaldo:
        partes.append(f"El proyecto respalda su información con {' y '.join(respaldo)}.")

    return " ".join(partes)


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
    n_docs_legales = sum(1 for presentado in documentos_presentados.values() if presentado)

    return schemas.ProyectoDetalleOut(
        **base.model_dump(),
        fotos=fotos,
        documentos_presentados=documentos_presentados,
        brechas_pendientes=seguimiento["brechas_pendientes"],
        brechas_resueltas=seguimiento["brechas_resueltas"],
        dimensiones=seguimiento["dimensiones"],
        ubicacion_maps=lead.ubicacion_maps,
        ubicacion_coords=lead.ubicacion_coords,
        descripcion_generada=_generar_descripcion(
            lead, operacion, seguimiento, len(fotos), n_docs_legales
        ),
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

    contenido = storage.leer("documentos_mineros", documento.filename)
    if contenido is None:
        raise HTTPException(status_code=404, detail="El archivo no se encuentra")

    return Response(content=contenido, media_type=documento.content_type)

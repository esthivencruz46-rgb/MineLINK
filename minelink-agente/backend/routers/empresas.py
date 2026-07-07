import json
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import ValidationError
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from security import contenido_coincide_con_tipo
from uploads_config import CV_TAMANO_MAXIMO_BYTES, UPLOADS_DIR

router = APIRouter(tags=["empresas"])


def recomendar(empresas, brechas: list[str], region: str):
    """Empresas activas de la región que cubren >=1 brecha.
    Orden: más coincidencias primero, luego más años de servicio."""
    candidatas = []
    for e in empresas:
        if not e.activa or region not in e.regiones_json:
            continue
        coincidencias = set(e.estudios_json) & set(brechas)
        if coincidencias:
            candidatas.append((len(coincidencias), e.anios_servicio, e))
    candidatas.sort(key=lambda t: (-t[0], -t[1]))
    return [(e, n) for n, _, e in candidatas]


@router.get("/empresas", response_model=list[schemas.EmpresaOut])
def listar_empresas(
    estudios: Optional[str] = None,
    region: Optional[str] = None,
    db: Session = Depends(get_db),
):
    empresas = db.query(models.Empresa).all()

    if estudios is None or region is None:
        return [e for e in empresas if e.activa]

    brechas = [s for s in estudios.split(",") if s]
    ordenadas = recomendar(empresas, brechas, region)
    return [e for e, _ in ordenadas]


@router.get("/empresas/mejor-opcion", response_model=schemas.MejorOpcionOut)
def mejor_opcion(
    estudios: str,
    region: str,
    db: Session = Depends(get_db),
):
    """Dadas las brechas del minero y su departamento:
    - Si UNA empresa cubre TODAS las brechas, la devuelve sola (modo
      "empresa_unica"): es el producto que resuelve todo.
    - Si no, devuelve la mejor empresa para CADA brecha por separado
      (modo "por_brecha"), priorizando la que más brechas totales cubre
      y luego más años de servicio (misma regla que el listado general).
    """
    brechas = [s for s in estudios.split(",") if s]
    empresas = db.query(models.Empresa).all()
    activas_region = [e for e in empresas if e.activa and region in e.regiones_json]

    set_brechas = set(brechas)
    que_cubren_todo = [
        e for e in activas_region if set_brechas.issubset(set(e.estudios_json))
    ]
    if que_cubren_todo:
        ganadora = max(que_cubren_todo, key=lambda e: e.anios_servicio)
        return schemas.MejorOpcionOut(modo="empresa_unica", empresa_unica=ganadora)

    mejores_por_brecha: dict[str, models.Empresa | None] = {}
    for brecha in brechas:
        candidatas = [e for e in activas_region if brecha in e.estudios_json]
        if not candidatas:
            mejores_por_brecha[brecha] = None
            continue
        mejores_por_brecha[brecha] = max(
            candidatas,
            key=lambda e: (len(set(e.estudios_json) & set_brechas), e.anios_servicio),
        )

    return schemas.MejorOpcionOut(modo="por_brecha", mejores_por_brecha=mejores_por_brecha)


@router.post("/consultores/postular", response_model=schemas.EmpresaOut, status_code=201)
async def postular_consultor(
    nombre: str = Form(...),
    colegiatura: str = Form(...),
    anios_servicio: int = Form(...),
    whatsapp: str = Form(...),
    email: Optional[str] = Form(None),
    regiones_json: str = Form(..., description="Lista JSON, ej: [\"arequipa\"]"),
    estudios_json: str = Form(..., description="Lista JSON, ej: [\"tramite_reinfo\"]"),
    cv: UploadFile = File(..., description="CV en PDF, obligatorio"),
    db: Session = Depends(get_db),
):
    """Auto-registro público de un consultor independiente. Exige colegiatura,
    >=3 años de experiencia y CV en PDF (para que Esthiven lo revise antes de
    aprobar). Queda SIEMPRE inactivo hasta que se apruebe desde /admin/empresas."""
    try:
        datos = schemas.PostulacionConsultorCreate(
            nombre=nombre,
            colegiatura=colegiatura,
            anios_servicio=anios_servicio,
            whatsapp=whatsapp,
            email=email,
            regiones_json=json.loads(regiones_json),
            estudios_json=json.loads(estudios_json),
        )
    except json.JSONDecodeError:
        raise HTTPException(422, "regiones_json/estudios_json deben ser listas JSON válidas")
    except ValidationError as exc:
        mensajes = [e["msg"] for e in exc.errors()]
        raise HTTPException(422, "; ".join(mensajes))

    ya_existe = (
        db.query(models.Empresa)
        .filter(models.Empresa.colegiatura == datos.colegiatura)
        .first()
    )
    if ya_existe is not None:
        raise HTTPException(409, "Ya existe un consultor registrado con este CIP")

    if cv.content_type != "application/pdf":
        raise HTTPException(422, "El CV debe ser un archivo PDF")

    contenido = await cv.read()
    if len(contenido) > CV_TAMANO_MAXIMO_BYTES:
        raise HTTPException(422, "El CV no debe superar 5MB")
    if len(contenido) == 0:
        raise HTTPException(422, "El CV está vacío")
    if not contenido_coincide_con_tipo(contenido, "application/pdf"):
        raise HTTPException(422, "El archivo no es un PDF real")

    nombre_archivo = f"{uuid.uuid4()}.pdf"
    (UPLOADS_DIR / nombre_archivo).write_bytes(contenido)

    consultor = models.Empresa(
        tipo="consultor",
        nombre=datos.nombre,
        ruc=None,
        colegiatura=datos.colegiatura,
        cv_filename=nombre_archivo,
        anios_servicio=datos.anios_servicio,
        regiones_json=datos.regiones_json,
        estudios_json=datos.estudios_json,
        whatsapp=datos.whatsapp,
        email=datos.email,
        activa=False,
    )
    db.add(consultor)
    db.commit()
    db.refresh(consultor)
    return consultor


@router.get("/empresas/{empresa_id}", response_model=schemas.EmpresaOut)
def obtener_empresa(empresa_id: int, db: Session = Depends(get_db)):
    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if empresa is None:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return empresa

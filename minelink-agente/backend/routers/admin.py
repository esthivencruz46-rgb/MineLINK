from collections import Counter
from datetime import date, datetime, time, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

import models
import schemas
from auth import authenticate_admin, create_access_token, get_current_admin
from database import get_db
from security import limitar_intentos_login
from scoring import estado_seguimiento
from uploads_config import DOCUMENTOS_MINERO_DIR, UPLOADS_DIR

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/login", response_model=schemas.Token)
def login(payload: schemas.AdminLogin, _: None = Depends(limitar_intentos_login)):
    if not authenticate_admin(payload.username, payload.password):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
    return schemas.Token(access_token=create_access_token())


@router.get("/leads", response_model=list[schemas.LeadConDiagnostico])
def listar_leads(
    desde: Optional[date] = None,
    hasta: Optional[date] = None,
    region: Optional[str] = None,
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    query = db.query(models.Lead, models.Operacion).join(
        models.Operacion, models.Lead.operacion_id == models.Operacion.id
    )
    if desde is not None:
        query = query.filter(models.Lead.created_at >= datetime.combine(desde, time.min))
    if hasta is not None:
        query = query.filter(models.Lead.created_at <= datetime.combine(hasta, time.max))
    if region:
        query = query.filter(models.Lead.region == region)

    filas = query.order_by(models.Lead.created_at.desc()).all()

    return [
        schemas.LeadConDiagnostico(
            id=lead.id,
            operacion_id=lead.operacion_id,
            nombre=lead.nombre,
            whatsapp=lead.whatsapp,
            email=lead.email,
            nombre_operacion=lead.nombre_operacion,
            region=lead.region,
            codigo_reinfo=lead.codigo_reinfo,
            created_at=lead.created_at,
            score_total=operacion.score_total,
            bloqueado=operacion.bloqueado,
            brechas=operacion.brechas_json,
            descripcion_operacion=lead.descripcion_operacion,
            capacidad_produccion=lead.capacidad_produccion,
            capital_buscado=lead.capital_buscado,
            uso_fondos=lead.uso_fondos,
            ubicacion_maps=lead.ubicacion_maps,
            **estado_seguimiento(operacion),
        )
        for lead, operacion in filas
    ]


@router.delete("/leads/{lead_id}", status_code=204)
def eliminar_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    """Borra la cuenta del minero (lead + su diagnóstico original). No
    reversible: se usa para pedidos de baja o limpieza de spam."""
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if lead is None:
        raise HTTPException(status_code=404, detail="Lead no encontrado")

    operacion_id = lead.operacion_id
    db.delete(lead)
    db.flush()

    otros_leads = (
        db.query(models.Lead).filter(models.Lead.operacion_id == operacion_id).first()
    )
    if otros_leads is None:
        operacion = (
            db.query(models.Operacion).filter(models.Operacion.id == operacion_id).first()
        )
        if operacion is not None:
            documentos = (
                db.query(models.DocumentoOperacion)
                .filter(models.DocumentoOperacion.operacion_id == operacion_id)
                .all()
            )
            for documento in documentos:
                ruta = DOCUMENTOS_MINERO_DIR / documento.filename
                if ruta.exists():
                    ruta.unlink()
                db.delete(documento)
            intereses = (
                db.query(models.InteresInversion)
                .filter(models.InteresInversion.operacion_id == operacion_id)
                .all()
            )
            for interes in intereses:
                db.delete(interes)
            db.delete(operacion)

    db.commit()


@router.put(
    "/operaciones/{operacion_id}/brechas-resueltas",
    response_model=schemas.OperacionSeguimientoOut,
)
def actualizar_brechas_resueltas(
    operacion_id: str,
    payload: schemas.ActualizarBrechasResueltasRequest,
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    """Marca (o desmarca, si se envía una lista más corta) brechas como
    resueltas por seguimiento manual de Esthiven — ej. se enteró por
    WhatsApp de que el minero ya sacó su IGAFOM. NO modifica la
    declaración original del diagnóstico, así el minero nunca tiene que
    rehacer el cuestionario para que su progreso se refleje."""
    operacion = db.query(models.Operacion).filter(models.Operacion.id == operacion_id).first()
    if operacion is None:
        raise HTTPException(status_code=404, detail="Operación no encontrada")

    no_son_brechas_reales = set(payload.brechas_resueltas) - set(operacion.brechas_json)
    if no_son_brechas_reales:
        raise HTTPException(
            status_code=400,
            detail=f"Estas brechas no pertenecen al diagnóstico original: {sorted(no_son_brechas_reales)}",
        )

    operacion.brechas_resueltas_json = sorted(set(payload.brechas_resueltas))
    db.commit()
    db.refresh(operacion)

    return schemas.OperacionSeguimientoOut(
        operacion_id=operacion.id,
        score_total=operacion.score_total,
        brechas=operacion.brechas_json,
        **estado_seguimiento(operacion),
    )


@router.get("/dashboard", response_model=schemas.DashboardOut)
def dashboard(db: Session = Depends(get_db), _admin: str = Depends(get_current_admin)):
    hoy = datetime.now(timezone.utc).date()
    inicio_hoy = datetime.combine(hoy, time.min)

    operaciones = db.query(models.Operacion).all()
    leads = db.query(models.Lead).all()

    diagnosticos_total = len(operaciones)
    diagnosticos_hoy = sum(1 for o in operaciones if o.created_at >= inicio_hoy)
    leads_total = len(leads)
    leads_hoy = sum(1 for l in leads if l.created_at >= inicio_hoy)
    score_promedio = (
        round(sum(o.score_total for o in operaciones) / diagnosticos_total, 1)
        if diagnosticos_total > 0
        else 0.0
    )

    # Brechas PENDIENTES (no las ya marcadas como resueltas): así el
    # dashboard refleja qué necesita reclutar Esthiven ahora, no lo que
    # ya quedó resuelto por seguimiento manual.
    contador = Counter(
        estudio
        for o in operaciones
        for estudio in set(o.brechas_json) - set(o.brechas_resueltas_json)
    )
    top_brechas = [
        schemas.TopBrecha(estudio=estudio, conteo=conteo)
        for estudio, conteo in contador.most_common(5)
    ]

    ultimos = sorted(leads, key=lambda l: l.created_at, reverse=True)[:10]
    operaciones_por_id = {o.id: o for o in operaciones}
    ultimos_leads = [
        schemas.UltimoLead(
            nombre=lead.nombre,
            region=lead.region,
            score_total=operaciones_por_id[lead.operacion_id].score_total,
            created_at=lead.created_at,
        )
        for lead in ultimos
    ]

    return schemas.DashboardOut(
        diagnosticos_hoy=diagnosticos_hoy,
        diagnosticos_total=diagnosticos_total,
        leads_hoy=leads_hoy,
        leads_total=leads_total,
        score_promedio=score_promedio,
        top_brechas=top_brechas,
        ultimos_leads=ultimos_leads,
    )


@router.get("/empresas", response_model=list[schemas.EmpresaOut])
def listar_empresas_admin(
    db: Session = Depends(get_db), _admin: str = Depends(get_current_admin)
):
    """A diferencia de GET /empresas (público), incluye también las inactivas
    para que Esthiven pueda reactivarlas."""
    return db.query(models.Empresa).order_by(models.Empresa.created_at.desc()).all()


@router.get("/empresas/{empresa_id}/cv")
def descargar_cv(
    empresa_id: int, db: Session = Depends(get_db), _admin: str = Depends(get_current_admin)
):
    """Descarga el CV (PDF) de un consultor postulante. Protegido con JWT:
    el CV tiene datos personales y solo Esthiven debe verlo, nunca es público."""
    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if empresa is None or not empresa.cv_filename:
        raise HTTPException(status_code=404, detail="Esta empresa no tiene CV registrado")

    ruta = UPLOADS_DIR / empresa.cv_filename
    if not ruta.exists():
        raise HTTPException(status_code=404, detail="El archivo del CV no se encuentra")

    return FileResponse(
        ruta, media_type="application/pdf", filename=f"CV_{empresa.nombre}.pdf"
    )


@router.get(
    "/operaciones/{operacion_id}/documentos",
    response_model=list[schemas.DocumentoOperacionOut],
)
def listar_documentos_operacion(
    operacion_id: str,
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    """Documentos que el minero subió desde /mi-cuenta (fotos, leyes,
    catastro, etc.) para que Esthiven los revise."""
    operacion = db.query(models.Operacion).filter(models.Operacion.id == operacion_id).first()
    if operacion is None:
        raise HTTPException(status_code=404, detail="Operación no encontrada")

    return (
        db.query(models.DocumentoOperacion)
        .filter(models.DocumentoOperacion.operacion_id == operacion_id)
        .order_by(models.DocumentoOperacion.created_at.desc())
        .all()
    )


@router.get("/documentos/{documento_id}/archivo")
def descargar_documento_operacion(
    documento_id: int,
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    documento = (
        db.query(models.DocumentoOperacion)
        .filter(models.DocumentoOperacion.id == documento_id)
        .first()
    )
    if documento is None:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    ruta = DOCUMENTOS_MINERO_DIR / documento.filename
    if not ruta.exists():
        raise HTTPException(status_code=404, detail="El archivo no se encuentra")

    return FileResponse(
        ruta, media_type=documento.content_type, filename=documento.nombre_original
    )


@router.get(
    "/operaciones/{operacion_id}/intereses",
    response_model=list[schemas.InteresInversionOut],
)
def listar_intereses_inversion(
    operacion_id: str,
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    """Inversionistas que dejaron sus datos desde la ficha pública del
    proyecto (/proyectos/{id}). Esthiven los contacta manualmente."""
    operacion = db.query(models.Operacion).filter(models.Operacion.id == operacion_id).first()
    if operacion is None:
        raise HTTPException(status_code=404, detail="Operación no encontrada")

    return (
        db.query(models.InteresInversion)
        .filter(models.InteresInversion.operacion_id == operacion_id)
        .order_by(models.InteresInversion.created_at.desc())
        .all()
    )


@router.post("/empresas", response_model=schemas.EmpresaOut, status_code=201)
def crear_empresa(
    payload: schemas.EmpresaCreate,
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    if payload.ruc is not None:
        existente = db.query(models.Empresa).filter(models.Empresa.ruc == payload.ruc).first()
        if existente is not None:
            raise HTTPException(status_code=400, detail="Ya existe una empresa con ese RUC")

    if payload.colegiatura is not None:
        existente = (
            db.query(models.Empresa)
            .filter(models.Empresa.colegiatura == payload.colegiatura)
            .first()
        )
        if existente is not None:
            raise HTTPException(status_code=400, detail="Ya existe un consultor con ese CIP")

    empresa = models.Empresa(**payload.model_dump())
    db.add(empresa)
    db.commit()
    db.refresh(empresa)
    return empresa


@router.put("/empresas/{empresa_id}", response_model=schemas.EmpresaOut)
def actualizar_empresa(
    empresa_id: int,
    payload: schemas.EmpresaUpdate,
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if empresa is None:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    for campo, valor in payload.model_dump().items():
        setattr(empresa, campo, valor)
    db.commit()
    db.refresh(empresa)
    return empresa


@router.delete("/empresas/{empresa_id}", response_model=schemas.EmpresaOut)
def desactivar_empresa(
    empresa_id: int,
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    """Desactiva (no borra): útil para ocultarla temporalmente sin perder
    sus datos. Para borrarla de verdad, ver eliminar_empresa()."""
    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if empresa is None:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    empresa.activa = False
    db.commit()
    db.refresh(empresa)
    return empresa


@router.delete("/empresas/{empresa_id}/eliminar", status_code=204)
def eliminar_empresa(
    empresa_id: int,
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    """Borra la empresa/consultor definitivamente (no reversible). A
    diferencia de desactivar_empresa(), esto sí quita la fila de la BD."""
    empresa = db.query(models.Empresa).filter(models.Empresa.id == empresa_id).first()
    if empresa is None:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    if empresa.cv_filename:
        ruta = UPLOADS_DIR / empresa.cv_filename
        if ruta.exists():
            ruta.unlink()

    db.delete(empresa)
    db.commit()

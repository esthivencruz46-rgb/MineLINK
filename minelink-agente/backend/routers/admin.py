from collections import Counter
from datetime import date, datetime, time, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import or_
from sqlalchemy.orm import Session

import models
import schemas
from auth import authenticate_admin, create_access_token, get_current_admin, hash_password
from database import get_db
from security import limitar_intentos_login
from scoring import (
    categorias_requeridas_out,
    estado_seguimiento,
    respuestas_diagnostico_efectivas,
)
from catalogo_inversion import alertas_inversion, categorias_requeridas_inversion
from notificaciones import crear_notificacion
import storage

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
    situacion: Optional[str] = None,
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
    if situacion:
        query = query.filter(models.Operacion.situacion == situacion)

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
            estado_contacto=lead.estado_contacto or "buscando",
            situacion=operacion.situacion or "minero_artesanal",
            estado_formalizacion=operacion.estado_formalizacion,
            estado_operacion=operacion.estado_operacion,
            tipo_explotacion=operacion.tipo_explotacion,
            material_comercializado=operacion.material_comercializado,
            forma_comercializacion=operacion.forma_comercializacion,
            tiempo_operacion=operacion.tiempo_operacion,
            ley_promedio=operacion.ley_promedio,
            ley_como_obtenida=operacion.ley_como_obtenida,
            especie_mineral=operacion.especie_mineral,
            num_trabajadores=operacion.num_trabajadores,
            maquinaria=operacion.maquinaria,
            tiene_resultados_laboratorio=operacion.tiene_resultados_laboratorio,
            modalidad_trabajadores=operacion.modalidad_trabajadores,
            provincia=operacion.provincia,
            sustancias_toxicas=operacion.sustancias_toxicas,
            gestion_sustancias=operacion.gestion_sustancias,
            incidentes_previos=operacion.incidentes_previos,
            permisos_comunitarios=operacion.permisos_comunitarios,
            acceso_logistico=operacion.acceso_logistico,
            experiencia_operador=operacion.experiencia_operador,
            capacitacion_operador=operacion.capacitacion_operador,
            documentacion_disponible=operacion.documentacion_disponible,
            plan_formalizacion=operacion.plan_formalizacion,
            prioridad_crecimiento=operacion.prioridad_crecimiento,
            concesion_vigente=operacion.concesion_vigente,
            tipo_deposito=operacion.tipo_deposito,
            etapa_proyecto=operacion.etapa_proyecto,
            trabajos_exploracion_json=operacion.trabajos_exploracion_json,
            info_geologica_disponible=operacion.info_geologica_disponible,
            tiene_estimaciones_leyes=operacion.tiene_estimaciones_leyes,
            pagos_vigencia_al_dia=operacion.pagos_vigencia_al_dia,
            toneladas_estimadas=operacion.toneladas_estimadas,
            ley_esperada=operacion.ley_esperada,
            capital_disponible=operacion.capital_disponible,
            estudio_previo=operacion.estudio_previo,
            historial_operacion=operacion.historial_operacion,
            pasivos_ambientales=operacion.pasivos_ambientales,
            experiencia_titular=operacion.experiencia_titular,
            background_titular=operacion.background_titular,
            equipo_tecnico=operacion.equipo_tecnico,
            tipo_socio_buscado=operacion.tipo_socio_buscado,
            siguiente_hito=operacion.siguiente_hito,
            timeline_operacion=operacion.timeline_operacion,
            motivo_inicio=operacion.motivo_inicio,
            documento_autorizacion=operacion.documento_autorizacion,
            tipo_apoyo_json=operacion.tipo_apoyo_json,
            tipo_apoyo=operacion.tipo_apoyo,
            acceso_agua=operacion.acceso_agua,
            acceso_energia=operacion.acceso_energia,
            conflictividad_social=operacion.conflictividad_social,
            estructura_propiedad=operacion.estructura_propiedad,
            moneda_capital=operacion.moneda_capital,
            monto_requerido=operacion.monto_requerido,
            plazo_capital=operacion.plazo_capital,
            motivo_capital=operacion.motivo_capital,
            produccion_objetivo=operacion.produccion_objetivo,
            uso_fondos_diagnostico=operacion.uso_fondos_diagnostico,
            documentos_enviados=operacion.documentos_enviados_en is not None,
            **estado_seguimiento(operacion),
        )
        for lead, operacion in filas
    ]


@router.post("/leads/{lead_id}/resetear-password", status_code=200)
def resetear_password_minero(
    lead_id: int,
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    """Genera una contraseña temporal para el minero que olvidó la suya.
    Se muestra UNA sola vez al admin, quien se la envía por WhatsApp; el
    minero puede seguir usándola o pedir otro reseteo cuando quiera."""
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if lead is None:
        raise HTTPException(status_code=404, detail="Lead no encontrado")
    if not lead.username:
        raise HTTPException(status_code=422, detail="Este lead no tiene cuenta creada")

    # Legible para dictar por teléfono: sin caracteres confusos (0/O, 1/l)
    import secrets as _secrets

    alfabeto = "abcdefghjkmnpqrstuvwxyz23456789"
    password_temporal = "".join(_secrets.choice(alfabeto) for _ in range(8))
    lead.password_hash = hash_password(password_temporal)
    db.commit()
    return {
        "username": lead.username,
        "password_temporal": password_temporal,
        "whatsapp": lead.whatsapp,
    }


@router.put("/leads/{lead_id}/estado-contacto", status_code=200)
def actualizar_estado_contacto(
    lead_id: int,
    payload: schemas.ActualizarEstadoContactoRequest,
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    """Marca si ya se contactó al minero por WhatsApp ("contactado") o si
    sigue en cola ("buscando"). El minero lo ve en /mi-cuenta."""
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if lead is None:
        raise HTTPException(status_code=404, detail="Lead no encontrado")
    lead.estado_contacto = payload.estado_contacto
    db.commit()
    return {"id": lead.id, "estado_contacto": lead.estado_contacto}


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
    notificaciones = (
        db.query(models.Notificacion).filter(models.Notificacion.lead_id == lead_id).all()
    )
    for notificacion in notificaciones:
        db.delete(notificacion)
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
                storage.eliminar("documentos_mineros", documento.filename)
                db.delete(documento)
            intereses = (
                db.query(models.InteresInversion)
                .filter(models.InteresInversion.operacion_id == operacion_id)
                .all()
            )
            for interes in intereses:
                db.delete(interes)
            intereses_empresa = (
                db.query(models.InteresEmpresa)
                .filter(models.InteresEmpresa.operacion_id == operacion_id)
                .all()
            )
            for interes in intereses_empresa:
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

    diagnosticos_iniciados = (
        db.query(models.Evento)
        .filter(models.Evento.tipo == "diagnostico_iniciado")
        .count()
    )

    return schemas.DashboardOut(
        diagnosticos_hoy=diagnosticos_hoy,
        diagnosticos_total=diagnosticos_total,
        leads_hoy=leads_hoy,
        leads_total=leads_total,
        score_promedio=score_promedio,
        top_brechas=top_brechas,
        ultimos_leads=ultimos_leads,
        diagnosticos_iniciados=diagnosticos_iniciados,
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

    contenido = storage.leer("cvs", empresa.cv_filename)
    if contenido is None:
        raise HTTPException(status_code=404, detail="El archivo del CV no se encuentra")

    return Response(
        content=contenido,
        media_type="application/pdf",
        headers={
            "Content-Disposition": storage.content_disposition(
                "attachment", f"CV_{empresa.nombre}.pdf"
            )
        },
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

    contenido = storage.leer("documentos_mineros", documento.filename)
    if contenido is None:
        raise HTTPException(status_code=404, detail="El archivo no se encuentra")

    return Response(
        content=contenido,
        media_type=documento.content_type,
        headers={
            "Content-Disposition": storage.content_disposition(
                "inline", documento.nombre_original
            )
        },
    )


@router.put(
    "/documentos/{documento_id}/revision",
    response_model=schemas.DocumentoOperacionOut,
)
def revisar_documento(
    documento_id: int,
    payload: schemas.RevisarDocumentoRequest,
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    """Esthiven aprueba o rechaza (con motivo) un documento puntual que el
    minero subió. Un rechazo NO borra el archivo — el minero lo ve con el
    motivo en su cuenta y decide si lo elimina y sube uno corregido."""
    documento = (
        db.query(models.DocumentoOperacion)
        .filter(models.DocumentoOperacion.id == documento_id)
        .first()
    )
    if documento is None:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    documento.estado_revision = payload.estado_revision
    documento.motivo_rechazo = (
        payload.motivo_rechazo if payload.estado_revision == "rechazado" else None
    )
    documento.revisado_en = datetime.now(timezone.utc)

    if payload.estado_revision == "rechazado":
        lead = (
            db.query(models.Lead)
            .filter(models.Lead.operacion_id == documento.operacion_id)
            .first()
        )
        if lead is not None:
            etiqueta = categorias_requeridas_out(
                documento.operacion, [documento.categoria]
            )[0]["etiqueta"]
            crear_notificacion(
                db,
                lead.id,
                "documento_rechazado",
                f"Tu documento \"{etiqueta}\" fue rechazado: {payload.motivo_rechazo}",
            )

    db.commit()
    db.refresh(documento)
    return documento


@router.get(
    "/operaciones/{operacion_id}/inversion",
    response_model=schemas.InversionAdminOut,
)
def ver_inversion(
    operacion_id: str,
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    """Respuestas del Módulo INV + alertas de consistencia AL1-AL8 +
    documentos de sustento requeridos — solo informativo (ej. para
    contactar al minero si algo se ve raro). La publicación en la cartera
    es automática al enviarse; Esthiven ya no aprueba manualmente."""
    operacion = db.query(models.Operacion).filter(models.Operacion.id == operacion_id).first()
    if operacion is None:
        raise HTTPException(status_code=404, detail="Operación no encontrada")

    perfil = operacion.estado_formalizacion
    respuestas_inv = operacion.inv_respuestas_json or {}
    return schemas.InversionAdminOut(
        respuestas=respuestas_inv,
        enviado=operacion.inv_enviado_en is not None,
        alertas=alertas_inversion(
            perfil, respuestas_diagnostico_efectivas(operacion), respuestas_inv
        ),
        categorias_requeridas=categorias_requeridas_out(
            operacion, categorias_requeridas_inversion(perfil, respuestas_inv)
        ),
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


@router.get(
    "/operaciones/{operacion_id}/intereses-empresas",
    response_model=list[schemas.InteresEmpresaOut],
)
def listar_intereses_empresa(
    operacion_id: str,
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    """Empresas/consultores en los que el minero marcó "Me interesa" desde
    /empresas (reemplaza el link directo a WhatsApp). Esthiven ve el
    contacto del minero y el de la empresa aquí, y es quien intermedia."""
    operacion = db.query(models.Operacion).filter(models.Operacion.id == operacion_id).first()
    if operacion is None:
        raise HTTPException(status_code=404, detail="Operación no encontrada")

    filas = (
        db.query(models.InteresEmpresa, models.Empresa)
        .join(models.Empresa, models.InteresEmpresa.empresa_id == models.Empresa.id)
        .filter(models.InteresEmpresa.operacion_id == operacion_id)
        .order_by(models.InteresEmpresa.created_at.desc())
        .all()
    )
    return [
        schemas.InteresEmpresaOut(
            id=interes.id,
            operacion_id=interes.operacion_id,
            empresa_id=empresa.id,
            empresa_nombre=empresa.nombre,
            empresa_whatsapp=empresa.whatsapp,
            nombre=interes.nombre,
            whatsapp=interes.whatsapp,
            brecha=interes.brecha,
            mensaje=interes.mensaje,
            estado_contacto=interes.estado_contacto,
            created_at=interes.created_at,
        )
        for interes, empresa in filas
    ]


@router.put("/intereses-empresas/{interes_id}/estado-contacto", status_code=200)
def actualizar_estado_contacto_interes_empresa(
    interes_id: int,
    payload: schemas.ActualizarEstadoContactoRequest,
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    """Marca si Esthiven ya le escribió a la empresa por este interés
    puntual ("contactado") o si sigue en cola ("buscando")."""
    interes = (
        db.query(models.InteresEmpresa).filter(models.InteresEmpresa.id == interes_id).first()
    )
    if interes is None:
        raise HTTPException(status_code=404, detail="Interés no encontrado")
    interes.estado_contacto = payload.estado_contacto
    db.commit()
    return {"id": interes.id, "estado_contacto": interes.estado_contacto}


@router.post("/empresas/importar", status_code=200)
async def importar_empresas(
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    _admin: str = Depends(get_current_admin),
):
    """Importa empresas/consultores en lote desde un archivo CSV (la base
    de datos externa de profesionales). Columnas esperadas (con encabezado):
    tipo,nombre,ruc,colegiatura,anios_servicio,regiones,estudios,whatsapp,
    email,rating,num_resenas — regiones y estudios separados por ';'.
    Los duplicados (mismo RUC, colegiatura o nombre+whatsapp) se saltan."""
    import csv
    import io

    crudo = await archivo.read()
    try:
        texto = crudo.decode("utf-8-sig")
    except UnicodeDecodeError:
        texto = crudo.decode("latin-1")

    # Detectar si Excel exportó con ';' en vez de ','
    primera_linea = texto.splitlines()[0] if texto.splitlines() else ""
    delimitador = ";" if primera_linea.count(";") > primera_linea.count(",") else ","
    filas = list(csv.DictReader(io.StringIO(texto), delimiter=delimitador))
    if not filas:
        raise HTTPException(422, "El archivo está vacío o no tiene encabezados")

    creadas, saltadas, errores = 0, 0, []
    for numero, fila in enumerate(filas, start=2):  # 2 = primera fila de datos
        try:
            fila = {(k or "").strip().lower(): (v or "").strip() for k, v in fila.items()}
            nombre = fila.get("nombre", "")
            if not nombre:
                raise ValueError("falta el nombre")

            ruc = fila.get("ruc") or None
            # Normalizadas ANTES del chequeo de duplicados, para que "CIP 123"
            # y "123" (o "+51 9..." y "+519...") cuenten como el mismo registro
            colegiatura = fila.get("colegiatura") or None
            if colegiatura:
                colegiatura = schemas.normalizar_colegiatura(colegiatura)
            whatsapp = schemas.normalizar_whatsapp(fila.get("whatsapp", ""))

            condiciones = [
                (models.Empresa.nombre == nombre) & (models.Empresa.whatsapp == whatsapp)
            ]
            if ruc:
                condiciones.append(models.Empresa.ruc == ruc)
            if colegiatura:
                condiciones.append(models.Empresa.colegiatura == colegiatura)
            ya_existe = db.query(models.Empresa).filter(or_(*condiciones)).first()
            if ya_existe is not None:
                saltadas += 1
                continue

            datos = schemas.EmpresaCreate(
                tipo=fila.get("tipo") or "empresa",
                nombre=nombre,
                ruc=ruc,
                colegiatura=colegiatura,
                anios_servicio=int(fila.get("anios_servicio") or 0),
                regiones_json=[r.strip().lower() for r in fila.get("regiones", "").split(";") if r.strip()],
                estudios_json=[e.strip().lower() for e in fila.get("estudios", "").split(";") if e.strip()],
                whatsapp=whatsapp,
                email=fila.get("email") or None,
                rating=float(fila["rating"].replace(",", ".")) if fila.get("rating") else None,
                num_resenas=int(fila["num_resenas"]) if fila.get("num_resenas") else None,
                activa=True,
            )
            db.add(models.Empresa(**datos.model_dump()))
            db.flush()
            creadas += 1
        except Exception as e:
            errores.append(f"fila {numero}: {e}")

    db.commit()
    return {"creadas": creadas, "saltadas": saltadas, "errores": errores}


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
        storage.eliminar("cvs", empresa.cv_filename)

    db.delete(empresa)
    db.commit()

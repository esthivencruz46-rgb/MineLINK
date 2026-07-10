from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

import models
import schemas
import storage
from auth import hash_password
from database import get_db
from scoring import ESTUDIO_POR_PREGUNTA, calcular_score_inversion, estado_seguimiento, ids_esperados_para
from uploads_config import CATEGORIAS_DOCUMENTO, CATEGORIAS_ESTUDIO, categoria_equivalente

router = APIRouter(prefix="/proyectos", tags=["proyectos"])

CATEGORIAS_LEGALES = [c for c in CATEGORIAS_DOCUMENTO if c != "fotos_mina"]
# Categorías que se sirven vía /documentos/{id} (foto pública de respaldo):
# los 5 documentos legales fijos + cualquier estudio del catálogo.
CATEGORIAS_DOCUMENTOS_PUBLICOS = [*CATEGORIAS_LEGALES, *CATEGORIAS_ESTUDIO]


def _nombre_proyecto(lead: models.Lead, operacion: models.Operacion) -> str:
    return lead.nombre_operacion or f"Proyecto minero en {operacion.region.title()}"


def _proyectos_visibles(db: Session):
    """Todas las operaciones con cuenta registrada (Lead). REINFO/trámite de
    formalización YA NO es requisito para aparecer en la vitrina pública —
    `Operacion.bloqueado` sigue calculándose (se muestra al minero como
    estado informativo) pero no filtra este listado."""
    filas = (
        db.query(models.Lead, models.Operacion)
        .join(models.Operacion, models.Lead.operacion_id == models.Operacion.id)
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
    score_inversion = calcular_score_inversion(operacion, seguimiento["score_actual"])
    return schemas.ProyectoPublicoOut(
        operacion_id=operacion.id,
        nombre_proyecto=_nombre_proyecto(lead, operacion),
        region=operacion.region,
        mineral=operacion.mineral,
        tipo_mina=operacion.tipo_mina,
        situacion=operacion.situacion,
        score_actual=seguimiento["score_actual"],
        score_inversion=score_inversion["score_total"],
        bloqueado_actual=seguimiento["bloqueado_actual"],
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
    n_fotos: int,
    n_docs_legales: int,
) -> str:
    """Redacta la descripción pública del proyecto (bloque "Información
    General") a partir de los datos REALES de la operación — nunca inventa
    cifras, y nunca repite lo que ya se muestra en el "Resumen Ejecutivo"
    (MineScore, capital buscado, uso de fondos: ver `_resumen_ejecutivo`).
    Si un dato no existe, simplemente no se menciona."""
    if operacion.situacion == "concesionario":
        partes = [
            f"Proyecto minero de {operacion.mineral.lower()} en etapa de "
            f"concesión, ubicado en {operacion.region.title()}."
        ]
    else:
        tipo_legible = "subterránea" if operacion.tipo_mina == "subterranea" else "a tajo abierto"
        partes = [
            f"Operación minera de {operacion.mineral.lower()} {tipo_legible} "
            f"ubicada en {operacion.region.title()}"
            + (", registrada en REINFO." if not operacion.bloqueado else ".")
        ]

    if operacion.tiempo_operacion:
        partes.append(f"Tiempo de operación: {operacion.tiempo_operacion}.")

    if lead.capacidad_produccion:
        partes.append(f"Producción y reservas declaradas: {lead.capacidad_produccion.strip()}.")

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
        .filter(models.Operacion.id == operacion_id)
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
    documentos_legales: dict[str, list[schemas.FotoPublicaOut]] = {c: [] for c in CATEGORIAS_LEGALES}
    documentos_estudios: dict[str, list[schemas.FotoPublicaOut]] = {c: [] for c in CATEGORIAS_ESTUDIO}
    for d in documentos:
        if d.categoria in documentos_legales:
            documentos_legales[d.categoria].append(
                schemas.FotoPublicaOut(id=d.id, url=f"/proyectos/{operacion_id}/documentos/{d.id}")
            )
        elif d.categoria in documentos_estudios:
            documentos_estudios[d.categoria].append(
                schemas.FotoPublicaOut(id=d.id, url=f"/proyectos/{operacion_id}/documentos/{d.id}")
            )

    # Varios estudios se subieron bajo una categoría equivalente en vez de
    # la propia (ver uploads_config.categoria_equivalente) — para que su
    # miniatura se vea igual en "Documentación Técnica", se completan acá.
    situacion_equiv = operacion.situacion or "minero_artesanal"
    for estudio in documentos_estudios:
        if documentos_estudios[estudio]:
            continue
        equivalente = categoria_equivalente(estudio, situacion_equiv)
        if equivalente is None or equivalente == estudio:
            continue
        documentos_estudios[estudio] = list(
            documentos_legales.get(equivalente) or documentos_estudios.get(equivalente) or []
        )

    seguimiento = estado_seguimiento(operacion)
    n_docs_legales = sum(1 for presentado in documentos_presentados.values() if presentado)
    score_inversion = calcular_score_inversion(operacion, seguimiento["score_actual"])
    # El diagnóstico es autodeclarado — el minero puede responder "sí" a
    # todo sin sustento, y eso NUNCA queda en brechas_json/brechas_resueltas
    # (solo las respuestas "no" originales generan una brecha ahí). Para
    # saber si un estudio "está bien" hay que mirar el set completo de
    # estudios aplicables a esta ruta y ver cuáles NO están pendientes
    # (o sea: se respondió "sí", o un "no" que el admin marcó resuelto) —
    # y de esos, solo cuentan como verificados (check ✓ público) los que
    # además tienen foto de respaldo subida.
    perfil_situacion = {"sustancias_toxicas": operacion.sustancias_toxicas}
    situacion = operacion.situacion or "minero_artesanal"
    ids_aplicables = ids_esperados_para(operacion.tipo_mina, situacion, perfil_situacion)
    estudios_aplicables = {ESTUDIO_POR_PREGUNTA[i] for i in ids_aplicables}
    pendientes = set(seguimiento["brechas_pendientes"])

    def _tiene_respaldo(estudio: str) -> bool:
        if estudio in categorias_presentadas:
            return True
        equivalente = categoria_equivalente(estudio, situacion)
        return equivalente is not None and equivalente in categorias_presentadas

    brechas_verificadas = sorted(
        e for e in estudios_aplicables if e not in pendientes and _tiene_respaldo(e)
    )

    return schemas.ProyectoDetalleOut(
        **base.model_dump(),
        fotos=fotos,
        documentos_presentados=documentos_presentados,
        documentos_legales=documentos_legales,
        documentos_estudios=documentos_estudios,
        brechas_pendientes=seguimiento["brechas_pendientes"],
        brechas_resueltas=seguimiento["brechas_resueltas"],
        brechas_verificadas=brechas_verificadas,
        dimensiones=seguimiento["dimensiones"],
        dimensiones_inversion=score_inversion["dimensiones"],
        ubicacion_maps=lead.ubicacion_maps,
        ubicacion_coords=lead.ubicacion_coords,
        descripcion_generada=_generar_descripcion(
            lead, operacion, len(fotos), n_docs_legales
        ),
        # Perfil informativo del diagnóstico (Fase 1) — visible al
        # inversionista, nunca datos de contacto.
        tiempo_operacion=operacion.tiempo_operacion,
        ley_promedio=operacion.ley_promedio,
        ley_como_obtenida=operacion.ley_como_obtenida,
        especie_mineral=operacion.especie_mineral,
        tiene_resultados_laboratorio=operacion.tiene_resultados_laboratorio,
        num_trabajadores=operacion.num_trabajadores,
        modalidad_trabajadores=operacion.modalidad_trabajadores,
        maquinaria=operacion.maquinaria,
        provincia=operacion.provincia,
        sustancias_toxicas=operacion.sustancias_toxicas,
        gestion_sustancias=operacion.gestion_sustancias,
        acceso_agua=operacion.acceso_agua,
        acceso_energia=operacion.acceso_energia,
        tipo_apoyo=operacion.tipo_apoyo,
        moneda_capital=operacion.moneda_capital,
        monto_requerido=operacion.monto_requerido,
        plazo_capital=operacion.plazo_capital,
        uso_fondos_diagnostico=operacion.uso_fondos_diagnostico,
        motivo_capital=operacion.motivo_capital,
        produccion_objetivo=operacion.produccion_objetivo,
        incidentes_previos=operacion.incidentes_previos,
        conflictividad_social=operacion.conflictividad_social,
        permisos_comunitarios=operacion.permisos_comunitarios,
        acceso_logistico=operacion.acceso_logistico,
        experiencia_operador=operacion.experiencia_operador,
        capacitacion_operador=operacion.capacitacion_operador,
        documentacion_disponible=operacion.documentacion_disponible,
        estructura_propiedad=operacion.estructura_propiedad,
        plan_formalizacion=operacion.plan_formalizacion,
        prioridad_crecimiento=operacion.prioridad_crecimiento,
        concesion_vigente=operacion.concesion_vigente,
        pagos_vigencia_al_dia=operacion.pagos_vigencia_al_dia,
        tipo_deposito=operacion.tipo_deposito,
        toneladas_estimadas=operacion.toneladas_estimadas,
        ley_esperada=operacion.ley_esperada,
        etapa_proyecto=operacion.etapa_proyecto,
        trabajos_exploracion_json=operacion.trabajos_exploracion_json,
        info_geologica_disponible=operacion.info_geologica_disponible,
        tiene_estimaciones_leyes=operacion.tiene_estimaciones_leyes,
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
        pregunta_seguridad=payload.pregunta_seguridad,
        respuesta_seguridad_hash=hash_password(payload.respuesta_seguridad),
    )
    db.add(interes)
    db.commit()
    db.refresh(interes)
    return interes


@router.get("/{operacion_id}/fotos/{documento_id}")
def foto_proyecto(operacion_id: str, documento_id: int, db: Session = Depends(get_db)):
    """Sirve SOLO fotos de la mina (categoría fotos_mina)."""
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


@router.get("/{operacion_id}/documentos/{documento_id}")
def foto_documento_legal(operacion_id: str, documento_id: int, db: Session = Depends(get_db)):
    """Sirve la foto de un documento legal (informe de leyes, catastro,
    RUC, contrato, título de concesión) o de un estudio de respaldo
    ("Respalda tu declaración") que el minero eligió mostrar en la
    vitrina pública del proyecto. Siempre es una foto — los PDFs
    subidos se convierten a imagen al momento de subirlos, nunca se
    guarda ni se sirve un PDF crudo."""
    _lead_y_operacion_visibles(db, operacion_id)

    documento = (
        db.query(models.DocumentoOperacion)
        .filter(
            models.DocumentoOperacion.id == documento_id,
            models.DocumentoOperacion.operacion_id == operacion_id,
            models.DocumentoOperacion.categoria.in_(CATEGORIAS_DOCUMENTOS_PUBLICOS),
        )
        .first()
    )
    if documento is None:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    contenido = storage.leer("documentos_mineros", documento.filename)
    if contenido is None:
        raise HTTPException(status_code=404, detail="El archivo no se encuentra")

    return Response(content=contenido, media_type=documento.content_type)

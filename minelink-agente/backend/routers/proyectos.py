from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

import database
import geocatmin
import models
import reinfo
import schemas
import storage
from auth import hash_password
from database import get_db
from routers.mineros import _es_titular_concesion, reparar_ubicacion_coords
from scoring import estado_seguimiento, score_formalizacion, score_inversion
from catalogo_diagnostico import ids_esperados, BRECHA_POR_PREGUNTA
from uploads_config import CATEGORIAS_DOCUMENTO, CATEGORIAS_ESTUDIO, CATEGORIAS_FOTO_PERFIL, categoria_equivalente

router = APIRouter(prefix="/proyectos", tags=["proyectos"])

CATEGORIAS_LEGALES = [c for c in CATEGORIAS_DOCUMENTO if c != "fotos_mina"]
# Categorías que se sirven vía /documentos/{id} (foto pública de respaldo):
# los 5 documentos legales fijos + cualquier estudio del catálogo.
CATEGORIAS_DOCUMENTOS_PUBLICOS = [*CATEGORIAS_LEGALES, *CATEGORIAS_ESTUDIO]
# Categorías que forman la galería principal ("Fotos de tu operación" en la
# cuenta del minero): fotos de la mina + las condicionadas al perfil
# (mineral, camino de acceso, agua, energía) — antes solo se mostraban las
# de fotos_mina, dejando invisibles públicamente fotos que el minero sí
# había subido (julio 2026).
CATEGORIAS_GALERIA = [
    "fotos_mina",
    *CATEGORIAS_FOTO_PERFIL,
    # Fotos del Módulo INV SIN personas (julio 2026): maquinaria, muestreo,
    # labores antiguas, área del petitorio. Las fotos de TRABAJADORES se
    # quedan privadas a propósito — derecho a la imagen de terceros que no
    # dieron consentimiento; públicamente solo se muestra el número.
    "fotos_equipo_maquinaria",
    "muestreo_propio",
    "fotos_labores_antiguas",
    "fotos_area_petitorio",
    # Fotos de presentación (mina desde afuera, concesión) de perfiles C/D
    # ya operando — es justamente lo que se busca mostrar al inversionista.
    "fotos_presentacion",
]
# Respuestas del Módulo INV públicas en la ficha del proyecto (julio 2026):
# los datos de DECISIÓN del inversionista — capital, uso, qué ofrece/aporta,
# plazo de retorno, estructura legal, % a ceder y deudas declaradas. El
# historial de negociaciones (INV_0_6/0_7) y los bloques por perfil NO se
# publican (contexto privado de la intermediación del admin).
IDS_INV_PUBLICOS = frozenset(
    ["INV_0_1", "INV_0_2", "INV_0_3", "INV_0_4", "INV_0_5", "INV_0_9", "INV_0_10", "INV_0_11"]
)


def _nombre_proyecto(lead: models.Lead, operacion: models.Operacion) -> str:
    return lead.nombre_operacion or f"Proyecto minero en {operacion.region.title()}"


# Credencial que PRUEBA que el proyecto existe, por perfil (julio 2026):
# la foto del documento que ampara la etapa — autorización DREM/GREM para
# un formal pleno, título de concesión para un concesionario. Se muestra
# como mini-imagen en la tarjeta de la cartera (nunca es un PDF: todo se
# convierte a foto de su primera hoja al subirse). Orden = prioridad.
_CREDENCIAL_POR_PERFIL: dict[str, list[str]] = {
    "D": ["autorizacion_drem", "titulo_concesion"],
    "C": ["titulo_concesion", "contrato_explotacion"],
    "B": ["titulo_concesion"],
}
_ETIQUETA_CREDENCIAL = {
    "autorizacion_drem": "Autorización DREM/GREM",
    "titulo_concesion": "Título de concesión",
    "contrato_explotacion": "Contrato de explotación",
}


def _credencial_publica(operacion: models.Operacion, perfil: Optional[str]):
    """(url, etiqueta) de la foto de la credencial del perfil, o (None, None)
    si todavía no la subió. Usa el mismo endpoint público que ya sirve los
    documentos legales de la ficha."""
    prioridades = _CREDENCIAL_POR_PERFIL.get(perfil or "", [])
    docs = operacion.documentos or []
    for categoria in prioridades:
        doc = next((d for d in docs if d.categoria == categoria), None)
        if doc is not None:
            return (
                f"/proyectos/{operacion.id}/documentos/{doc.id}",
                _ETIQUETA_CREDENCIAL[categoria],
            )
    return None, None


_MESES_ES = (
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
)


def _indicadores_verificados(operacion: models.Operacion) -> schemas.IndicadoresVerificadosOut:
    """Señales públicas derivadas de los documentos PRIVADOS del Módulo
    INV: existencia/cantidad/fecha del respaldo, nunca su contenido (ver
    IndicadoresVerificadosOut). Un ✓ solo aparece con archivo subido —
    mismo criterio de evidencia que brechas_verificadas."""
    r = operacion.inv_respuestas_json or {}
    datos = operacion.datos_formalizacion_json or {}
    docs = operacion.documentos or []

    liquidaciones = [d for d in docs if d.categoria == "liquidaciones_venta"]
    declara_ventas = (
        r.get("INV_B2") == "si_registros"
        or r.get("INV_C2") in ("completas", "parciales")
        or r.get("INV_D2") in ("mas_12m", "6_12m", "menos_6m")
    )
    ultima = None
    if liquidaciones:
        reciente = max(d.created_at for d in liquidaciones if d.created_at)
        ultima = f"{_MESES_ES[reciente.month - 1]} {reciente.year}"

    contabilidad = r.get("INV_D1") if r.get("INV_D1") in (
        "auditados", "contabilidad_formal", "registro_interno"
    ) else None
    tiene_financieros = any(d.categoria == "estados_financieros_libros" for d in docs)

    tiene_opex = any(d.categoria == "registro_opex" for d in docs)

    return schemas.IndicadoresVerificadosOut(
        ventas_liquidacion_verificada=bool(declara_ventas and liquidaciones),
        ventas_liquidacion_docs=len(liquidaciones),
        ventas_liquidacion_ultima=ultima,
        contabilidad=contabilidad,
        contabilidad_verificada=bool(contabilidad and tiene_financieros),
        opex_verificado=bool(r.get("INV_C4") == "detallado" and tiene_opex),
        opex_costo_aprox=datos.get("registro_opex") or None,
        num_trabajadores=datos.get("fotos_trabajadores") or None,
        maquinaria=datos.get("fotos_equipo_maquinaria") or None,
    )


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
    seguimiento: dict,
    foto_portada_url: Optional[str] = None,
) -> schemas.ProyectoPublicoOut:
    """Tarjeta pública del proyecto según el spec: Track Legal (semáforo),
    Madurez técnica 0-5, avance documentario (perfil C) y si vende con
    liquidación — SIN scores 0-100 (retirados en julio 2026)."""
    respuestas = operacion.respuestas_json or {}
    urgencia = seguimiento.get("urgencia")
    credencial_url, credencial_etiqueta = _credencial_publica(
        operacion, seguimiento.get("perfil")
    )
    return schemas.ProyectoPublicoOut(
        operacion_id=operacion.id,
        nombre_proyecto=_nombre_proyecto(lead, operacion),
        region=operacion.region,
        mineral=operacion.mineral,
        tipo_mina=operacion.tipo_mina,
        situacion=operacion.situacion,
        estado_formalizacion=operacion.estado_formalizacion,
        perfil=seguimiento.get("perfil"),
        semaforo_legal=seguimiento.get("semaforo_legal"),
        semaforo_tecnico=seguimiento.get("semaforo_tecnico"),
        indice_madurez=seguimiento.get("indice_madurez"),
        docs_completados=urgencia.get("docs_completados") if urgencia else None,
        docs_totales=urgencia.get("docs_totales") if urgencia else None,
        vende_liquidacion=(respuestas.get("C4_2") == "siempre") if respuestas.get("C4_2") else None,
        score_formalizacion=score_formalizacion(operacion),
        score_inversion=score_inversion(operacion, lead),
        ventas_verificadas=_indicadores_verificados(operacion).ventas_liquidacion_verificada,
        credencial_url=credencial_url,
        credencial_etiqueta=credencial_etiqueta,
        bloqueado_actual=not seguimiento.get("apto_inversionistas", False),
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
    """Vitrina pública. REGLA DE BLOQUEO del spec (prioridad de experto):
    nunca mostrar a inversionistas un proyecto con incendio legal activo
    (semáforo rojo: caducidad, REINFO suspendido, plazo crítico), ni
    perfiles sin proyecto publicable (A / sin clasificar / modelo viejo).
    Se recalcula al vuelo porque la urgencia del plazo REINFO cambia con
    el paso del tiempo."""
    filas = _proyectos_visibles(db)

    visibles = []
    for lead, operacion in filas:
        if mineral and mineral.strip().lower() not in operacion.mineral.lower():
            continue
        if region and operacion.region.lower() != region.strip().lower():
            continue
        seguimiento = estado_seguimiento(operacion)
        if not seguimiento.get("apto_inversionistas"):
            continue
        visibles.append((lead, operacion, seguimiento))

    portadas = _fotos_portada(db, [o.id for _l, o, _s in visibles])
    return [
        _proyecto_publico_out(lead, operacion, seguimiento, portadas.get(operacion.id))
        for lead, operacion, seguimiento in visibles
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
    # `estado_formalizacion` guarda el perfil del pipeline (B/C/D — A y
    # A_avanzado nunca llegan a la vitrina).
    perfil = operacion.estado_formalizacion or ""
    if perfil == "B":
        partes = [
            f"Proyecto minero de {operacion.mineral.lower()} con concesión "
            f"titulada, en preparación para operar, ubicado en {operacion.region.title()}."
        ]
    elif perfil == "D":
        partes = [
            f"Operación minera de {operacion.mineral.lower()} formalizada con "
            f"autorización de la DREM/GREM, ubicada en {operacion.region.title()}."
        ]
    elif perfil == "C":
        partes = [
            f"Operación minera de {operacion.mineral.lower()} con REINFO, en "
            f"proceso de formalización, ubicada en {operacion.region.title()}."
        ]
    else:
        partes = [
            f"Proyecto minero de {operacion.mineral.lower()} ubicado en "
            f"{operacion.region.title()}."
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
    """Usada por la ficha individual, dejar interés, y ver fotos/documentos
    — repite la MISMA regla de bloqueo que ya aplica `listar_proyectos()`
    (nunca mostrar a inversionistas un proyecto con incendio legal activo,
    perfil A, o que aún no envió ambas partes). Antes solo se verificaba
    que el Lead+Operacion existieran: un link directo a un proyecto que
    dejó de ser apto (o nunca lo fue) seguía abriendo su ficha completa,
    aunque ya no apareciera en la lista (julio 2026, hallazgo de
    auditoría). 404 en vez de 403 — no confirma si el proyecto existe."""
    fila = (
        db.query(models.Lead, models.Operacion)
        .join(models.Operacion, models.Lead.operacion_id == models.Operacion.id)
        .filter(models.Operacion.id == operacion_id)
        .first()
    )
    if fila is None:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    lead, operacion = fila
    if not estado_seguimiento(operacion).get("apto_inversionistas"):
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    return fila


# GEOCATMIN/REINFO son best-effort pero antes se consultaban EN VIVO,
# dentro de la misma petición HTTP — hasta 11 llamadas seguidas a
# servidores lentos del Estado (INGEMMET, SERNANP, MINEM) antes de que el
# inversionista viera la ficha (julio 2026, reportado como "se demora un
# montón"). Ahora la respuesta SIEMPRE usa lo que ya haya en caché al
# instante (None la primera vez, nunca espera a la red) y, si el caché
# falta o venció, el refresco real se agenda con BackgroundTasks.
#
# El background task abre su PROPIA sesión — verificado en la práctica
# (no solo supuesto) que `finally: db.close()` de una dependencia `yield`
# corre ANTES de que los background tasks se ejecuten, no después: la
# sesión de la petición ya no sirve para cuando esto corre. Se usa
# `database.SessionLocal()` (módulo completo, no `from database import
# SessionLocal`) para que los tests puedan sustituir
# `database.SessionLocal` por su motor en memoria — con `from ... import`
# el nombre queda copiado en este archivo desde el momento del import y
# ya no se entera de la sustitución, así que el background task terminaría
# escribiendo contra la base de PRODUCCIÓN real (backend/.env) en vez de
# la de prueba — se detectó así, con un test que probaba justo este camino.


def _geocatmin_desde_cache(operacion: models.Operacion, coords: Optional[str]) -> Optional[dict]:
    """Lectura pura, sin red — lo último guardado para este pin, aunque
    esté vencido (mejor mostrar un dato de hace semanas que nada)."""
    if not coords:
        return None
    cache = (operacion.datos_formalizacion_json or {}).get("_geocatmin")
    return cache if isinstance(cache, dict) and cache.get("coords") == coords else None


def _geocatmin_necesita_refresco(operacion: models.Operacion, coords: Optional[str]) -> bool:
    if not coords:
        return False
    cache = (operacion.datos_formalizacion_json or {}).get("_geocatmin")
    # v: cachés de un formato anterior (ej. sin restricciones/ANP) se reconsultan.
    if not isinstance(cache, dict) or cache.get("coords") != coords or cache.get("v") != 5:
        return True
    try:
        consultado = date.fromisoformat(cache.get("consultado_en", ""))
    except ValueError:
        return True
    return date.today() - consultado > timedelta(days=geocatmin.DIAS_REFRESCO)


def _refrescar_geocatmin_en_segundo_plano(operacion_id: str, coords: str) -> None:
    consulta = geocatmin.consultar(coords)
    if consulta is None:
        return
    db = database.SessionLocal()
    try:
        operacion = db.query(models.Operacion).filter(models.Operacion.id == operacion_id).first()
        if operacion is None:
            return
        datos = operacion.datos_formalizacion_json or {}
        operacion.datos_formalizacion_json = {**datos, "_geocatmin": consulta}
        db.commit()
    finally:
        db.close()


def _reinfo_desde_cache(operacion: models.Operacion, codigo: Optional[str]) -> Optional[dict]:
    if not codigo:
        return None
    cache = (operacion.datos_formalizacion_json or {}).get("_reinfo")
    return cache if isinstance(cache, dict) and cache.get("codigo") == codigo else None


def _reinfo_necesita_refresco(operacion: models.Operacion, codigo: Optional[str]) -> bool:
    if not codigo:
        return False
    cache = (operacion.datos_formalizacion_json or {}).get("_reinfo")
    if not isinstance(cache, dict) or cache.get("codigo") != codigo or cache.get("v") != 2:
        return True
    try:
        consultado = date.fromisoformat(cache.get("consultado_en", ""))
    except ValueError:
        return True
    return date.today() - consultado > timedelta(days=reinfo.DIAS_REFRESCO)


def _refrescar_reinfo_en_segundo_plano(operacion_id: str, codigo: str) -> None:
    consulta = reinfo.consultar_reinfo(codigo)
    if consulta is None:
        return
    db = database.SessionLocal()
    try:
        operacion = db.query(models.Operacion).filter(models.Operacion.id == operacion_id).first()
        if operacion is None:
            return
        datos = operacion.datos_formalizacion_json or {}
        operacion.datos_formalizacion_json = {**datos, "_reinfo": consulta}
        db.commit()
    finally:
        db.close()


@router.get("/{operacion_id}", response_model=schemas.ProyectoDetalleOut)
def detalle_proyecto(
    operacion_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)
):
    lead, operacion = _lead_y_operacion_visibles(db, operacion_id)
    # Si el enlace de Maps quedó guardado sin coordenadas (resolución
    # fallida en su momento), se reintenta acá — el mapa satelital del
    # mosaico es lo primero que ve el inversionista.
    reparar_ubicacion_coords(db, lead)
    seguimiento = estado_seguimiento(operacion)
    base = _proyecto_publico_out(lead, operacion, seguimiento)

    documentos = (
        db.query(models.DocumentoOperacion)
        .filter(models.DocumentoOperacion.operacion_id == operacion_id)
        .all()
    )
    fotos = [
        schemas.FotoPublicaOut(id=d.id, url=f"/proyectos/{operacion_id}/fotos/{d.id}")
        for d in documentos
        if d.categoria in CATEGORIAS_GALERIA
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

    n_docs_legales = sum(1 for presentado in documentos_presentados.values() if presentado)
    # El diagnóstico es autodeclarado — el minero puede responder "sí" a
    # todo sin sustento, y eso NUNCA queda en brechas_json/brechas_resueltas
    # (solo las respuestas "no" originales generan una brecha ahí). Para
    # saber si un estudio "está bien" hay que mirar el set completo de
    # estudios aplicables a esta ruta y ver cuáles NO están pendientes
    # (o sea: se respondió "sí", o un "no" que el admin marcó resuelto) —
    # y de esos, solo cuentan como verificados (check ✓ público) los que
    # además tienen foto de respaldo subida.
    situacion = operacion.situacion or "minero_artesanal"
    respuestas = operacion.respuestas_json or {}
    try:
        ids_aplicables = ids_esperados(respuestas)
    except Exception:
        # Diagnóstico del modelo anterior: sin catálogo con que cruzar.
        ids_aplicables = set()
    estudios_aplicables: set[str] = {
        BRECHA_POR_PREGUNTA[i][1] for i in ids_aplicables if i in BRECHA_POR_PREGUNTA
    }
    # La credencial del perfil D (autorización DREM/GREM) no nace de una
    # brecha pero sí es parte de su checklist público — mismo criterio que
    # scoring.estudios_aplicables.
    if respuestas.get("M0_3") == "formal":
        estudios_aplicables.add("autorizacion_drem")
    pendientes = set(seguimiento["brechas_pendientes"])

    def _tiene_respaldo(estudio: str) -> bool:
        # "Activar tu RUC minero" no pide foto — el respaldo es el número
        # de RUC escrito (ver DocumentosMinero.tsx / actualizar_perfil_inversion).
        if estudio == "tramite_sunat":
            return bool((operacion.datos_formalizacion_json or {}).get("tramite_sunat"))
        if estudio in categorias_presentadas:
            return True
        equivalente = categoria_equivalente(estudio, situacion)
        return equivalente is not None and equivalente in categorias_presentadas

    brechas_verificadas = sorted(
        e for e in estudios_aplicables if e not in pendientes and _tiene_respaldo(e)
    )

    # Refresco de GEOCATMIN/REINFO en segundo plano (ver comentario arriba
    # de _geocatmin_desde_cache): la respuesta ya lleva lo cacheado, así
    # que esto NUNCA demora al inversionista — corre después de responder.
    codigo_reinfo = lead.codigo_reinfo or operacion.codigo_reinfo
    if _geocatmin_necesita_refresco(operacion, lead.ubicacion_coords):
        background_tasks.add_task(
            _refrescar_geocatmin_en_segundo_plano, operacion.id, lead.ubicacion_coords
        )
    if _reinfo_necesita_refresco(operacion, codigo_reinfo):
        background_tasks.add_task(
            _refrescar_reinfo_en_segundo_plano, operacion.id, codigo_reinfo
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
        estudios_aplicables=sorted(estudios_aplicables),
        es_titular_concesion=_es_titular_concesion(operacion),
        dimensiones=None,
        indicadores=_indicadores_verificados(operacion),
        respuestas_inversion_publicas={
            k: v
            for k, v in (operacion.inv_respuestas_json or {}).items()
            if k in IDS_INV_PUBLICOS
        },
        geocatmin=_geocatmin_desde_cache(operacion, lead.ubicacion_coords),
        reinfo=_reinfo_desde_cache(operacion, (lead.codigo_reinfo or operacion.codigo_reinfo)),
        reinfo_verificado_manual=operacion.reinfo_verificado_manual,
        reinfo_verificado_en=operacion.reinfo_verificado_en,
        codigo_reinfo=codigo_reinfo,
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
    """Sirve las fotos de la galería principal: fotos de la mina + las
    condicionadas al perfil (mineral, camino de acceso, agua, energía)."""
    _lead_y_operacion_visibles(db, operacion_id)

    documento = (
        db.query(models.DocumentoOperacion)
        .filter(
            models.DocumentoOperacion.id == documento_id,
            models.DocumentoOperacion.operacion_id == operacion_id,
            models.DocumentoOperacion.categoria.in_(CATEGORIAS_GALERIA),
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

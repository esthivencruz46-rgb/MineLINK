from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

import asesor
import models
import schemas
from database import get_db
from security import limitar_preguntas_asesor

router = APIRouter(prefix="/asesor", tags=["asesor"])


@router.post("", response_model=schemas.AsesorRespuestaOut)
def preguntar_asesor(
    payload: schemas.AsesorPreguntaRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _limite: None = Depends(limitar_preguntas_asesor),
):
    """Asesor conversacional PÚBLICO (julio 2026, decisión explícita del
    dueño: "cualquier persona sin registrarse lo pueda usar"). Genérico —
    no conoce el caso de nadie en particular, solo el spec de negocio de
    MineLink (`asesor.py`). Nunca genera documentos ni asesora legalmente."""
    historial = [
        {"rol": m.rol, "contenido": m.contenido} for m in payload.historial
    ][-asesor.MAX_TURNOS_HISTORIAL :]
    historial.append({"rol": "usuario", "contenido": payload.pregunta})

    # Documentos subidos desde /admin (sin git) + los que sincroniza
    # asesor_proyectos.py — barato de consultar. Julio 2026, incidente
    # real: reconstruir el índice sobre TODO el corpus tarda 50+ segundos
    # (12,000+ fragmentos) — antes se reconstruía EN LÍNEA la primera vez
    # que se detectaba un cambio, y la persona que preguntó justo en ese
    # momento se quedaba esperando el minuto completo ("Failed to fetch").
    # Ahora solo se compara (barato) y, si cambió algo, la reconstrucción
    # de verdad se agenda en segundo plano — esta pregunta responde con el
    # índice que ya estaba armado, aunque quede desactualizado por unos
    # segundos más.
    documentos_admin = db.query(models.DocumentoAsesor).filter(
        models.DocumentoAsesor.activo == True  # noqa: E712
    ).all()
    lista_documentos = [(d.nombre, d.categoria, d.texto) for d in documentos_admin]
    if asesor.documentos_admin_cambiaron(lista_documentos):
        background_tasks.add_task(asesor.actualizar_documentos_admin, lista_documentos)

    system = asesor.construir_system_prompt(payload.pregunta)
    try:
        respuesta, proveedor = asesor.generar_respuesta_con_proveedor(system, historial)
    except asesor.AsesorNoDisponible as e:
        # LlamadaAsesor (julio 2026) registra QUÉ proveedor falló y por qué
        # — existe para que el dashboard admin diga directamente "Gemini
        # está fallando: 503 high demand" sin que nadie tenga que
        # reproducir el error a mano (surgió de un incidente real: una
        # clave de API incompleta en Render pasó desapercibida hasta que
        # Esthiven lo notó por casualidad, y luego un 503 de Gemini que
        # solo se diagnosticó probando en vivo desde la terminal).
        db.add(
            models.LlamadaAsesor(exitoso=False, proveedor=e.proveedor, detalle=str(e))
        )
        db.commit()
        # Mensaje específico (julio 2026, pedido explícito de Esthiven):
        # "Intenta de nuevo en un rato" sonaba a que reintentar en un par
        # de minutos podía funcionar, cuando en la práctica el único
        # proveedor con cuota gratis real es Gemini (~1500 preg/día) y el
        # resto necesita facturación que todavía no está activada — si
        # TODA la cadena falló, casi siempre es porque se acabó esa cuota
        # del día, y no vuelve a estar disponible hasta que se reinicia
        # (al día siguiente). El widget lo muestra igual sea cual sea la
        # página pública en la que esté (se monta una sola vez en
        # App.tsx, fuera del router).
        raise HTTPException(
            status_code=503,
            detail="El asesor ya usó su cuota gratuita de preguntas por hoy. Vuelve a estar disponible mañana.",
        )
    except Exception as e:
        # Red de seguridad (julio 2026, encontrado en vivo probando desde
        # la terminal): un error que NO es AsesorNoDisponible -- un bug de
        # parseo en algún proveedor, un conflicto de sesión, lo que sea --
        # antes escapaba como un 500 crudo de FastAPI, invisible en
        # LlamadaAsesor/el dashboard admin (nadie se enteraba de qué pasó
        # sin reproducirlo a mano). rollback() primero: si el error vino de
        # la propia sesión de BD, un commit directo fallaría también.
        db.rollback()
        db.add(models.LlamadaAsesor(exitoso=False, proveedor=None, detalle=f"Error inesperado: {e}"))
        db.commit()
        raise HTTPException(
            status_code=503,
            detail="El asesor tuvo un problema inesperado. Intenta de nuevo en un rato.",
        )
    db.add(models.LlamadaAsesor(exitoso=True, proveedor=proveedor))
    db.commit()
    return schemas.AsesorRespuestaOut(respuesta=respuesta)

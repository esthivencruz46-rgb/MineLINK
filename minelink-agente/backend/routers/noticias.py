from fastapi import APIRouter, BackgroundTasks

import noticias
import schemas

router = APIRouter(prefix="/noticias", tags=["noticias"])


@router.get("", response_model=list[schemas.NoticiaOut])
def listar_noticias(background_tasks: BackgroundTasks):
    """Pública, sin auth. Mismo patrón "primera visita agenda, sirve lo
    que ya había" que GEOCATMIN/REINFO/el asesor — nunca bloquea esta
    petición esperando la respuesta de Rumbo Minero."""
    if noticias.necesita_refresco():
        background_tasks.add_task(noticias.refrescar)
    return noticias.noticias_desde_cache()


@router.get("/estado")
def estado_noticias():
    """Diagnóstico público (nada sensible, ver noticias.estado()) para
    poder revisar por qué el caché sigue vacío sin entrar al panel de
    Logs de Render."""
    return noticias.estado()

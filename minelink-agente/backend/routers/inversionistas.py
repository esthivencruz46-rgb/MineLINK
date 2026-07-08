from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from auth import create_inversionista_token, get_current_inversionista_id, hash_password, verify_password
from database import get_db
from security import (
    intentos_recuperacion_restantes,
    limitar_intentos_login,
    limitar_intentos_recuperacion,
    registrar_intento_fallido_recuperacion,
    resetear_intentos_recuperacion,
)

router = APIRouter(prefix="/inversionistas", tags=["inversionistas"])


@router.post("/login", response_model=schemas.Token)
def login(
    payload: schemas.InversionistaLogin,
    db: Session = Depends(get_db),
    _: None = Depends(limitar_intentos_login),
):
    interes = (
        db.query(models.InteresInversion)
        .filter(models.InteresInversion.username == payload.username.strip().lower())
        .first()
    )
    if interes is None or interes.password_hash is None or not verify_password(
        payload.password, interes.password_hash
    ):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    return schemas.Token(access_token=create_inversionista_token(interes.id))


@router.get("/pregunta-seguridad/{username}", response_model=schemas.PreguntaSeguridadOut)
def obtener_pregunta_seguridad(
    username: str,
    db: Session = Depends(get_db),
    _: None = Depends(limitar_intentos_login),
):
    interes = (
        db.query(models.InteresInversion)
        .filter(models.InteresInversion.username == username.strip().lower())
        .first()
    )
    if interes is None or not interes.pregunta_seguridad:
        raise HTTPException(
            status_code=404,
            detail=(
                "No encontramos una pregunta de seguridad para ese usuario. "
                "Escríbenos por WhatsApp para restablecer tu contraseña."
            ),
        )
    return schemas.PreguntaSeguridadOut(pregunta=interes.pregunta_seguridad)


@router.post("/recuperar-password", response_model=schemas.Token)
def recuperar_password(
    payload: schemas.RecuperarPasswordRequest,
    db: Session = Depends(get_db),
    _: None = Depends(limitar_intentos_login),
):
    interes = (
        db.query(models.InteresInversion)
        .filter(models.InteresInversion.username == payload.username.strip().lower())
        .first()
    )
    if interes is None or not interes.respuesta_seguridad_hash:
        raise HTTPException(status_code=404, detail="No pudimos procesar tu solicitud.")

    clave = f"inversionista:{interes.id}"
    limitar_intentos_recuperacion(clave)

    if not verify_password(payload.respuesta_seguridad, interes.respuesta_seguridad_hash):
        registrar_intento_fallido_recuperacion(clave)
        restantes = intentos_recuperacion_restantes(clave)
        if restantes == 0:
            raise HTTPException(
                status_code=429,
                detail=(
                    "Respuesta incorrecta. Superaste los 4 intentos permitidos. "
                    "Escríbenos por WhatsApp para restablecer tu contraseña."
                ),
            )
        raise HTTPException(
            status_code=400,
            detail=f"Respuesta incorrecta. Te queda{'n' if restantes != 1 else ''} {restantes} intento{'s' if restantes != 1 else ''}.",
        )

    resetear_intentos_recuperacion(clave)
    interes.password_hash = hash_password(payload.nueva_password)
    db.commit()
    return schemas.Token(access_token=create_inversionista_token(interes.id))


@router.get("/me", response_model=schemas.InversionistaPerfilOut)
def perfil(
    db: Session = Depends(get_db),
    interes_id: int = Depends(get_current_inversionista_id),
):
    """Por ahora es una ventana vacía: solo muestra lo que el inversionista
    ya dejó al expresar interés. Todavía NO hay match ni contacto directo
    con proyectos — esa lógica no existe aún."""
    interes = (
        db.query(models.InteresInversion)
        .filter(models.InteresInversion.id == interes_id)
        .first()
    )
    if interes is None:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    return schemas.InversionistaPerfilOut(
        nombre=interes.nombre,
        telefono=interes.telefono,
        email=interes.email,
        motivo_inversion=interes.motivo_inversion,
        monto=interes.monto,
        informacion_requerida=interes.informacion_requerida,
        mensaje=interes.mensaje,
        operacion_id=interes.operacion_id,
        created_at=interes.created_at,
    )

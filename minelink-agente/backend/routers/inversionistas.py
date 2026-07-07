from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from auth import create_inversionista_token, get_current_inversionista_id, verify_password
from database import get_db
from security import limitar_intentos_login

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

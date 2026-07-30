import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "esthiven")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "changeme")
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 12
MINERO_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30

bearer_scheme = HTTPBearer()
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Hash bcrypt válido de un valor fijo cualquiera -- julio 2026, hallazgo de
# auditoría de seguridad: los login de minero/inversionista comparaban
# `lead is None or ... or not verify_password(...)` con cortocircuito, así
# que un usuario INEXISTENTE respondía casi al instante (nunca se llamaba a
# verify_password) mientras uno real tardaba lo que tarda bcrypt en
# verificar (~100-300ms) -- esa diferencia de tiempo deja adivinar qué
# usuarios existen sin necesidad de acertar la contraseña. Verificar
# siempre contra ESTE hash cuando la cuenta no existe iguala el tiempo de
# respuesta en ambos casos.
_HASH_DUMMY = "$2b$12$iF5imD/AipSxhz8F0KOmheLEEygNTgqPv0pmBApa9CUI19xmxyeEC"


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _pwd_context.verify(password, password_hash)


def verify_password_o_dummy(password: str, password_hash: str | None) -> bool:
    """Igual que verify_password, pero nunca deja que la ausencia de hash
    (cuenta inexistente o sin contraseña) evite la llamada a bcrypt -- ver
    _HASH_DUMMY arriba. Usar SIEMPRE en un login público en vez de
    cortocircuitar con `hash is None or not verify_password(...)`."""
    return _pwd_context.verify(password, password_hash or _HASH_DUMMY)


def authenticate_admin(username: str, password: str) -> bool:
    # compare_digest evita ataques de tiempo (medir cuánto tarda la
    # comparación para adivinar la contraseña carácter por carácter).
    usuario_ok = secrets.compare_digest(username.encode(), ADMIN_USERNAME.encode())
    password_ok = secrets.compare_digest(password.encode(), ADMIN_PASSWORD.encode())
    return usuario_ok and password_ok


def create_access_token() -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": ADMIN_USERNAME, "rol": "admin", "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales inválidas o expiradas",
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None or payload.get("rol") != "admin":
            raise exc
        return username
    except JWTError:
        raise exc


def _crear_token_con_rol(sub_id: int, rol: str, minutos: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=minutos)
    payload = {"sub": str(sub_id), "rol": rol, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _get_current_id_con_rol(rol: str):
    def dependencia(
        credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    ) -> int:
        exc = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas o expiradas",
        )
        try:
            payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
            sub_id = payload.get("sub")
            if sub_id is None or payload.get("rol") != rol:
                raise exc
            return int(sub_id)
        except (JWTError, ValueError):
            raise exc

    return dependencia


def create_minero_token(lead_id: int) -> str:
    return _crear_token_con_rol(lead_id, "minero", MINERO_TOKEN_EXPIRE_MINUTES)


get_current_lead_id = _get_current_id_con_rol("minero")


def create_inversionista_token(interes_id: int) -> str:
    return _crear_token_con_rol(interes_id, "inversionista", MINERO_TOKEN_EXPIRE_MINUTES)


get_current_inversionista_id = _get_current_id_con_rol("inversionista")

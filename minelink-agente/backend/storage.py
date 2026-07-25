"""Almacenamiento de archivos subidos (fotos, PDFs) en dos modos:

- Con SUPABASE_URL + SUPABASE_SERVICE_KEY en el entorno → Supabase Storage
  (permanente, sobrevive a los redespliegues de Render). Modo de producción.
- Sin esas variables → disco local en backend/uploads/ (modo dev y tests,
  igual que siempre).

El bucket es PRIVADO: los archivos se sirven siempre a través del backend,
que decide qué es público (fotos de mina) y qué no (PDFs con DNI).
"""

import os
from typing import Optional
from urllib.parse import quote

import requests
from dotenv import load_dotenv

from uploads_config import ANOMALIAS_SATELITALES_DIR, DOCUMENTOS_MINERO_DIR, UPLOADS_DIR

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
BUCKET = "archivos-minelink"

# carpeta lógica → directorio local equivalente (modo disco)
_DIRS_LOCALES = {
    "documentos_mineros": DOCUMENTOS_MINERO_DIR,
    "cvs": UPLOADS_DIR,
    "anomalias_satelitales": ANOMALIAS_SATELITALES_DIR,
}


def storage_activo() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)


def content_disposition(disposicion: str, nombre: str) -> str:
    """Cabecera Content-Disposition segura para nombres con tildes/ñ
    (las cabeceras HTTP no aceptan caracteres fuera de ASCII directo)."""
    return f"{disposicion}; filename*=UTF-8''{quote(nombre)}"


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "apikey": SUPABASE_SERVICE_KEY,
    }


def crear_bucket_si_falta() -> None:
    r = requests.get(f"{SUPABASE_URL}/storage/v1/bucket/{BUCKET}", headers=_headers(), timeout=30)
    if r.status_code == 200:
        return
    r = requests.post(
        f"{SUPABASE_URL}/storage/v1/bucket",
        headers=_headers(),
        json={"id": BUCKET, "name": BUCKET, "public": False},
        timeout=30,
    )
    r.raise_for_status()


def guardar(carpeta: str, filename: str, contenido: bytes, content_type: str) -> None:
    if storage_activo():
        r = requests.post(
            f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{carpeta}/{filename}",
            headers={**_headers(), "Content-Type": content_type, "x-upsert": "true"},
            data=contenido,
            timeout=120,
        )
        r.raise_for_status()
    else:
        (_DIRS_LOCALES[carpeta] / filename).write_bytes(contenido)


def leer(carpeta: str, filename: str) -> Optional[bytes]:
    """Devuelve el contenido del archivo, o None si no existe."""
    if storage_activo():
        r = requests.get(
            f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{carpeta}/{filename}",
            headers=_headers(),
            timeout=120,
        )
        if r.status_code != 200:
            return None
        return r.content
    ruta = _DIRS_LOCALES[carpeta] / filename
    if not ruta.exists():
        return None
    return ruta.read_bytes()


def eliminar(carpeta: str, filename: str) -> None:
    """Borra UN archivo puntual (nunca borra carpetas ni usa comodines)."""
    if storage_activo():
        requests.delete(
            f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{carpeta}/{filename}",
            headers=_headers(),
            timeout=60,
        )
        return
    ruta = _DIRS_LOCALES[carpeta] / filename
    if ruta.exists():
        ruta.unlink()

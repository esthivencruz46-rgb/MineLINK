"""Publica el APK de Android en un bucket PÚBLICO de Supabase Storage,
para que cualquiera pueda descargarlo desde el botón de la página web.

Correr cada vez que se regenere el APK (después de gradlew assembleDebug):
    python -m seeds.publicar_apk

Sube frontend/android/app/build/outputs/apk/debug/app-debug.apk como
MineLink.apk. La URL pública queda fija, así el botón de la web nunca
cambia.
"""
from pathlib import Path

import requests

import storage

BUCKET_PUBLICO = "descargas"
RUTA_APK = (
    Path(__file__).parent.parent.parent
    / "frontend" / "android" / "app" / "build" / "outputs" / "apk" / "debug" / "app-debug.apk"
)

if not storage.storage_activo():
    print("ERROR: faltan SUPABASE_URL/SUPABASE_SERVICE_KEY en backend/.env")
    raise SystemExit(1)
if not RUTA_APK.exists():
    print(f"ERROR: no existe el APK en {RUTA_APK} — compílalo primero (gradlew assembleDebug)")
    raise SystemExit(1)

# Crear el bucket público si no existe
r = requests.get(
    f"{storage.SUPABASE_URL}/storage/v1/bucket/{BUCKET_PUBLICO}",
    headers=storage._headers(),
    timeout=30,
)
if r.status_code != 200:
    requests.post(
        f"{storage.SUPABASE_URL}/storage/v1/bucket",
        headers=storage._headers(),
        json={"id": BUCKET_PUBLICO, "name": BUCKET_PUBLICO, "public": True},
        timeout=30,
    ).raise_for_status()
    print(f"Bucket público '{BUCKET_PUBLICO}' creado.")

contenido = RUTA_APK.read_bytes()
r = requests.post(
    f"{storage.SUPABASE_URL}/storage/v1/object/{BUCKET_PUBLICO}/MineLink.apk",
    headers={
        **storage._headers(),
        "Content-Type": "application/vnd.android.package-archive",
        "x-upsert": "true",
    },
    data=contenido,
    timeout=300,
)
r.raise_for_status()

url = f"{storage.SUPABASE_URL}/storage/v1/object/public/{BUCKET_PUBLICO}/MineLink.apk"
print(f"APK publicado ({len(contenido) / 1024 / 1024:.1f} MB)")
print(f"URL de descarga: {url}")

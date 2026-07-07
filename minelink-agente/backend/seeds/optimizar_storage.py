"""Mide cuánto pesa el bucket de Supabase Storage y comprime las imágenes
ya subidas (a máx. 1600px / JPEG 80), para cuidar el 1 GB gratuito.

- Solo toca IMÁGENES dentro del bucket (los PDFs no se tocan).
- Reemplaza el archivo en el bucket con la versión liviana, mismo nombre
  (la BD no cambia). Los archivos locales de backend/uploads/ NO se tocan.

Uso (desde backend/):
    python -m seeds.optimizar_storage            # solo mide, no cambia nada
    python -m seeds.optimizar_storage --comprimir
"""
import sys

import requests

import storage
from imagenes import comprimir_si_es_imagen

if not storage.storage_activo():
    print("ERROR: faltan SUPABASE_URL/SUPABASE_SERVICE_KEY en backend/.env")
    raise SystemExit(1)

comprimir = "--comprimir" in sys.argv


def listar(carpeta: str) -> list[dict]:
    objetos, offset = [], 0
    while True:
        r = requests.post(
            f"{storage.SUPABASE_URL}/storage/v1/object/list/{storage.BUCKET}",
            headers=storage._headers(),
            json={"prefix": carpeta, "limit": 1000, "offset": offset},
            timeout=60,
        )
        r.raise_for_status()
        pagina = r.json()
        objetos.extend(pagina)
        if len(pagina) < 1000:
            return objetos
        offset += 1000


total_bytes = 0
ahorro_total = 0
for carpeta in ("documentos_mineros", "cvs"):
    objetos = listar(carpeta)
    peso = sum(o.get("metadata", {}).get("size", 0) for o in objetos)
    total_bytes += peso
    print(f"{carpeta}: {len(objetos)} archivos, {peso / 1024 / 1024:.1f} MB")

    if not comprimir:
        continue
    for o in objetos:
        mime = o.get("metadata", {}).get("mimetype", "")
        if not mime.startswith("image/"):
            continue
        nombre = o["name"]
        original = storage.leer(carpeta, nombre)
        if original is None:
            continue
        nuevo, tipo, _ext = comprimir_si_es_imagen(original, mime)
        if len(nuevo) < len(original):
            storage.guardar(carpeta, nombre, nuevo, tipo)
            ahorro = len(original) - len(nuevo)
            ahorro_total += ahorro
            print(
                f"  comprimida {nombre}: {len(original)//1024} KB -> {len(nuevo)//1024} KB"
            )

print(f"\nUso total del bucket: {total_bytes / 1024 / 1024:.1f} MB de 1024 MB (1 GB)")
if comprimir and ahorro_total:
    print(f"Ahorro logrado ahora: {ahorro_total / 1024 / 1024:.1f} MB")

"""Migración: COPIA los archivos locales de backend/uploads/ a Supabase
Storage. NUNCA borra ni modifica los archivos locales — quedan como
respaldo permanente en esta PC.

Requiere SUPABASE_URL y SUPABASE_SERVICE_KEY en backend/.env.

Uso (desde backend/):
    python -m seeds.migrar_archivos_a_storage
"""
import mimetypes

import storage
from uploads_config import DOCUMENTOS_MINERO_DIR, UPLOADS_DIR

if not storage.storage_activo():
    print("ERROR: faltan SUPABASE_URL y/o SUPABASE_SERVICE_KEY en backend/.env")
    raise SystemExit(1)

print(f"Creando bucket '{storage.BUCKET}' si no existe...")
storage.crear_bucket_si_falta()

CARPETAS = [
    ("documentos_mineros", DOCUMENTOS_MINERO_DIR),
    ("cvs", UPLOADS_DIR),
]

total_subidos = 0
total_verificados = 0
errores = []

for carpeta, directorio in CARPETAS:
    archivos = sorted(p for p in directorio.iterdir() if p.is_file())
    print(f"\n{carpeta}: {len(archivos)} archivo(s) locales")
    for ruta in archivos:
        contenido = ruta.read_bytes()
        content_type = mimetypes.guess_type(ruta.name)[0] or "application/octet-stream"
        try:
            storage.guardar(carpeta, ruta.name, contenido, content_type)
            total_subidos += 1
            # Verificación: se vuelve a descargar y se compara byte a byte
            descargado = storage.leer(carpeta, ruta.name)
            if descargado == contenido:
                total_verificados += 1
                print(f"  OK  {ruta.name} ({len(contenido):,} bytes, verificado)")
            else:
                errores.append(ruta.name)
                print(f"  !!  {ruta.name}: lo descargado NO coincide")
        except Exception as e:
            errores.append(ruta.name)
            print(f"  !!  {ruta.name}: {e}")

print(f"\nResumen: {total_subidos} subidos, {total_verificados} verificados byte a byte.")
if errores:
    print(f"ERRORES en: {errores}")
    raise SystemExit(1)
print("Migración completa. Los archivos locales quedan intactos como respaldo.")

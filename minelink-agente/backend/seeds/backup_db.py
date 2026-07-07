"""Copia de seguridad de minelink.db (y de los archivos subidos por
mineros/consultores) a backend/backups/, con timestamp. Pensado para
correr periódicamente (ej. Programador de tareas de Windows, una vez al
día) mientras el proyecto siga en SQLite + disco local.

Usa el backup API de sqlite3 (no un simple copy de archivo), que es
seguro incluso si el servidor sigue corriendo y escribiendo al mismo
tiempo — no corrompe el archivo ni bloquea al servidor.

Uso (desde backend/):
    python -m seeds.backup_db
"""
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path

RAIZ = Path(__file__).parent.parent
RUTA_DB = RAIZ / "minelink.db"
CARPETA_BACKUPS = RAIZ / "backups"
CARPETA_BACKUPS.mkdir(exist_ok=True)

marca_tiempo = datetime.now().strftime("%Y%m%d_%H%M%S")

if RUTA_DB.exists():
    destino_db = CARPETA_BACKUPS / f"minelink_{marca_tiempo}.db"
    origen = sqlite3.connect(RUTA_DB)
    destino = sqlite3.connect(destino_db)
    with destino:
        origen.backup(destino)
    origen.close()
    destino.close()
    print(f"Base de datos respaldada en {destino_db}")
else:
    print("No existe minelink.db todavía; nada que respaldar.")

carpeta_uploads = RAIZ / "uploads"
if carpeta_uploads.exists():
    destino_uploads = CARPETA_BACKUPS / f"uploads_{marca_tiempo}"
    shutil.copytree(carpeta_uploads, destino_uploads)
    print(f"Archivos subidos respaldados en {destino_uploads}")

# Conserva solo los últimos 14 respaldos de BD (y sus carpetas de uploads
# correspondientes) para no llenar el disco indefinidamente.
respaldos_db = sorted(CARPETA_BACKUPS.glob("minelink_*.db"))
for viejo in respaldos_db[:-14]:
    viejo.unlink()
    carpeta_uploads_vieja = CARPETA_BACKUPS / f"uploads_{viejo.stem.replace('minelink_', '')}"
    if carpeta_uploads_vieja.exists():
        shutil.rmtree(carpeta_uploads_vieja)
    print(f"Respaldo antiguo eliminado: {viejo.name}")

"""Migración: agrega la columna cv_filename a empresas (ADD COLUMN simple,
no requiere reconstruir la tabla porque es nullable).

Uso (desde backend/, con el servidor detenido):
    python -m seeds.migrar_cv_filename
"""
import sqlite3
from pathlib import Path

RUTA_DB = Path(__file__).parent.parent / "minelink.db"

con = sqlite3.connect(RUTA_DB)
cur = con.cursor()

cur.execute("PRAGMA table_info(empresas)")
columnas = {fila[1] for fila in cur.fetchall()}

if "cv_filename" not in columnas:
    cur.execute("ALTER TABLE empresas ADD COLUMN cv_filename TEXT")
    con.commit()
    print("Columna 'cv_filename' agregada.")
else:
    print("Columna 'cv_filename' ya existía, no se tocó.")

con.close()

"""Migración: agrega brechas_resueltas_json a operaciones (ADD COLUMN
simple, con default '[]' para las filas existentes).

Uso (desde backend/, con el servidor detenido):
    python -m seeds.migrar_brechas_resueltas
"""
import sqlite3
from pathlib import Path

RUTA_DB = Path(__file__).parent.parent / "minelink.db"

con = sqlite3.connect(RUTA_DB)
cur = con.cursor()

cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='operaciones'")
if cur.fetchone() is None:
    print("No existe la tabla 'operaciones' todavía; no hay nada que migrar.")
    con.close()
    raise SystemExit(0)

cur.execute("PRAGMA table_info(operaciones)")
columnas = {fila[1] for fila in cur.fetchall()}

if "brechas_resueltas_json" not in columnas:
    cur.execute(
        "ALTER TABLE operaciones ADD COLUMN brechas_resueltas_json TEXT NOT NULL DEFAULT '[]'"
    )
    con.commit()
    print("Columna 'brechas_resueltas_json' agregada.")
else:
    print("Columna 'brechas_resueltas_json' ya existía, no se tocó.")

con.close()

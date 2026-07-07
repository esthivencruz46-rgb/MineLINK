"""Migración: agrega los campos del perfil de inversión (opcionales) a
leads (ADD COLUMN simple, nullable). Preparación para la futura ventana
de inversionistas — esa lógica todavía NO existe, esto solo guarda datos.

Uso (desde backend/, con el servidor detenido):
    python -m seeds.migrar_perfil_inversion
"""
import sqlite3
from pathlib import Path

RUTA_DB = Path(__file__).parent.parent / "minelink.db"

con = sqlite3.connect(RUTA_DB)
cur = con.cursor()

cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='leads'")
if cur.fetchone() is None:
    print("No existe la tabla 'leads' todavía; no hay nada que migrar.")
    con.close()
    raise SystemExit(0)

cur.execute("PRAGMA table_info(leads)")
columnas = {fila[1] for fila in cur.fetchall()}

nuevas = [
    "descripcion_operacion",
    "capacidad_produccion",
    "capital_buscado",
    "uso_fondos",
]
for columna in nuevas:
    if columna not in columnas:
        cur.execute(f"ALTER TABLE leads ADD COLUMN {columna} TEXT")
        print(f"Columna '{columna}' agregada.")
    else:
        print(f"Columna '{columna}' ya existía, no se tocó.")

con.commit()
con.close()

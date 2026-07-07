"""Migración: agrega email y nombre_operacion a leads (ADD COLUMN
simple, nullable, no requiere reconstruir la tabla).

Uso (desde backend/, con el servidor detenido):
    python -m seeds.migrar_registro_minero
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

cambios = [
    ("email", "ALTER TABLE leads ADD COLUMN email TEXT"),
    ("nombre_operacion", "ALTER TABLE leads ADD COLUMN nombre_operacion TEXT"),
]

for nombre_columna, sentencia in cambios:
    if nombre_columna not in columnas:
        cur.execute(sentencia)
        print(f"Columna '{nombre_columna}' agregada.")
    else:
        print(f"Columna '{nombre_columna}' ya existía, no se tocó.")

con.commit()
cur.execute("SELECT COUNT(*) FROM leads")
print(f"Filas preservadas: {cur.fetchone()[0]}")
con.close()

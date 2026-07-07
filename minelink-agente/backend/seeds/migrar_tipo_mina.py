"""Migración: agrega tipo_mina y los 3 campos informativos de Operativo
(produccion_mensual, maquinaria, num_trabajadores) a la tabla operaciones.
Todas son ADD COLUMN simples (nullable o con default), no requieren
reconstruir la tabla.

Uso (desde backend/, con el servidor detenido):
    python -m seeds.migrar_tipo_mina
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

cambios = [
    ("tipo_mina", "ALTER TABLE operaciones ADD COLUMN tipo_mina TEXT NOT NULL DEFAULT 'subterranea'"),
    ("produccion_mensual", "ALTER TABLE operaciones ADD COLUMN produccion_mensual TEXT"),
    ("maquinaria", "ALTER TABLE operaciones ADD COLUMN maquinaria TEXT"),
    ("num_trabajadores", "ALTER TABLE operaciones ADD COLUMN num_trabajadores TEXT"),
]

for nombre_columna, sentencia in cambios:
    if nombre_columna not in columnas:
        cur.execute(sentencia)
        print(f"Columna '{nombre_columna}' agregada.")
    else:
        print(f"Columna '{nombre_columna}' ya existía, no se tocó.")

con.commit()
cur.execute("SELECT COUNT(*) FROM operaciones")
print(f"Filas preservadas: {cur.fetchone()[0]}")
con.close()

"""Migración de rendimiento/confiabilidad para soportar más tráfico
concurrente (pensado para ~100k personas / ~1000 minas registradas):

- Activa modo WAL (permite lecturas mientras alguien escribe).
- Agrega índices en operacion_id (FK usada en casi todos los JOIN) y en
  region/mineral/bloqueado de operaciones (filtros de /proyectos y
  /empresas), que hasta ahora no tenían índice.

No mueve datos ni cambia columnas — es seguro correrlo varias veces.

Uso (desde backend/, con el servidor detenido):
    python -m seeds.migrar_indices_y_wal
"""
import sqlite3
from pathlib import Path

RUTA_DB = Path(__file__).parent.parent / "minelink.db"

con = sqlite3.connect(RUTA_DB)
cur = con.cursor()

cur.execute("PRAGMA journal_mode=WAL")
print("Modo journal:", cur.fetchone())

indices = [
    ("ix_operaciones_region", "operaciones", "region"),
    ("ix_operaciones_mineral", "operaciones", "mineral"),
    ("ix_operaciones_bloqueado", "operaciones", "bloqueado"),
    ("ix_leads_operacion_id", "leads", "operacion_id"),
    ("ix_documentos_operacion_operacion_id", "documentos_operacion", "operacion_id"),
    ("ix_intereses_inversion_operacion_id", "intereses_inversion", "operacion_id"),
]

for nombre_indice, tabla, columna in indices:
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (tabla,))
    if cur.fetchone() is None:
        print(f"Tabla '{tabla}' no existe todavía, se omite índice '{nombre_indice}'.")
        continue
    cur.execute(f"CREATE INDEX IF NOT EXISTS {nombre_indice} ON {tabla}({columna})")
    print(f"Índice '{nombre_indice}' listo.")

con.commit()
con.close()
print("Migración completa.")

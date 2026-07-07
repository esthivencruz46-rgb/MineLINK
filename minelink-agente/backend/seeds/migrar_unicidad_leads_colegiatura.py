"""Migración: agrega índices UNIQUE a leads.whatsapp, leads.codigo_reinfo
y empresas.colegiatura (SQLite permite múltiples NULL en un índice UNIQUE,
así que no afecta a las filas donde codigo_reinfo/colegiatura son nulos).

Uso (desde backend/, con el servidor detenido):
    python -m seeds.migrar_unicidad_leads_colegiatura
"""
import sqlite3
from pathlib import Path

RUTA_DB = Path(__file__).parent.parent / "minelink.db"

con = sqlite3.connect(RUTA_DB)
cur = con.cursor()


def _hay_duplicados(tabla: str, columna: str) -> list:
    cur.execute(
        f"SELECT {columna}, COUNT(*) FROM {tabla} "
        f"WHERE {columna} IS NOT NULL GROUP BY {columna} HAVING COUNT(*) > 1"
    )
    return cur.fetchall()


revisiones = [("leads", "whatsapp"), ("leads", "codigo_reinfo"), ("empresas", "colegiatura")]
for tabla, columna in revisiones:
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (tabla,))
    if cur.fetchone() is None:
        print(f"No existe la tabla '{tabla}' todavía; se omite.")
        continue

    duplicados = _hay_duplicados(tabla, columna)
    if duplicados:
        print(
            f"ABORTADO: hay valores duplicados en {tabla}.{columna}: {duplicados}. "
            "Resuélvelos manualmente antes de crear el índice único."
        )
        con.close()
        raise SystemExit(1)

cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_leads_whatsapp_unico ON leads(whatsapp)")
cur.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS ix_leads_codigo_reinfo_unico ON leads(codigo_reinfo)"
)
cur.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS ix_empresas_colegiatura_unico ON empresas(colegiatura)"
)
con.commit()
con.close()
print("Índices únicos creados (o ya existían) en leads.whatsapp, leads.codigo_reinfo y empresas.colegiatura.")

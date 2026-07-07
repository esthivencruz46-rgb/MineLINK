"""Migración: agrega tipo ('empresa' | 'consultor') y colegiatura a la
tabla empresas, y vuelve el RUC opcional (los consultores no siempre
tienen RUC). SQLite no soporta ALTER COLUMN, así que se reconstruye la
tabla preservando cada fila existente.

Uso (desde backend/, con el servidor detenido):
    python -m seeds.migrar_tipo_consultor
"""
import sqlite3
from pathlib import Path

RUTA_DB = Path(__file__).parent.parent / "minelink.db"

con = sqlite3.connect(RUTA_DB)
cur = con.cursor()

cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='empresas'")
if cur.fetchone() is None:
    print("No existe la tabla 'empresas' todavía; no hay nada que migrar.")
    con.close()
    raise SystemExit(0)

cur.execute("PRAGMA table_info(empresas)")
columnas_actuales = {fila[1] for fila in cur.fetchall()}
if "tipo" in columnas_actuales and "colegiatura" in columnas_actuales:
    print("La tabla ya está migrada (tiene 'tipo' y 'colegiatura'). No se hizo nada.")
    con.close()
    raise SystemExit(0)

cur.execute("ALTER TABLE empresas RENAME TO empresas_old")

cur.execute("""
    CREATE TABLE empresas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT NOT NULL DEFAULT 'empresa',
        nombre TEXT NOT NULL,
        ruc TEXT UNIQUE,
        colegiatura TEXT,
        anios_servicio INTEGER NOT NULL,
        regiones_json JSON NOT NULL,
        estudios_json JSON NOT NULL,
        whatsapp TEXT NOT NULL,
        email TEXT,
        activa BOOLEAN NOT NULL DEFAULT 1,
        created_at DATETIME
    )
""")

cur.execute("PRAGMA table_info(empresas_old)")
columnas_viejas = [fila[1] for fila in cur.fetchall()]
columnas_comunes = [c for c in columnas_viejas if c not in ("tipo", "colegiatura")]
columnas_sql = ", ".join(columnas_comunes)

cur.execute(f"""
    INSERT INTO empresas (tipo, {columnas_sql})
    SELECT 'empresa', {columnas_sql} FROM empresas_old
""")

cur.execute("DROP TABLE empresas_old")
con.commit()

cur.execute("SELECT COUNT(*) FROM empresas")
print(f"Migración lista. Filas preservadas: {cur.fetchone()[0]}")
con.close()

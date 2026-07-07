"""Migración: vuelve opcional el email en intereses_inversion (el
inversionista puede no tener correo). La columna original se creó como
NOT NULL antes de que el modelo cambiara a nullable=True — SQLite no
soporta ALTER COLUMN, así que se reconstruye la tabla preservando cada
fila existente (mismo patrón que migrar_tipo_consultor.py).

Uso (desde backend/, con el servidor detenido):
    python -m seeds.migrar_email_inversionista_opcional
"""
import sqlite3
from pathlib import Path

RUTA_DB = Path(__file__).parent.parent / "minelink.db"

con = sqlite3.connect(RUTA_DB)
cur = con.cursor()

cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='intereses_inversion'")
if cur.fetchone() is None:
    print("No existe la tabla 'intereses_inversion' todavía; no hay nada que migrar.")
    con.close()
    raise SystemExit(0)

cur.execute("SELECT sql FROM sqlite_master WHERE name='intereses_inversion'")
sql_actual = cur.fetchone()[0]
if "email VARCHAR NOT NULL" not in sql_actual and "email TEXT NOT NULL" not in sql_actual:
    print("La columna 'email' ya es opcional. No se hizo nada.")
    con.close()
    raise SystemExit(0)

cur.execute("ALTER TABLE intereses_inversion RENAME TO intereses_inversion_old")

cur.execute("""
    CREATE TABLE intereses_inversion (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operacion_id TEXT NOT NULL REFERENCES operaciones(id),
        nombre TEXT NOT NULL,
        email TEXT,
        telefono TEXT,
        motivo_inversion TEXT,
        monto TEXT,
        informacion_requerida TEXT,
        mensaje TEXT,
        username TEXT UNIQUE,
        password_hash TEXT,
        created_at DATETIME
    )
""")

cur.execute("PRAGMA table_info(intereses_inversion_old)")
columnas_viejas = [fila[1] for fila in cur.fetchall()]
columnas_sql = ", ".join(columnas_viejas)

cur.execute(f"""
    INSERT INTO intereses_inversion ({columnas_sql})
    SELECT {columnas_sql} FROM intereses_inversion_old
""")

cur.execute("DROP TABLE intereses_inversion_old")
con.commit()

cur.execute("SELECT COUNT(*) FROM intereses_inversion")
print(f"Migración lista. Filas preservadas: {cur.fetchone()[0]}")
con.close()

"""Migración: agrega los campos de la cuenta del inversionista y del
formulario ampliado a intereses_inversion (ADD COLUMN simple, nullable).
email pasa a ser opcional ("correo gmail si tiene"), por eso no se toca
como NOT NULL aquí — SQLite no permite relajar NOT NULL vía ALTER TABLE,
pero como la tabla es nueva y sin datos reales todavía, no hace falta
reconstruirla (ver seeds/migrar_tipo_consultor.py si algún día hay que
hacerlo con datos ya cargados).

Uso (desde backend/, con el servidor detenido):
    python -m seeds.migrar_cuenta_inversionista
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

cur.execute("PRAGMA table_info(intereses_inversion)")
columnas = {fila[1] for fila in cur.fetchall()}

nuevas = [
    "telefono",
    "motivo_inversion",
    "monto",
    "informacion_requerida",
    "username",
    "password_hash",
]
for columna in nuevas:
    if columna not in columnas:
        cur.execute(f"ALTER TABLE intereses_inversion ADD COLUMN {columna} TEXT")
        print(f"Columna '{columna}' agregada.")
    else:
        print(f"Columna '{columna}' ya existía, no se tocó.")

con.commit()

cur.execute(
    "SELECT username, COUNT(*) FROM intereses_inversion WHERE username IS NOT NULL "
    "GROUP BY username HAVING COUNT(*) > 1"
)
duplicados = cur.fetchall()
if duplicados:
    print(f"AVISO: hay usernames duplicados {duplicados}; resuélvelos antes de crear el índice único.")
else:
    cur.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_intereses_inversion_username_unico "
        "ON intereses_inversion(username)"
    )
    con.commit()
    print("Índice único creado en intereses_inversion.username.")

con.close()

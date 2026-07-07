"""Migración: agrega username/password_hash a leads (ADD COLUMN simple,
nullable porque los leads existentes no tenían cuenta). El índice único de
username se crea aparte porque SQLite no soporta UNIQUE en ALTER TABLE.

Uso (desde backend/, con el servidor detenido):
    python -m seeds.migrar_cuenta_minero
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

if "username" not in columnas:
    cur.execute("ALTER TABLE leads ADD COLUMN username TEXT")
    print("Columna 'username' agregada.")
else:
    print("Columna 'username' ya existía, no se tocó.")

if "password_hash" not in columnas:
    cur.execute("ALTER TABLE leads ADD COLUMN password_hash TEXT")
    print("Columna 'password_hash' agregada.")
else:
    print("Columna 'password_hash' ya existía, no se tocó.")

con.commit()

cur.execute("SELECT username, COUNT(*) FROM leads WHERE username IS NOT NULL GROUP BY username HAVING COUNT(*) > 1")
duplicados = cur.fetchall()
if duplicados:
    print(f"AVISO: hay usernames duplicados {duplicados}; resuélvelos antes de crear el índice único.")
else:
    cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_leads_username_unico ON leads(username)")
    con.commit()
    print("Índice único creado en leads.username.")

con.close()

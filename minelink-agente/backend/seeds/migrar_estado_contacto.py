"""Migración: agrega la columna estado_contacto a leads (default "buscando").
Funciona contra la base que diga DATABASE_URL (Supabase) o la SQLite local.

Uso (desde backend/):
    python -m seeds.migrar_estado_contacto
"""
from sqlalchemy import inspect, text

from database import engine

inspector = inspect(engine)
if "leads" not in inspector.get_table_names():
    print("No existe la tabla 'leads' todavía; no hay nada que migrar.")
    raise SystemExit(0)

columnas = {c["name"] for c in inspector.get_columns("leads")}
if "estado_contacto" in columnas:
    print("La columna estado_contacto ya existe; nada que hacer.")
    raise SystemExit(0)

with engine.begin() as con:
    con.execute(
        text("ALTER TABLE leads ADD COLUMN estado_contacto VARCHAR NOT NULL DEFAULT 'buscando'")
    )

print(f"Columna estado_contacto agregada en: {engine.url.render_as_string(hide_password=True)}")

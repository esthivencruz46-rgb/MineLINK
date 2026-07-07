"""Migración: agrega la columna ubicacion_maps (nullable) a leads.
Funciona contra la base que diga DATABASE_URL (Supabase/Postgres) o la
SQLite local si no hay .env — usa el mismo engine que la app.

Uso (desde backend/):
    python -m seeds.migrar_ubicacion_maps
"""
from sqlalchemy import inspect, text

from database import engine

inspector = inspect(engine)
if "leads" not in inspector.get_table_names():
    print("No existe la tabla 'leads' todavía; no hay nada que migrar.")
    raise SystemExit(0)

columnas = {c["name"] for c in inspector.get_columns("leads")}
if "ubicacion_maps" in columnas:
    print("La columna ubicacion_maps ya existe; nada que hacer.")
    raise SystemExit(0)

with engine.begin() as con:
    con.execute(text("ALTER TABLE leads ADD COLUMN ubicacion_maps VARCHAR"))

print(f"Columna ubicacion_maps agregada en: {engine.url.render_as_string(hide_password=True)}")

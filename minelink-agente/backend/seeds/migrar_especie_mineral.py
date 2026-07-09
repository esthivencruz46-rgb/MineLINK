"""Migración: agrega la columna especie_mineral (nullable) a operaciones.
Funciona contra la base que diga DATABASE_URL (Supabase/Postgres) o la
SQLite local si no hay .env — usa el mismo engine que la app.

Uso (desde backend/):
    python -m seeds.migrar_especie_mineral
"""
from sqlalchemy import inspect, text

from database import engine

inspector = inspect(engine)
if "operaciones" not in inspector.get_table_names():
    print("No existe la tabla 'operaciones' todavía; no hay nada que migrar.")
    raise SystemExit(0)

columnas = {c["name"] for c in inspector.get_columns("operaciones")}
if "especie_mineral" in columnas:
    print("La columna especie_mineral ya existe; nada que hacer.")
    raise SystemExit(0)

with engine.begin() as con:
    con.execute(text("ALTER TABLE operaciones ADD COLUMN especie_mineral VARCHAR"))

print(f"Columna especie_mineral agregada en: {engine.url.render_as_string(hide_password=True)}")

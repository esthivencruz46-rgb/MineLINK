"""Migración: agrega rating (0-5) y num_resenas a empresas. Funciona
contra la base que diga DATABASE_URL (Supabase) o la SQLite local.

Uso (desde backend/):
    python -m seeds.migrar_rating_empresas
"""
from sqlalchemy import inspect, text

from database import engine

inspector = inspect(engine)
columnas = {c["name"] for c in inspector.get_columns("empresas")}

with engine.begin() as con:
    if "rating" not in columnas:
        con.execute(text("ALTER TABLE empresas ADD COLUMN rating FLOAT"))
        print("Columna rating agregada.")
    if "num_resenas" not in columnas:
        con.execute(text("ALTER TABLE empresas ADD COLUMN num_resenas INTEGER"))
        print("Columna num_resenas agregada.")
print("Migración lista.")

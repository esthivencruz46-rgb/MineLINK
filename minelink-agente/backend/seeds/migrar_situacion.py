"""Migración: agrega operaciones.situacion (formulario dinámico), con
default "minero_artesanal" para todos los diagnósticos existentes.

Uso (desde backend/):
    python -m seeds.migrar_situacion
"""
from sqlalchemy import inspect, text

from database import engine

inspector = inspect(engine)
columnas = {c["name"] for c in inspector.get_columns("operaciones")}
if "situacion" in columnas:
    print("La columna situacion ya existe; nada que hacer.")
    raise SystemExit(0)

with engine.begin() as con:
    con.execute(
        text(
            "ALTER TABLE operaciones ADD COLUMN situacion VARCHAR NOT NULL "
            "DEFAULT 'minero_artesanal'"
        )
    )
print("Columna situacion agregada (existentes = minero_artesanal).")

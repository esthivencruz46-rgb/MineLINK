"""Migración: agrega leads.ubicacion_coords y calcula las coordenadas de
los enlaces de Maps ya guardados (backfill). Funciona contra la base que
diga DATABASE_URL (Supabase) o la SQLite local.

Uso (desde backend/):
    python -m seeds.migrar_ubicacion_coords
"""
from sqlalchemy import inspect, text

import models
from database import SessionLocal, engine
from geoubicacion import resolver_coordenadas

inspector = inspect(engine)
columnas = {c["name"] for c in inspector.get_columns("leads")}
if "ubicacion_coords" not in columnas:
    with engine.begin() as con:
        con.execute(text("ALTER TABLE leads ADD COLUMN ubicacion_coords VARCHAR"))
    print("Columna ubicacion_coords agregada.")
else:
    print("La columna ubicacion_coords ya existe.")

db = SessionLocal()
pendientes = (
    db.query(models.Lead)
    .filter(models.Lead.ubicacion_maps.isnot(None), models.Lead.ubicacion_coords.is_(None))
    .all()
)
for lead in pendientes:
    coords = resolver_coordenadas(lead.ubicacion_maps)
    lead.ubicacion_coords = coords
    print(f"{lead.nombre_operacion}: {lead.ubicacion_maps} -> {coords}")
db.commit()
db.close()
print(f"Backfill listo ({len(pendientes)} enlace(s) procesado(s)).")

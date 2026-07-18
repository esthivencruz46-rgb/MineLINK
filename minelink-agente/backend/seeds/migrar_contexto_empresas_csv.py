"""Migración: columnas de contexto del scraping en empresas (julio 2026).
El CSV de la base externa de profesionales (Google Maps) trae página web,
teléfono tal cual (puede ser línea fija), dirección, categoría y keyword
de búsqueda — Esthiven los quiere guardados para evaluar cada empresa
antes de activarla. Agrega a `empresas` (todas VARCHAR, nullable):
  - web, telefono, direccion, categoria, keyword

Funciona contra la base que diga DATABASE_URL (Supabase/Postgres) o la
SQLite local si no hay .env — usa el mismo engine que la app. Filas
existentes quedan con NULL (correcto: ese contexto nunca se recolectó).

Uso (desde backend/, con el servidor detenido):
    python -m seeds.migrar_contexto_empresas_csv
"""
from sqlalchemy import inspect, text

from database import engine

inspector = inspect(engine)
tablas = set(inspector.get_table_names())

if "empresas" not in tablas:
    print("Falta la tabla base 'empresas'; no hay nada que migrar.")
    raise SystemExit(0)

columnas = {c["name"] for c in inspector.get_columns("empresas")}

NUEVAS = ["web", "telefono", "direccion", "categoria", "keyword"]

with engine.begin() as con:
    for columna in NUEVAS:
        if columna not in columnas:
            con.execute(text(f"ALTER TABLE empresas ADD COLUMN {columna} VARCHAR"))
            print(f"Columna empresas.{columna} agregada.")
        else:
            print(f"empresas.{columna} ya existía, no se tocó.")

print(f"Listo en: {engine.url.render_as_string(hide_password=True)}")

"""Migración: fechas declaradas junto a los documentos de formalización
(julio 2026). Agrega:
  - operaciones.datos_formalizacion_json (JSON, nullable)

Guarda un dict categoria→valor con las fechas que el minero declara al
costado de cada slot de "Respalda tu declaración" (fecha de inicio de
actividades, última renovación de vigencia, última DAC, etc.).

Funciona contra la base que diga DATABASE_URL (Supabase/Postgres) o la
SQLite local si no hay .env — usa el mismo engine que la app. Filas
existentes quedan en NULL (= sin fechas declaradas todavía), que es el
comportamiento correcto.

Uso (desde backend/, con el servidor detenido):
    python -m seeds.migrar_datos_formalizacion
"""
from sqlalchemy import inspect, text

from database import engine

inspector = inspect(engine)

if "operaciones" not in set(inspector.get_table_names()):
    print("No existe la tabla operaciones; no hay nada que migrar.")
    raise SystemExit(0)

columnas = {c["name"] for c in inspector.get_columns("operaciones")}

with engine.begin() as con:
    if "datos_formalizacion_json" not in columnas:
        con.execute(text("ALTER TABLE operaciones ADD COLUMN datos_formalizacion_json JSON"))
        print("Columna operaciones.datos_formalizacion_json agregada.")
    else:
        print("operaciones.datos_formalizacion_json ya existía, no se tocó.")

print("Migración completada.")

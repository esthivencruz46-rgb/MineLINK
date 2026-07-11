"""Migración: agrega la columna estado_formalizacion (nullable) a operaciones.

Guarda el PERFIL del pipeline de formalización (A | A_avanzado | B | C | D,
ver context/diagnostico_formalizacion.md), derivado en el servidor a partir
del Módulo 0. NULL = diagnóstico del modelo anterior al rediseño de julio 2026.

Funciona contra la base que diga DATABASE_URL (Supabase/Postgres) o la
SQLite local si no hay .env — usa el mismo engine que la app.

Uso (desde backend/):
    python -m seeds.migrar_estado_formalizacion
"""
from sqlalchemy import inspect, text

from database import engine

inspector = inspect(engine)
if "operaciones" not in inspector.get_table_names():
    print("No existe la tabla 'operaciones' todavía; no hay nada que migrar.")
    raise SystemExit(0)

columnas = {c["name"] for c in inspector.get_columns("operaciones")}
if "estado_formalizacion" in columnas:
    print("La columna estado_formalizacion ya existe; nada que hacer.")
    raise SystemExit(0)

with engine.begin() as con:
    con.execute(text("ALTER TABLE operaciones ADD COLUMN estado_formalizacion VARCHAR"))
    con.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_operaciones_estado_formalizacion "
            "ON operaciones (estado_formalizacion)"
        )
    )

print(f"Columna estado_formalizacion agregada en: {engine.url.render_as_string(hide_password=True)}")

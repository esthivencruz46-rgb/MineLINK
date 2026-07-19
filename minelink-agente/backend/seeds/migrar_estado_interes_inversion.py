"""Migración: seguimiento del interés del inversionista (julio 2026).
La cuenta del inversionista era un cascarón ("Estamos preparando esta
sección") — ahora muestra el estado de su interés, que Esthiven avanza
desde el admin. Agrega:
  - intereses_inversion.estado_contacto (VARCHAR NOT NULL DEFAULT 'recibido')

Filas existentes quedan en 'recibido' (correcto: nunca se marcó nada).
Funciona contra la base que diga DATABASE_URL o la SQLite local.

Uso (desde backend/, con el servidor detenido):
    python -m seeds.migrar_estado_interes_inversion
"""
from sqlalchemy import inspect, text

from database import engine

inspector = inspect(engine)
if "intereses_inversion" not in set(inspector.get_table_names()):
    print("Falta la tabla base 'intereses_inversion'; no hay nada que migrar.")
    raise SystemExit(0)

columnas = {c["name"] for c in inspector.get_columns("intereses_inversion")}

with engine.begin() as con:
    if "estado_contacto" not in columnas:
        con.execute(
            text(
                "ALTER TABLE intereses_inversion ADD COLUMN estado_contacto "
                "VARCHAR NOT NULL DEFAULT 'recibido'"
            )
        )
        print("Columna intereses_inversion.estado_contacto agregada.")
    else:
        print("intereses_inversion.estado_contacto ya existía, no se tocó.")

print(f"Listo en: {engine.url.render_as_string(hide_password=True)}")

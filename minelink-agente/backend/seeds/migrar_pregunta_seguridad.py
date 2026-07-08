"""Migración: agrega pregunta_seguridad y respuesta_seguridad_hash
(nullable) a leads e intereses_inversion, para la recuperación de
contraseña autoservicio (pregunta elegida por el propio usuario al
registrarse). Funciona contra la base que diga DATABASE_URL
(Supabase/Postgres) o la SQLite local si no hay .env.

Uso (desde backend/):
    python -m seeds.migrar_pregunta_seguridad
"""
from sqlalchemy import inspect, text

from database import engine

inspector = inspect(engine)

for tabla in ("leads", "intereses_inversion"):
    if tabla not in inspector.get_table_names():
        print(f"No existe la tabla '{tabla}' todavía; se omite.")
        continue

    columnas = {c["name"] for c in inspector.get_columns(tabla)}
    with engine.begin() as con:
        if "pregunta_seguridad" not in columnas:
            con.execute(text(f"ALTER TABLE {tabla} ADD COLUMN pregunta_seguridad VARCHAR"))
            print(f"Columna pregunta_seguridad agregada en {tabla}.")
        else:
            print(f"{tabla}.pregunta_seguridad ya existe.")

        if "respuesta_seguridad_hash" not in columnas:
            con.execute(text(f"ALTER TABLE {tabla} ADD COLUMN respuesta_seguridad_hash VARCHAR"))
            print(f"Columna respuesta_seguridad_hash agregada en {tabla}.")
        else:
            print(f"{tabla}.respuesta_seguridad_hash ya existe.")

print(f"Listo en: {engine.url.render_as_string(hide_password=True)}")

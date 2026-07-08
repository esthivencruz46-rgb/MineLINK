"""Migración: agrega las columnas del perfil de operación (Ruta 1) y del
perfil de concesión (Ruta 2) a `operaciones` — todas nullable, informativas,
no puntúan. Funciona contra la base que diga DATABASE_URL (Supabase/Postgres)
o la SQLite local si no hay .env.

Uso (desde backend/):
    python -m seeds.migrar_perfil_operacion
"""
from sqlalchemy import inspect, text

from database import engine

COLUMNAS_TEXTO = [
    "estado_operacion", "tipo_explotacion", "material_comercializado",
    "forma_comercializacion", "tiempo_operacion", "ley_promedio",
    "ley_como_obtenida", "tipo_deposito", "etapa_proyecto",
    "documento_autorizacion",
]
COLUMNAS_BOOLEAN = [
    "tiene_resultados_laboratorio", "concesion_vigente",
    "info_geologica_disponible", "tiene_estimaciones_leyes",
]
COLUMNAS_JSON = ["trabajos_exploracion_json", "tipo_apoyo_json"]

TIPO_SQL = {"texto": "VARCHAR", "boolean": "BOOLEAN", "json": "JSON"}

inspector = inspect(engine)
if "operaciones" not in inspector.get_table_names():
    print("No existe la tabla 'operaciones' todavía; nada que migrar.")
    raise SystemExit(0)

columnas_actuales = {c["name"] for c in inspector.get_columns("operaciones")}

with engine.begin() as con:
    for nombre in COLUMNAS_TEXTO:
        if nombre not in columnas_actuales:
            con.execute(text(f"ALTER TABLE operaciones ADD COLUMN {nombre} VARCHAR"))
            print(f"Columna {nombre} (texto) agregada.")
    for nombre in COLUMNAS_BOOLEAN:
        if nombre not in columnas_actuales:
            con.execute(text(f"ALTER TABLE operaciones ADD COLUMN {nombre} BOOLEAN"))
            print(f"Columna {nombre} (boolean) agregada.")
    for nombre in COLUMNAS_JSON:
        if nombre not in columnas_actuales:
            con.execute(text(f"ALTER TABLE operaciones ADD COLUMN {nombre} JSON"))
            print(f"Columna {nombre} (json) agregada.")

print(f"Listo en: {engine.url.render_as_string(hide_password=True)}")

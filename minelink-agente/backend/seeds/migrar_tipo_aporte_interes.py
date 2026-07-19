"""Migración: qué puede aportar el inversionista (julio 2026). El aporte
en especie (maquinaria, estudios, personal) vale tanto como el efectivo en
minería artesanal — el inversionista lo declara al dejar su interés y
Esthiven lo cruza con lo que el minero busca (INV_0_12). Agrega:
  - intereses_inversion.tipo_aporte_json (JSON, nullable)

Filas existentes quedan en NULL (correcto: nunca se preguntó).
Funciona contra la base que diga DATABASE_URL o la SQLite local.

Uso (desde backend/, con el servidor detenido):
    python -m seeds.migrar_tipo_aporte_interes
"""
from sqlalchemy import inspect, text

from database import engine

inspector = inspect(engine)
if "intereses_inversion" not in set(inspector.get_table_names()):
    print("Falta la tabla base 'intereses_inversion'; no hay nada que migrar.")
    raise SystemExit(0)

columnas = {c["name"] for c in inspector.get_columns("intereses_inversion")}

with engine.begin() as con:
    if "tipo_aporte_json" not in columnas:
        # Tipo JSON plano — mismo que usan todas las migraciones anteriores
        # de columnas JSON (datos_formalizacion_json, inv_respuestas_json...).
        con.execute(text("ALTER TABLE intereses_inversion ADD COLUMN tipo_aporte_json JSON"))
        print("Columna intereses_inversion.tipo_aporte_json agregada.")
    else:
        print("intereses_inversion.tipo_aporte_json ya existía, no se tocó.")

print(f"Listo en: {engine.url.render_as_string(hide_password=True)}")

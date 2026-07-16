"""Migración: verificación MANUAL del código REINFO (julio 2026). El cotejo
automático contra el padrón del MINEM quedó desactivado (ver reinfo.py — el
scraper con `requests` da falsos "no_encontrado" incluso con códigos reales
y vigentes); Esthiven verifica el código a mano y lo marca desde el admin.
Agrega:
  - operaciones.reinfo_verificado_manual (BOOLEAN NOT NULL DEFAULT FALSE)
  - operaciones.reinfo_verificado_en (TIMESTAMP, nullable)

Funciona contra la base que diga DATABASE_URL (Supabase/Postgres) o la
SQLite local si no hay .env — usa el mismo engine que la app. Filas
existentes quedan sin verificar (comportamiento correcto: nada se había
verificado antes de esta migración).

Uso (desde backend/, con el servidor detenido):
    python -m seeds.migrar_reinfo_verificado
"""
from sqlalchemy import inspect, text

from database import engine

inspector = inspect(engine)
tablas = set(inspector.get_table_names())

if "operaciones" not in tablas:
    print("Falta la tabla base 'operaciones'; no hay nada que migrar.")
    raise SystemExit(0)

columnas_operaciones = {c["name"] for c in inspector.get_columns("operaciones")}

with engine.begin() as con:
    if "reinfo_verificado_manual" not in columnas_operaciones:
        con.execute(
            text(
                "ALTER TABLE operaciones ADD COLUMN reinfo_verificado_manual "
                "BOOLEAN NOT NULL DEFAULT FALSE"
            )
        )
        print("Columna operaciones.reinfo_verificado_manual agregada.")
    else:
        print("operaciones.reinfo_verificado_manual ya existía, no se tocó.")

    if "reinfo_verificado_en" not in columnas_operaciones:
        con.execute(text("ALTER TABLE operaciones ADD COLUMN reinfo_verificado_en TIMESTAMP"))
        print("Columna operaciones.reinfo_verificado_en agregada.")
    else:
        print("operaciones.reinfo_verificado_en ya existía, no se tocó.")

print(f"Listo en: {engine.url.render_as_string(hide_password=True)}")

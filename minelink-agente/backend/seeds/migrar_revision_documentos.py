"""Migración: revisión admin de documentos + desbloqueo de "Inversionista"
+ Módulo INV (julio 2026). Agrega:
  - documentos_operacion.estado_revision (VARCHAR NOT NULL DEFAULT 'pendiente')
  - documentos_operacion.motivo_rechazo (VARCHAR, nullable)
  - documentos_operacion.revisado_en (TIMESTAMP, nullable)
  - operaciones.documentos_enviados_en (TIMESTAMP, nullable)
  - operaciones.visto_bueno_documentos (BOOLEAN NOT NULL DEFAULT FALSE)
  - operaciones.inv_respuestas_json (JSON, nullable)
  - operaciones.inv_enviado_en (TIMESTAMP, nullable)
  - operaciones.inv_visto_bueno (BOOLEAN NOT NULL DEFAULT FALSE)

Funciona contra la base que diga DATABASE_URL (Supabase/Postgres) o la
SQLite local si no hay .env — usa el mismo engine que la app. Filas
existentes quedan con estado_revision="pendiente" / visto_bueno_documentos
=False, que es el comportamiento correcto (nada se consideraba revisado
antes de esta migración).

Uso (desde backend/, con el servidor detenido):
    python -m seeds.migrar_revision_documentos
"""
from sqlalchemy import inspect, text

from database import engine

inspector = inspect(engine)
tablas = set(inspector.get_table_names())

if "documentos_operacion" not in tablas or "operaciones" not in tablas:
    print("Faltan tablas base (documentos_operacion/operaciones); no hay nada que migrar.")
    raise SystemExit(0)

columnas_documentos = {c["name"] for c in inspector.get_columns("documentos_operacion")}
columnas_operaciones = {c["name"] for c in inspector.get_columns("operaciones")}

with engine.begin() as con:
    if "estado_revision" not in columnas_documentos:
        con.execute(
            text(
                "ALTER TABLE documentos_operacion ADD COLUMN estado_revision "
                "VARCHAR NOT NULL DEFAULT 'pendiente'"
            )
        )
        print("Columna documentos_operacion.estado_revision agregada.")
    else:
        print("documentos_operacion.estado_revision ya existía, no se tocó.")

    if "motivo_rechazo" not in columnas_documentos:
        con.execute(text("ALTER TABLE documentos_operacion ADD COLUMN motivo_rechazo VARCHAR"))
        print("Columna documentos_operacion.motivo_rechazo agregada.")
    else:
        print("documentos_operacion.motivo_rechazo ya existía, no se tocó.")

    if "revisado_en" not in columnas_documentos:
        con.execute(text("ALTER TABLE documentos_operacion ADD COLUMN revisado_en TIMESTAMP"))
        print("Columna documentos_operacion.revisado_en agregada.")
    else:
        print("documentos_operacion.revisado_en ya existía, no se tocó.")

    if "documentos_enviados_en" not in columnas_operaciones:
        con.execute(text("ALTER TABLE operaciones ADD COLUMN documentos_enviados_en TIMESTAMP"))
        print("Columna operaciones.documentos_enviados_en agregada.")
    else:
        print("operaciones.documentos_enviados_en ya existía, no se tocó.")

    if "visto_bueno_documentos" not in columnas_operaciones:
        con.execute(
            text(
                "ALTER TABLE operaciones ADD COLUMN visto_bueno_documentos "
                "BOOLEAN NOT NULL DEFAULT FALSE"
            )
        )
        print("Columna operaciones.visto_bueno_documentos agregada.")
    else:
        print("operaciones.visto_bueno_documentos ya existía, no se tocó.")

    if "inv_respuestas_json" not in columnas_operaciones:
        con.execute(text("ALTER TABLE operaciones ADD COLUMN inv_respuestas_json JSON"))
        print("Columna operaciones.inv_respuestas_json agregada.")
    else:
        print("operaciones.inv_respuestas_json ya existía, no se tocó.")

    if "inv_enviado_en" not in columnas_operaciones:
        con.execute(text("ALTER TABLE operaciones ADD COLUMN inv_enviado_en TIMESTAMP"))
        print("Columna operaciones.inv_enviado_en agregada.")
    else:
        print("operaciones.inv_enviado_en ya existía, no se tocó.")

    if "inv_visto_bueno" not in columnas_operaciones:
        con.execute(
            text("ALTER TABLE operaciones ADD COLUMN inv_visto_bueno BOOLEAN NOT NULL DEFAULT FALSE")
        )
        print("Columna operaciones.inv_visto_bueno agregada.")
    else:
        print("operaciones.inv_visto_bueno ya existía, no se tocó.")

print(f"Listo en: {engine.url.render_as_string(hide_password=True)}")

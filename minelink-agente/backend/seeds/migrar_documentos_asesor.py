"""Migración: crea la tabla `documentos_asesor` (julio 2026, subir
documentos al asesor conversacional desde /admin sin pasar por git).
Tabla NUEVA — no altera ninguna tabla existente.

Uso (desde backend/):
    python -m seeds.migrar_documentos_asesor
"""
from sqlalchemy import inspect

import models
from database import engine

inspector = inspect(engine)
if "documentos_asesor" in inspector.get_table_names():
    print("La tabla documentos_asesor ya existe; nada que hacer.")
else:
    models.DocumentoAsesor.__table__.create(bind=engine, checkfirst=True)
    print(f"Tabla documentos_asesor creada en: {engine.url.render_as_string(hide_password=True)}")

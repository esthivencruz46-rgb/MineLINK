"""Migración: crea la tabla `llamadas_asesor` (julio 2026, registro de
qué proveedor respondió/falló cada pregunta al asesor, para diagnosticar
un proveedor caído desde el dashboard admin). Tabla NUEVA — no altera
ninguna tabla existente.

Uso (desde backend/):
    python -m seeds.migrar_llamadas_asesor
"""
from sqlalchemy import inspect

import models
from database import engine

inspector = inspect(engine)
if "llamadas_asesor" in inspector.get_table_names():
    print("La tabla llamadas_asesor ya existe; nada que hacer.")
else:
    models.LlamadaAsesor.__table__.create(bind=engine, checkfirst=True)
    print(f"Tabla llamadas_asesor creada en: {engine.url.render_as_string(hide_password=True)}")

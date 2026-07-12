"""Migración: crea la tabla `notificaciones` (julio 2026, campanita de la
cuenta del minero). Tabla NUEVA — no altera ninguna tabla existente — así
que en vez de ALTER TABLE a mano usa el propio metadata de SQLAlchemy
(dialect-agnóstico entre SQLite y Postgres).

Uso (desde backend/):
    python -m seeds.migrar_notificaciones
"""
from sqlalchemy import inspect

import models
from database import engine

inspector = inspect(engine)
if "notificaciones" in inspector.get_table_names():
    print("La tabla notificaciones ya existe; nada que hacer.")
else:
    models.Notificacion.__table__.create(bind=engine, checkfirst=True)
    print(f"Tabla notificaciones creada en: {engine.url.render_as_string(hide_password=True)}")

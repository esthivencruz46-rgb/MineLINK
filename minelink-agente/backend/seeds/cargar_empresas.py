"""Carga seeds/empresas.csv en la base de datos (tabla empresas).
Idempotente: si el RUC ya existe, actualiza esa fila en vez de duplicarla.

Uso (desde backend/, con el servidor detenido para evitar locks de SQLite):
    python seeds/cargar_empresas.py
"""
import csv
from pathlib import Path

import models
from database import Base, SessionLocal, engine

Base.metadata.create_all(bind=engine)

RUTA_CSV = Path(__file__).parent / "empresas.csv"

db = SessionLocal()
creadas = 0
actualizadas = 0

with open(RUTA_CSV, encoding="utf-8") as f:
    for fila in csv.DictReader(f):
        datos = {
            "nombre": fila["nombre"],
            "ruc": fila["ruc"],
            "anios_servicio": int(fila["anios_servicio"]),
            "regiones_json": [r for r in fila["regiones_json"].split(";") if r],
            "estudios_json": [e for e in fila["estudios_json"].split(";") if e],
            "whatsapp": fila["whatsapp"],
            "email": fila["email"] or None,
            "activa": fila["activa"].strip().lower() == "true",
        }

        existente = db.query(models.Empresa).filter(models.Empresa.ruc == datos["ruc"]).first()
        if existente:
            for campo, valor in datos.items():
                setattr(existente, campo, valor)
            actualizadas += 1
        else:
            db.add(models.Empresa(**datos))
            creadas += 1

db.commit()
db.close()

print(f"Listo: {creadas} empresas creadas, {actualizadas} actualizadas.")

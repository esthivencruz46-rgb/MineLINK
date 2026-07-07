"""Limpieza TOTAL de datos de simulación: borra TODAS las filas de leads,
operaciones, documentos, intereses de inversión y eventos de la base que
diga DATABASE_URL (Supabase o SQLite local), y sus archivos en Supabase
Storage (uno por uno, nunca con comodines).

NO borra:
- Las empresas/consultores cargados (se limpian desde /admin/empresas,
  o corre con --incluir-empresas para borrarlas también).
- Los archivos locales de backend/uploads/ (respaldo permanente en esta PC).

ANTES DE CORRER: hacer backup (python -m seeds.backup_db) y estar seguro.
Pide confirmación escribiendo exactamente: SI BORRAR TODO

Uso (desde backend/):
    python -m seeds.limpiar_datos_prueba
    python -m seeds.limpiar_datos_prueba --incluir-empresas
"""
import sys

import models
import storage
from database import SessionLocal, engine

incluir_empresas = "--incluir-empresas" in sys.argv

print(f"Base de datos: {engine.url.render_as_string(hide_password=True)}")
db = SessionLocal()

n_leads = db.query(models.Lead).count()
n_ops = db.query(models.Operacion).count()
n_docs = db.query(models.DocumentoOperacion).count()
n_int = db.query(models.InteresInversion).count()
n_ev = db.query(models.Evento).count()
n_emp = db.query(models.Empresa).count()

print(f"""
Esto borrará DEFINITIVAMENTE:
  - {n_leads} cuentas de mineros (leads)
  - {n_ops} diagnósticos (operaciones)
  - {n_docs} documentos/fotos (y sus archivos en Supabase Storage)
  - {n_int} intereses de inversionistas
  - {n_ev} eventos de métricas
  - Empresas/consultores: {n_emp} {"(SÍ se borran, con sus CVs)" if incluir_empresas else "(NO se tocan; usa --incluir-empresas si también quieres borrarlas)"}

Los archivos locales de backend/uploads/ NO se tocan (respaldo).
""")

confirmacion = input("Escribe exactamente 'SI BORRAR TODO' para continuar: ")
if confirmacion.strip() != "SI BORRAR TODO":
    print("Cancelado. No se borró nada.")
    raise SystemExit(0)

# Archivos en Storage: uno por uno, por nombre exacto (nunca comodines)
if storage.storage_activo():
    for doc in db.query(models.DocumentoOperacion).all():
        storage.eliminar("documentos_mineros", doc.filename)
    if incluir_empresas:
        for emp in db.query(models.Empresa).filter(models.Empresa.cv_filename.isnot(None)).all():
            storage.eliminar("cvs", emp.cv_filename)
    print("Archivos de Storage borrados.")
else:
    print("(Storage no configurado: solo se borran filas de la BD, no archivos)")

# Filas: en orden hijo → padre para respetar las claves foráneas
db.query(models.DocumentoOperacion).delete()
db.query(models.InteresInversion).delete()
db.query(models.Lead).delete()
db.query(models.Operacion).delete()
db.query(models.Evento).delete()
if incluir_empresas:
    db.query(models.Empresa).delete()
db.commit()
db.close()

print("Limpieza completa. La plataforma queda vacía, lista para datos reales.")

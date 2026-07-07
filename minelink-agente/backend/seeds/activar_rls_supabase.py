"""Activa Row Level Security (RLS) en las 5 tablas del schema public para
cerrar la advertencia de seguridad de Supabase ("RLS disabled in public").

Sin RLS, Supabase expone cada tabla como un endpoint REST público
(PostgREST) accesible con la "anon key" — cualquiera podría leer/escribir
directo, saltándose el backend. Con RLS activado y SIN políticas
definidas, esa API pública queda completamente bloqueada (deniega todo
por defecto), pero el backend sigue funcionando normal porque se conecta
como "postgres", el dueño de las tablas — Postgres no aplica RLS al
dueño salvo que se use FORCE ROW LEVEL SECURITY (que no usamos).

Uso (desde backend/, con el servidor detenido o no — es seguro en caliente):
    python -m seeds.activar_rls_supabase
"""
from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import create_engine, text

from database import DATABASE_URL

if DATABASE_URL.startswith("sqlite"):
    print("DATABASE_URL apunta a SQLite; RLS es un concepto de Postgres, no aplica.")
    raise SystemExit(1)

TABLAS = [
    "operaciones",
    "empresas",
    "leads",
    "documentos_operacion",
    "intereses_inversion",
]

engine = create_engine(DATABASE_URL)
with engine.connect() as conn:
    for tabla in TABLAS:
        conn.execute(text(f"ALTER TABLE {tabla} ENABLE ROW LEVEL SECURITY"))
        print(f"RLS activado en '{tabla}'.")
    conn.commit()

print("Listo. La API pública de PostgREST ya no puede leer/escribir estas tablas.")

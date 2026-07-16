"""Migración: habilita Row Level Security (RLS) en las 3 tablas que
Supabase marcó como "RLS Disabled in Public" en su Security Advisor
(julio 2026) — eventos, intereses_empresa, notificaciones. Las tablas
originales (operaciones, leads, empresas, documentos_operacion,
intereses_inversion) ya tenían RLS activado desde el despliegue inicial;
estas 3 se crearon después vía migraciones de SQLAlchemy, que no saben de
RLS (es un ALTER TABLE propio de Postgres), y quedaron sin ese candado.

Sin políticas (igual que las demás tablas): esto BLOQUEA por completo el
acceso vía la API pública de PostgREST (anon key) — el backend NO se ve
afectado porque se conecta como owner (postgres) de las tablas, no pasa
por PostgREST.

Solo aplica a Postgres — SQLite (dev local) no tiene RLS, se salta solo.

Uso (desde backend/):
    python -m seeds.habilitar_rls_tablas_nuevas
"""
from sqlalchemy import text

from database import engine

TABLAS = ["eventos", "intereses_empresa", "notificaciones"]

if engine.url.get_backend_name() != "postgresql":
    print(f"Motor actual ({engine.url.get_backend_name()}) no es Postgres — RLS no aplica, nada que hacer.")
    raise SystemExit(0)

with engine.begin() as con:
    for tabla in TABLAS:
        con.execute(text(f"ALTER TABLE {tabla} ENABLE ROW LEVEL SECURITY"))
        print(f"RLS habilitado en {tabla}.")

print(f"Listo en: {engine.url.render_as_string(hide_password=True)}")

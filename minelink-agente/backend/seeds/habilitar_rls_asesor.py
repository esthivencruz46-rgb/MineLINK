"""Migración: habilita Row Level Security (RLS) en las 2 tablas del
módulo del asesor conversacional que quedaron SIN ese candado —
documentos_asesor (julio 2026, migrar_documentos_asesor.py) y
llamadas_asesor (julio 2026, migrar_llamadas_asesor.py). Ambas se crearon
después de habilitar_rls_tablas_nuevas.py, que solo cubrió las 3 tablas
que Supabase tenía marcadas como "RLS Disabled in Public" en ese momento
(eventos, intereses_empresa, notificaciones) — estas dos se quedaron
afuera sin que nadie lo notara (hallazgo de auditoría de seguridad,
julio 2026).

Sin RLS, ambas tablas quedan expuestas por la API pública de PostgREST
de Supabase (accesible con la "anon key") — cualquiera podría, por
ejemplo, escribir contenido falso directo en documentos_asesor,
saltándose por completo /admin/asesor y contaminando lo que el asesor le
dice a los mineros/inversionistas sobre la ley.

Sin políticas (igual que las demás tablas): esto BLOQUEA por completo el
acceso vía PostgREST — el backend NO se ve afectado porque se conecta
como owner (postgres) de las tablas, no pasa por PostgREST.

Solo aplica a Postgres — SQLite (dev local) no tiene RLS, se salta solo.

Uso (desde backend/):
    python -m seeds.habilitar_rls_asesor
"""
from sqlalchemy import text

from database import engine

TABLAS = ["documentos_asesor", "llamadas_asesor"]

if engine.url.get_backend_name() != "postgresql":
    print(f"Motor actual ({engine.url.get_backend_name()}) no es Postgres — RLS no aplica, nada que hacer.")
    raise SystemExit(0)

with engine.begin() as con:
    for tabla in TABLAS:
        con.execute(text(f"ALTER TABLE {tabla} ENABLE ROW LEVEL SECURITY"))
        print(f"RLS habilitado en {tabla}.")

print(f"Listo en: {engine.url.render_as_string(hide_password=True)}")

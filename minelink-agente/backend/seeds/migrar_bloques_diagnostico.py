"""Migración Fase 1 (preguntas nuevas del diagnóstico): agrega las columnas
informativas nuevas de `operaciones` (bloques 3-8 del spec, ambas rutas) y
convierte de BOOLEAN a VARCHAR las 4 columnas que pasaron de Sí/No a 3
opciones (tiene_resultados_laboratorio, concesion_vigente,
info_geologica_disponible, tiene_estimaciones_leyes). Funciona contra la
base que diga DATABASE_URL (Supabase/Postgres) o la SQLite local si no hay
.env — en SQLite el cambio de tipo se omite porque las columnas ya son
dinámicas (no hace falta ALTER COLUMN TYPE).

Uso (desde backend/):
    python -m seeds.migrar_bloques_diagnostico
"""
from sqlalchemy import inspect, text

from database import engine

COLUMNAS_TEXTO_NUEVAS = [
    # Compartidas
    "tipo_apoyo", "acceso_agua", "acceso_energia", "conflictividad_social",
    "estructura_propiedad", "monto_requerido", "plazo_capital", "motivo_capital",
    "produccion_objetivo", "uso_fondos_diagnostico",
    # Ruta 1
    "modalidad_trabajadores", "provincia", "sustancias_toxicas", "gestion_sustancias",
    "incidentes_previos", "permisos_comunitarios", "acceso_logistico",
    "experiencia_operador", "capacitacion_operador", "documentacion_disponible",
    "plan_formalizacion", "prioridad_crecimiento",
    # Ruta 2
    "pagos_vigencia_al_dia", "toneladas_estimadas", "ley_esperada", "capital_disponible",
    "estudio_previo", "historial_operacion", "pasivos_ambientales", "experiencia_titular",
    "background_titular", "equipo_tecnico", "tipo_socio_buscado", "siguiente_hito",
    "timeline_operacion", "motivo_inicio",
]

# Antes BOOLEAN, ahora VARCHAR de 3 opciones (ver models.py)
COLUMNAS_A_CONVERTIR_A_TEXTO = [
    "tiene_resultados_laboratorio", "concesion_vigente",
    "info_geologica_disponible", "tiene_estimaciones_leyes",
]

inspector = inspect(engine)
if "operaciones" not in inspector.get_table_names():
    print("No existe la tabla 'operaciones' todavía; nada que migrar.")
    raise SystemExit(0)

columnas_actuales = {c["name"] for c in inspector.get_columns("operaciones")}
es_postgres = engine.url.get_backend_name().startswith("postgres")

with engine.begin() as con:
    for nombre in COLUMNAS_TEXTO_NUEVAS:
        if nombre not in columnas_actuales:
            con.execute(text(f"ALTER TABLE operaciones ADD COLUMN {nombre} VARCHAR"))
            print(f"Columna {nombre} (texto) agregada.")

    if es_postgres:
        for nombre in COLUMNAS_A_CONVERTIR_A_TEXTO:
            con.execute(
                text(
                    f"ALTER TABLE operaciones ALTER COLUMN {nombre} TYPE VARCHAR "
                    f"USING {nombre}::text"
                )
            )
            print(f"Columna {nombre}: BOOLEAN -> VARCHAR.")
    else:
        print(
            "SQLite: se omite el cambio de tipo de "
            f"{COLUMNAS_A_CONVERTIR_A_TEXTO} (tipado dinámico, no hace falta)."
        )

print(f"Listo en: {engine.url.render_as_string(hide_password=True)}")

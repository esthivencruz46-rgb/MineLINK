"""Copia TODOS los datos reales de minelink.db (SQLite) hacia la base de
datos configurada en DATABASE_URL (Supabase/Postgres). Preserva IDs
exactos (incluye los UUID de operaciones y los operacion_id que los
referencian) y reajusta las secuencias autoincrement de Postgres al
final para que los próximos inserts no choquen con IDs ya copiados.

Seguro de correr más de una vez: si el destino ya tiene filas en una
tabla, esa tabla se omite (no duplica ni sobreescribe).

Uso (desde backend/, con el servidor detenido):
    python -m seeds.migrar_datos_a_supabase
"""
from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import models
from database import DATABASE_URL

RUTA_SQLITE = "sqlite:///./minelink.db"

if DATABASE_URL.startswith("sqlite"):
    print("DATABASE_URL sigue apuntando a SQLite — configura Supabase en .env primero.")
    raise SystemExit(1)

engine_origen = create_engine(RUTA_SQLITE, connect_args={"check_same_thread": False})
engine_destino = create_engine(DATABASE_URL)

SesionOrigen = sessionmaker(bind=engine_origen)
SesionDestino = sessionmaker(bind=engine_destino)

# Orden importa: Operacion primero (todo lo demás la referencia por FK),
# Empresa es independiente, el resto depende de Operacion.
MODELOS_EN_ORDEN = [
    models.Operacion,
    models.Empresa,
    models.Lead,
    models.DocumentoOperacion,
    models.InteresInversion,
]

origen = SesionOrigen()
destino = SesionDestino()

for Modelo in MODELOS_EN_ORDEN:
    tabla = Modelo.__tablename__
    ya_tiene_datos = destino.query(Modelo).first() is not None
    if ya_tiene_datos:
        print(f"'{tabla}' ya tiene datos en el destino, se omite.")
        continue

    filas = origen.query(Modelo).all()
    if not filas:
        print(f"'{tabla}': no hay filas en el origen.")
        continue

    columnas = [c.name for c in Modelo.__table__.columns]
    copiadas = 0
    for fila in filas:
        valores = {col: getattr(fila, col) for col in columnas}
        destino.add(Modelo(**valores))
        copiadas += 1
    destino.commit()
    print(f"'{tabla}': {copiadas} fila(s) copiada(s).")

# Reajustar las secuencias autoincrement de Postgres para las tablas con
# id entero, para que el próximo INSERT no choque con un id ya copiado.
TABLAS_CON_SERIAL = ["leads", "empresas", "documentos_operacion", "intereses_inversion"]
with engine_destino.connect() as conn:
    for tabla in TABLAS_CON_SERIAL:
        conn.execute(
            text(
                f"SELECT setval(pg_get_serial_sequence('{tabla}', 'id'), "
                f"COALESCE((SELECT MAX(id) FROM {tabla}), 1))"
            )
        )
    conn.commit()
print("Secuencias de Postgres reajustadas.")

origen.close()
destino.close()
print("Migración de datos completa.")

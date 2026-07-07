import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

# En local, sin configurar nada, se sigue usando SQLite (cero fricción para
# desarrollar). En producción, se define DATABASE_URL (Postgres/Supabase)
# como variable de entorno y el mismo código la usa sin cambios.
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./minelink.db")

# Supabase (y otros proveedores) a veces dan la URL como "postgres://",
# pero SQLAlchemy 2.x requiere el prefijo "postgresql://".
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

ES_SQLITE = DATABASE_URL.startswith("sqlite")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if ES_SQLITE else {},
)


if ES_SQLITE:

    @event.listens_for(engine, "connect")
    def _activar_wal_y_busy_timeout(conexion_dbapi, _record):
        """WAL permite lecturas concurrentes mientras alguien escribe (en vez
        del modo por defecto, que bloquea todo el archivo). busy_timeout hace
        que una escritura que choca con otra espere unos segundos en vez de
        fallar de inmediato con "database is locked". Solo aplica a SQLite:
        Postgres maneja la concurrencia de forma nativa."""
        cursor = conexion_dbapi.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

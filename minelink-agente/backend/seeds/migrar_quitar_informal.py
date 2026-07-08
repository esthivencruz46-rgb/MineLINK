# Migración: la situación "minero_informal" se eliminó del formulario
# dinámico (es el mismo caso que minero_artesanal: mismas preguntas).
# Convierte cualquier diagnóstico guardado con ese valor al valor vigente.
# Correr con: python -m seeds.migrar_quitar_informal (desde backend/)
# Usa el engine de database.py → respeta DATABASE_URL (SQLite o Supabase).
from sqlalchemy import text

from database import engine


def main() -> None:
    with engine.begin() as conn:
        resultado = conn.execute(
            text(
                "UPDATE operaciones SET situacion = 'minero_artesanal' "
                "WHERE situacion = 'minero_informal'"
            )
        )
        print(f"Filas actualizadas: {resultado.rowcount}")


if __name__ == "__main__":
    main()

# Migración: la colegiatura ahora se guarda solo como número (sin "CIP",
# espacios ni guiones). Normaliza las filas existentes de empresas.
# Correr con: python -m seeds.migrar_colegiatura_numero (desde backend/)
# Usa el engine de database.py → respeta DATABASE_URL (SQLite o Supabase).
from sqlalchemy import text

from database import engine


def main() -> None:
    with engine.begin() as conn:
        filas = conn.execute(
            text("SELECT id, colegiatura FROM empresas WHERE colegiatura IS NOT NULL")
        ).fetchall()
        cambiadas = 0
        for id_, colegiatura in filas:
            numero = "".join(c for c in colegiatura if c.isdigit())
            if numero and numero != colegiatura:
                conn.execute(
                    text("UPDATE empresas SET colegiatura = :n WHERE id = :i"),
                    {"n": numero, "i": id_},
                )
                cambiadas += 1
        print(f"Colegiaturas revisadas: {len(filas)} — normalizadas: {cambiadas}")


if __name__ == "__main__":
    main()

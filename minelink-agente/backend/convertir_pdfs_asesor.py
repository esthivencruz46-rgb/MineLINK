"""Utilidad de un solo uso (pero reutilizable): convierte cada PDF dentro
de context/asesor_conocimiento/ a un .md hermano con su texto ya extraído
(misma extracción que usa asesor.py en producción, PyMuPDF), y borra el
PDF original. Reduce muchísimo el peso en git (un PDF de 10 MB puede
convertirse en un .md de unos cientos de KB, solo texto) y evita que el
servidor tenga que volver a parsear el PDF pesado cada vez que arranca.

Uso: python convertir_pdfs_asesor.py (desde backend/)."""
from pathlib import Path

import asesor

RUTA = asesor._RUTA_CONOCIMIENTO_EXTRA


def main() -> None:
    pdfs = sorted(RUTA.rglob("*.pdf"))
    print(f"Encontrados {len(pdfs)} PDF en {RUTA}")
    total_antes = 0
    total_despues = 0
    for ruta_pdf in pdfs:
        peso_antes = ruta_pdf.stat().st_size
        texto = asesor._extraer_texto_pdf(ruta_pdf)
        if not texto.strip():
            print(f"  [SIN TEXTO, se deja el PDF intacto] {ruta_pdf.relative_to(RUTA)}")
            continue
        ruta_md = ruta_pdf.with_suffix(".md")
        ruta_md.write_text(texto, encoding="utf-8")
        peso_despues = ruta_md.stat().st_size
        ruta_pdf.unlink()
        total_antes += peso_antes
        total_despues += peso_despues
        print(
            f"  {ruta_pdf.relative_to(RUTA)} : {peso_antes/1024:.0f} KB -> "
            f"{peso_despues/1024:.0f} KB"
        )
    print()
    print(f"Total antes:  {total_antes/1024/1024:.1f} MB")
    print(f"Total despues: {total_despues/1024/1024:.1f} MB")


if __name__ == "__main__":
    main()

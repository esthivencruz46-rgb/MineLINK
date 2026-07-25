"""Sincroniza la cartera pública de proyectos (/proyectos) con el
conocimiento del asesor conversacional (julio 2026, pedido explícito de
Esthiven): un DocumentoAsesor por cada proyecto públicamente apto para
inversionistas, con EXACTAMENTE los mismos datos que cualquier visitante ya
ve en la tarjeta pública (`schemas.ProyectoPublicoOut`) — nada privado, nada
que no esté ya expuesto hoy en /proyectos. Esto es DISTINTO del resto del
conocimiento del asesor (leyes, guías): el asesor sigue sin conocer el
diagnóstico de nadie en particular (esa decisión no cambia), pero SÍ puede
hablar de los proyectos que la propia cartera ya publica para atraer
inversionistas — es información deliberadamente pública, no personal.

Reusa el mecanismo ya existente de "documentos subidos desde /admin"
(`DocumentoAsesor` + `asesor.actualizar_documentos_admin`, ver asesor.py): se
reindexa solo, sin redeploy, en la siguiente pregunta que le hagan al asesor
— necesario porque Render tiene disco efímero (un .md escrito en tiempo de
ejecución no sobreviviría al siguiente deploy) y el índice BM25 se cachea una
sola vez por proceso. El disparador (`routers/proyectos.py`, background task
al listar la cartera) vive fuera de este módulo — acá solo hay lógica pura +
la escritura a DocumentoAsesor.

`categoria = f"proyecto_{operacion_id}"` identifica cada fila de forma
estable para poder actualizarla o desactivarla más adelante — NO aparece en
la cita que ve el usuario final (`asesor._etiqueta_citable` solo usa el
último segmento de la etiqueta, derivado de `nombre`, nunca `categoria`)."""
from sqlalchemy.orm import Session

import models
import schemas

_PREFIJO_CATEGORIA = "proyecto_"

_ETIQUETAS_SEMAFORO = {
    "verde": "sin incendios legales activos",
    "amarillo": "con pendientes subsanables",
}


def _categoria(operacion_id: str) -> str:
    return f"{_PREFIJO_CATEGORIA}{operacion_id}"


def generar_texto_proyecto(publico: schemas.ProyectoPublicoOut) -> str:
    """Texto en español llano armado SOLO a partir de campos de
    ProyectoPublicoOut — por construcción, ningún dato privado (contacto,
    documentos financieros, etc.) puede colarse acá, porque ese schema nunca
    los incluye."""
    lineas = [
        f"# Proyecto en la cartera de MineLink: {publico.nombre_proyecto}",
        "",
        f"- Mineral: {publico.mineral}",
        f"- Región: {publico.region}",
    ]
    if publico.perfil:
        lineas.append(f"- Perfil de formalización: {publico.perfil}")
    if publico.semaforo_legal:
        detalle = _ETIQUETAS_SEMAFORO.get(publico.semaforo_legal, publico.semaforo_legal)
        lineas.append(f"- Track Legal: {publico.semaforo_legal} ({detalle})")
    if publico.indice_madurez is not None:
        lineas.append(f"- Madurez técnica: {publico.indice_madurez}/5")
    if publico.vende_liquidacion is not None:
        lineas.append(
            "- Vende con liquidación de ventas: "
            + ("sí" if publico.vende_liquidacion else "no")
        )
    if publico.ventas_verificadas:
        lineas.append("- Ventas con liquidación verificadas por el equipo de MineLink")
    if publico.capital_buscado:
        uso = f" — uso de fondos: {publico.uso_fondos}" if publico.uso_fondos else ""
        lineas.append(f"- Busca capital: S/ {publico.capital_buscado}{uso}")
    if publico.descripcion_operacion:
        lineas.append(f"- Descripción: {publico.descripcion_operacion}")
    lineas.append(f"- Ficha completa: /proyectos/{publico.operacion_id}")
    return "\n".join(lineas)


def sincronizar_documentos_asesor(
    db: Session, proyectos_publicos: list[schemas.ProyectoPublicoOut]
) -> None:
    """Crea/actualiza un DocumentoAsesor por cada proyecto de
    `proyectos_publicos` y desactiva los que ya no están ahí (ej. un
    semáforo legal pasó a rojo y el proyecto dejó de ser apto). IMPORTANTE:
    `proyectos_publicos` debe ser la lista COMPLETA de proyectos aptos, SIN
    ningún filtro de mineral/región — pasarle un subconjunto filtrado
    desactivaría por error los proyectos que quedaron fuera del filtro de
    esa consulta puntual."""
    ids_actuales = {_categoria(p.operacion_id) for p in proyectos_publicos}
    existentes = {
        d.categoria: d
        for d in db.query(models.DocumentoAsesor)
        .filter(models.DocumentoAsesor.categoria.like(f"{_PREFIJO_CATEGORIA}%"))
        .all()
    }

    for publico in proyectos_publicos:
        categoria = _categoria(publico.operacion_id)
        texto = generar_texto_proyecto(publico)
        nombre = f"Proyecto {publico.nombre_proyecto} ({publico.mineral}, {publico.region})"
        existente = existentes.get(categoria)
        if existente is None:
            db.add(
                models.DocumentoAsesor(
                    nombre=nombre, categoria=categoria, texto=texto, activo=True
                )
            )
        elif existente.texto != texto or existente.nombre != nombre or not existente.activo:
            existente.nombre = nombre
            existente.texto = texto
            existente.activo = True

    for categoria, doc in existentes.items():
        if categoria not in ids_actuales and doc.activo:
            doc.activo = False

    db.commit()

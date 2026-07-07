---
name: diagnostico-brechas
description: Usa esta skill al implementar o modificar el cálculo del score,
  la detección de brechas o el recomendador de empresas en el backend.
  Contiene la lógica de referencia completa en Python.
---

# Skill: Diagnóstico de brechas

## Fuente de verdad
Los puntos, ids y mapeos vienen de `context/criterios_score.md`.
Si ese archivo cambia, esta lógica se actualiza para reflejarlo — nunca
al revés.

## Lógica de referencia (scoring.py)

```python
# Puntos por pregunta — copiado de context/criterios_score.md
# Seguridad depende de tipo_mina: S5 (ventilación) solo aplica en
# minería subterránea; en tajo abierto sus 25 pts se reparten entre
# las otras 4 preguntas (6/6/6/7) para que la dimensión siga sumando 25.
PUNTOS_BASE = {
    "L1": 5, "L2": 5, "L3": 5, "L4": 5, "L5": 5,      # Legal 25
    "A1": 5, "A2": 5, "A3": 5,                          # Ambiental 15
    "O1": 5,                                            # Operativo 5
    "T1": 5, "T2": 5, "T3": 5, "T4": 5, "T5": 5, "T6": 5,  # Técnico 30
}

PUNTOS_SEGURIDAD_SUBTERRANEA = {"S1": 5, "S2": 5, "S3": 5, "S4": 5, "S5": 5}
PUNTOS_SEGURIDAD_TAJO_ABIERTO = {"S1": 6, "S2": 6, "S3": 6, "S4": 7}

DIMENSIONES_BASE = {
    "legal": ["L1", "L2", "L3", "L4", "L5"],
    "ambiental": ["A1", "A2", "A3"],
    "operativo": ["O1"],
    "tecnico": ["T1", "T2", "T3", "T4", "T5", "T6"],
}

# brecha (respuesta NO) → etiqueta de estudio del catálogo
ESTUDIO_POR_PREGUNTA = {
    "L1": "tramite_reinfo",
    "L2": "titularidad_concesion",
    "L3": "contrato_explotacion",
    "L4": "tramite_sunat",
    "L5": "levantamiento_georreferenciado",
    "A1": "igafom_correctivo",
    "A2": "igafom_preventivo",
    "A3": "aprobacion_instrumento_ambiental",
    "O1": "puesta_en_produccion",
    "T1": "informe_geologico",
    "T2": "muestreo_geoquimico",
    "T3": "analisis_laboratorio",
    "T4": "planos_geologicos",
    "T5": "levantamiento_topografico",
    "T6": "estimacion_recursos",
    "S1": "iperc",
    "S2": "sctr",
    "S3": "plan_seguridad",
    "S4": "evaluacion_geomecanica",
    "S5": "estudio_ventilacion",
}


def calcular_diagnostico(respuestas: dict[str, bool], tipo_mina: str) -> dict:
    """respuestas: ids booleanos aplicables según tipo_mina ('subterranea'
    incluye S5, 'tajo_abierto' NO debe incluir S5). Lógica pura, sin BD."""
    puntos_seguridad = (
        PUNTOS_SEGURIDAD_SUBTERRANEA
        if tipo_mina == "subterranea"
        else PUNTOS_SEGURIDAD_TAJO_ABIERTO
    )
    puntos = {**PUNTOS_BASE, **puntos_seguridad}
    dimensiones_ids = {**DIMENSIONES_BASE, "seguridad": list(puntos_seguridad.keys())}

    ids_esperados = set(puntos.keys())
    if set(respuestas.keys()) != ids_esperados:
        raise ValueError("Deben venir exactamente los ids de pregunta aplicables a tipo_mina")

    por_dimension = {}
    for dim, ids in dimensiones_ids.items():
        obtenido = sum(puntos[i] for i in ids if respuestas[i])
        maximo = sum(puntos[i] for i in ids)
        por_dimension[dim] = {"puntaje": obtenido, "maximo": maximo}

    brechas = sorted({
        ESTUDIO_POR_PREGUNTA[i]
        for i, ok in respuestas.items() if not ok
    })

    return {
        "score_total": sum(d["puntaje"] for d in por_dimension.values()),
        "dimensiones": por_dimension,
        "bloqueado": not respuestas["L1"],
        "brechas": brechas,
    }
```

Las 3 preguntas informativas de Operativo (producción mensual, maquinaria,
número de trabajadores) NUNCA entran en `respuestas` ni en el cálculo:
son campos de texto libre aparte en la request, opcionales, con
"prefiero no decirlo" como respuesta válida.

## Recomendador (en routers/empresas.py)

```python
def recomendar(empresas, brechas: list[str], region: str):
    """Empresas activas de la región que cubren >=1 brecha.
    Orden: más coincidencias primero, luego más años de servicio."""
    candidatas = []
    for e in empresas:
        if not e.activa or region not in e.regiones:
            continue
        coincidencias = set(e.estudios) & set(brechas)
        if coincidencias:
            candidatas.append((len(coincidencias), e.anios_servicio, e))
    candidatas.sort(key=lambda t: (-t[0], -t[1]))
    return [(e, n) for n, _, e in candidatas]  # empresa + nº coincidencias
```

## Tests obligatorios (tests/test_scoring.py)
1. Todo SÍ, subterránea → score 100, brechas vacías, bloqueado False
2. Todo NO, subterránea → score 0, bloqueado True, brechas = los 19 estudios únicos
3. L1 NO y resto SÍ (subterránea) → score 95, bloqueado True
4. Faltan ids o sobran → ValueError
5. Tajo abierto: no debe aceptarse S5 en respuestas (ValueError si viene) y
   los 25 pts de Seguridad deben repartirse 6/6/6/7 entre S1-S4
6. Tajo abierto, todo SÍ → score 100 igual (sin S5 en el cálculo)

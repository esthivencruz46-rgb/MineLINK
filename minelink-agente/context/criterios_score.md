# Criterios de score y mapeo de brechas — MineLink

> Fuente de verdad del negocio. Ningún agente puede contradecir este archivo.
> Basado en: Ley 32537 (dic. 2025), D.Leg. 1293/1336, D.S. 038-2017-EM,
> D.S. 024-2016-EM, R.M. 473-2017-MEM. Revisado y reestructurado julio 2026.

## Regla de exclusión absoluta
Sin REINFO vigente (pregunta L1 = NO) → score bloqueado: la operación no
recibe puntaje público. El diagnóstico igual se completa y se muestran las
brechas, porque ese minero es el que MÁS necesita orientación.

## Dato previo 1: situación del usuario (formulario dinámico)
Filosofía: *"No todos los proyectos mineros son iguales; el sistema primero
identifica la situación del usuario y luego construye un formulario
personalizado con únicamente la información que corresponde a su caso."*

Antes de todo se pregunta `situacion`, que decide qué preguntas aplican:

| situacion | Etiqueta | Preguntas que aplican |
|---|---|---|
| minero_artesanal | Soy minero artesanal | TODAS (comportamiento original) |
| minero_informal | Soy minero informal (sin REINFO o en trámite) | TODAS — su diferencia es el estado, no lo que se evalúa |
| concesionario | Tengo una concesión minera y busco apoyo | Todas MENOS L3 (el contrato de explotación es para quien trabaja en concesión ajena) |
| yacimiento | No soy minero, pero poseo un yacimiento o mineral | SOLO L2, L4, L5 y T1–T6 (sin operación no aplican REINFO, ambiental, producción ni seguridad; también se omiten las informativas O2–O4) |

Reglas derivadas:
- El score SIEMPRE se normaliza a 0–100 sobre el máximo aplicable
  (para el set completo el máximo ya es 100, así que nada cambia en los
  casos originales).
- Solo se muestran las dimensiones con preguntas aplicables.
- La regla de exclusión REINFO se mantiene intacta: si L1 no se pregunta
  (yacimiento), el proyecto queda `bloqueado = true` y por lo tanto NUNCA
  aparece en la vitrina pública — sin REINFO no hay listado, sin excepciones.
- La definición ejecutable vive en `backend/scoring.py` → `SITUACIONES`
  (y su espejo en `frontend/src/data/preguntas.ts`); este archivo manda.

## Dato previo 2: tipo de mina
Antes del cuestionario se pregunta `tipo_mina`: **subterránea** o **tajo
abierto (superficie)**. Este dato determina si la pregunta S5 (ventilación)
aplica — solo tiene sentido en minería subterránea.

## Las 5 dimensiones (total 100 puntos)

| Dimensión | Peso (subterránea) | Peso (tajo abierto) | Quién la verifica en la vida real |
|---|---|---|---|
| Legal | 25 | 25 | MINEM / DREM / INGEMMET |
| Ambiental | 15 | 15 | DREM / MINEM |
| Operativo | 5 | 5 | Autodeclarado |
| Técnico | 30 | 30 | Geólogo colegiado (CIP) |
| Seguridad | 25 | 25 | Visita técnica / ingeniero de seguridad |

El peso de cada dimensión es automático: 5 puntos por cada pregunta SÍ/NO
que contiene (100 / nº total de preguntas aplicables). En minería
subterránea Seguridad reparte sus 25 puntos entre 5 preguntas (5 c/u); en
tajo abierto, entre las 4 preguntas que aplican (S5 no se pregunta) con
reparto 6/6/6/7 para que la dimensión siga sumando 25.

## Las preguntas del cuestionario

Cada pregunta SÍ/NO tiene: id, texto, puntos, y el estudio que resuelve la
brecha si la respuesta es NO. Las preguntas marcadas "informativa" NO
puntúan: se guardan como dato de contexto (útil para Esthiven y para las
empresas), y el minero puede responder "Prefiero no decirlo".

### Bloque 1 — LEGAL (25 pts, 5 preguntas x 5 pts)
| id | Pregunta | Pts | Brecha → estudio requerido |
|---|---|---|---|
| L1 | ¿Está inscrito en REINFO? | 5 | tramite_reinfo |
| L2 | ¿Es titular de la concesión? | 5 | titularidad_concesion |
| L3 | ¿Cuenta con contrato de explotación? | 5 | contrato_explotacion |
| L4 | ¿Tiene RUC activo? | 5 | tramite_sunat |
| L5 | ¿Cuenta con coordenadas georreferenciadas? | 5 | levantamiento_georreferenciado |

### Bloque 2 — AMBIENTAL (15 pts, 3 preguntas x 5 pts)
| id | Pregunta | Pts | Brecha → estudio |
|---|---|---|---|
| A1 | ¿Tiene IGAFOM Correctivo? | 5 | igafom_correctivo |
| A2 | ¿Tiene IGAFOM Preventivo? | 5 | igafom_preventivo |
| A3 | ¿Su instrumento ambiental está aprobado? | 5 | aprobacion_instrumento_ambiental |

### Bloque 3 — OPERATIVO (5 pts, 1 pregunta que puntúa + 3 informativas)
| id | Pregunta | Pts | Tipo | Brecha → estudio |
|---|---|---|---|---|
| O1 | ¿Actualmente produce mineral? | 5 | SÍ/NO | puesta_en_produccion |
| O2 | ¿Cuánto produce por mes? | — | informativa (texto libre / "prefiero no decirlo") | no aplica |
| O3 | ¿Qué maquinaria posee? | — | informativa (texto libre / "prefiero no decirlo") | no aplica |
| O4 | ¿Cuántos trabajadores tiene? | — | informativa (número / "prefiero no decirlo") | no aplica |

### Bloque 4 — TÉCNICO (30 pts, 6 preguntas x 5 pts)
| id | Pregunta | Pts | Brecha → estudio |
|---|---|---|---|
| T1 | ¿Tiene informe geológico? | 5 | informe_geologico |
| T2 | ¿Cuenta con muestreo geoquímico? | 5 | muestreo_geoquimico |
| T3 | ¿Tiene análisis de laboratorio? | 5 | analisis_laboratorio |
| T4 | ¿Posee planos geológicos? | 5 | planos_geologicos |
| T5 | ¿Tiene topografía? | 5 | levantamiento_topografico |
| T6 | ¿Cuenta con una estimación de recursos? | 5 | estimacion_recursos |

### Bloque 5 — SEGURIDAD (25 pts, 4 o 5 preguntas según tipo_mina)
| id | Pregunta | Pts (subterránea) | Pts (tajo abierto) | Brecha → estudio |
|---|---|---|---|---|
| S1 | ¿Cuenta con IPERC? | 5 | 6 | iperc |
| S2 | ¿Tiene SCTR para los trabajadores? | 5 | 6 | sctr |
| S3 | ¿Dispone de un plan de seguridad? | 5 | 6 | plan_seguridad |
| S4 | ¿Tiene evaluación geomecánica? | 5 | 7 | evaluacion_geomecanica |
| S5 | ¿Cuenta con estudio de ventilación? (solo minería subterránea) | 5 | no aplica | estudio_ventilacion |

## Catálogo de tipos de estudio (etiquetas exactas para la BD)
```
tramite_reinfo, titularidad_concesion, contrato_explotacion, tramite_sunat,
levantamiento_georreferenciado, igafom_correctivo, igafom_preventivo,
aprobacion_instrumento_ambiental, puesta_en_produccion, informe_geologico,
muestreo_geoquimico, analisis_laboratorio, planos_geologicos,
levantamiento_topografico, estimacion_recursos, iperc, sctr, plan_seguridad,
evaluacion_geomecanica, estudio_ventilacion
```
Cada empresa o consultor tiene un array `estudios[]` con estas etiquetas
exactas. El recomendador cruza las brechas del minero contra ese array.

## Cálculo del score
- score_dimension = suma de puntos de respuestas SÍ del bloque (las
  preguntas informativas de Operativo NUNCA puntúan)
- score_total = suma de las 5 dimensiones (siempre 100 posibles en total,
  con o sin S5 según tipo_mina)
- Siempre entero, nunca decimales
- Si L1 = NO → se calcula igual pero bloqueado = true
- Si tipo_mina = tajo abierto → S5 no se pregunta ni se cuenta como
  brecha; los otros 4 ítems de Seguridad se reparten los 25 puntos

## Semáforo
| Rango | Color | Etiqueta para el minero |
|---|---|---|
| bloqueado | rojo oscuro | "Necesitas tu REINFO primero" |
| 1–49 | rojo | "En desarrollo" |
| 50–79 | ámbar | "En progreso" |
| 80–100 | verde | "Casi formal" |

## Verificación REINFO (fase MVP)
El minero puede ingresar su código REINFO al final del cuestionario.
La verificación es MANUAL: el código queda en el lead y Esthiven lo
consulta en pad.minem.gob.pe (MINEM no tiene API pública). Nunca
prometer al minero "verificación automática".

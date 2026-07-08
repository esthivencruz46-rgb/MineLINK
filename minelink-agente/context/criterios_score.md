# Criterios de score y mapeo de brechas — MineLink

> Fuente de verdad del negocio. Ningún agente puede contradecir este archivo.
> Basado en: Ley 32537 (dic. 2025), D.Leg. 1293/1336, D.S. 038-2017-EM,
> D.S. 024-2016-EM, R.M. 473-2017-MEM. Revisado y reestructurado julio 2026.

## Regla de exclusión absoluta (ACTUALIZADA — ya no bloquea el listado)
`bloqueado` (= no ha iniciado REINFO/proceso de formalización, pregunta L1
= NO) sigue calculándose y se muestra al minero como estado informativo en
su propio resultado ("Necesitas tu REINFO primero"). **YA NO filtra la
vitrina pública**: un proyecto sin REINFO/trámite iniciado aparece igual en
`/proyectos` — el objetivo no es castigar al usuario por no tenerlo, sino
medir su nivel de incertidumbre legal (ver Ruta 2 más abajo). El diagnóstico
siempre se completa y se muestran las brechas, porque ese usuario es el que
MÁS necesita orientación.

## Dato previo 1: situación del usuario → DOS RUTAS distintas
Filosofía: *"No todos los proyectos mineros son iguales; el sistema primero
identifica la situación del usuario y luego construye un formulario
personalizado con únicamente la información que corresponde a su caso."*

`situacion` decide no solo qué preguntas Sí/No de formalización aplican,
sino también qué **perfil informativo** (no puntúa) se recoge antes. Son 2
rutas completamente distintas, no una variación de la misma:

### Ruta 1 — `minero_artesanal` (ya tiene una operación)
Perfil informativo (Operación/Producción, se guarda en `Operacion`, NUNCA
puntúa): estado de la operación (activa/no activa/temporal), tipo de
explotación (subterránea/tajo abierto/aluvial/mixta/otro — de aquí se
deriva `tipo_mina`, ya no se pregunta aparte), material comercializado,
**elementos económicos que extrae (selección múltiple, → `mineral` unidos
por coma)**, forma de comercialización, tiempo de operación, producción
mensual (valor+unidad en una sola pregunta). Si conoce la ley, se pregunta
**una ley (valor+unidad, una sola pregunta) por CADA elemento marcado**
(ej. si marcó oro y plata, dos preguntas de ley) — todas se combinan en
`ley_promedio` como `"Oro: 2.5 g/t; Plata: 30 g/t"`. Luego cómo se obtuvo
la ley, y si cuenta con resultados de laboratorio.

Formalización: el cuestionario Sí/No de siempre, **TODAS las preguntas**
(L1-L5, A1-A3, O1, T1-T6, S1-S5) — sin cambios respecto a antes. `L6`
(vigencia de concesión) NO aplica a esta ruta.

### Ruta 2 — `concesionario` (recién inicia, todavía no opera)
Perfil informativo (Concesión/Exploración, nunca puntúa): vigencia de la
concesión (también prellena `L6`), tipo de depósito (si lo conoce), etapa
del proyecto, trabajos de exploración realizados (muestreo/calicatas/
trincheras/perforación/cartografía/otro — multi), tipo de apoyo que busca.
NO se pregunta nada de producción/comercialización/ventas — todavía no
opera.

Formalización: set MUCHO más chico, mide incertidumbre gradual en vez de
todo-o-nada: `L1` (¿inició su proceso de formalización/REINFO?), `L2`
(titularidad), `L3` (contrato/autorización, solo si no es titular), `L4`
(RUC), `L6` (vigencia de la concesión, NUEVO). De lo Técnico solo `T1`
(información geológica disponible), `T3` (ensayes de laboratorio), `T6`
(estimaciones de leyes). Las dimensiones Ambiental/Operativo/Seguridad
quedan vacías y se ocultan (no aplican — sin operación no hay nada que
evaluar ahí).

| situacion | ids de formalización que aplican |
|---|---|
| minero_artesanal | L1,L2,L3,L4,L5,A1,A2,A3,O1,T1-T6,S1-S5 (todas, sin L6) |
| concesionario | L1,L2,L3,L4,L6,T1,T3,T6 (8 en total) |

Reglas derivadas (sin cambios):
- El score SIEMPRE se normaliza a 0–100 sobre el máximo aplicable a esa ruta.
- Solo se muestran las dimensiones con preguntas aplicables.
- Preguntas ya respondidas en el perfil informativo NO se repiten en el
  Sí/No (se copian silenciosamente a `respuestas` antes de calcular).
- La definición ejecutable vive en `backend/scoring.py` → `SITUACIONES`
  (y su espejo en `frontend/src/data/preguntas.ts`); este archivo manda.

## Dato previo 2: tipo de mina
`tipo_mina` (**subterránea** o **tajo abierto**) determina si la pregunta
S5 (ventilación) aplica — solo tiene sentido en minería subterránea.
**Ya no se le pregunta al minero en el formulario inicial** (esa pregunta,
junto con departamento y mineral, se recogerá en otro lugar — pendiente
de definir): por ahora el diagnóstico usa siempre `tipo_mina=subterranea`
(las 5 preguntas de Seguridad, incluida S5) y valores genéricos
("no especificado") para región y mineral. Esto significa que, hasta que
se implemente esa recolección, los proyectos nuevos en la vitrina pública
no se pueden filtrar por mineral/departamento real.

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

### Bloque 1 — LEGAL (25 pts en Ruta 1 / L1,L2,L3,L4,L5; 25 pts en Ruta 2 / L1,L2,L3,L4,L6)
| id | Pregunta | Pts | Ruta | Brecha → estudio requerido |
|---|---|---|---|---|
| L1 | ¿Inscrito en REINFO? / ¿Iniciaste tu proceso de formalización? | 5 | ambas | tramite_reinfo |
| L2 | ¿Es titular de la concesión? | 5 | ambas | titularidad_concesion |
| L3 | ¿Cuenta con contrato de explotación / autorización? (solo si no es titular) | 5 | ambas | contrato_explotacion |
| L4 | ¿Tiene RUC activo? | 5 | ambas | tramite_sunat |
| L5 | ¿Cuenta con coordenadas georreferenciadas? | 5 | solo Ruta 1 | levantamiento_georreferenciado |
| L6 | ¿La concesión se encuentra vigente? | 5 | solo Ruta 2 | vigencia_concesion |

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
levantamiento_georreferenciado, vigencia_concesion, igafom_correctivo,
igafom_preventivo, aprobacion_instrumento_ambiental, puesta_en_produccion,
informe_geologico, muestreo_geoquimico, analisis_laboratorio,
planos_geologicos, levantamiento_topografico, estimacion_recursos, iperc,
sctr, plan_seguridad, evaluacion_geomecanica, estudio_ventilacion
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
| bloqueado | rojo oscuro | "Necesitas tu REINFO primero" (informativo, ya no oculta el proyecto de la vitrina) |
| 1–49 | rojo | "En desarrollo" |
| 50–79 | ámbar | "En progreso" |
| 80–100 | verde | "Casi formal" |

## Verificación REINFO (fase MVP)
El minero puede ingresar su código REINFO al final del cuestionario.
La verificación es MANUAL: el código queda en el lead y Esthiven lo
consulta en pad.minem.gob.pe (MINEM no tiene API pública). Nunca
prometer al minero "verificación automática".

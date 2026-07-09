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
Perfil informativo (se guarda en `Operacion`, NUNCA puntúa), en bloques:
1. **Operación actual**: activa/no activa/temporal; tipo de explotación
   (subterránea/tajo abierto/aluvial/mixta/otro — de aquí se deriva
   `tipo_mina`); material comercializado; **elementos económicos que
   extrae (selección múltiple, → `mineral` unidos por coma)**; forma de
   comercialización; tiempo de operación; producción mensual (valor+unidad
   en una sola pregunta).
2. **Conocimiento técnico**: si conoce la ley, se pregunta **una ley
   (valor+unidad) por CADA elemento marcado** en el bloque 1 (ej. oro y
   plata → dos preguntas), combinadas en `ley_promedio` como
   `"Oro: 2.5 g/t; Plata: 30 g/t"`; cómo se obtuvo la ley; si cuenta con
   resultados de laboratorio (3 niveles: no / algunos / completos).
3. **Equipo y operación**: nº de trabajadores + modalidad (planilla/
   destajo/combinado), maquinaria principal (texto libre), provincia.
4. **Ambiente y operación específica**: si usa mercurio/cianuro o genera
   relaves (`sustancias_toxicas`) y cómo los gestiona (condicional); acceso
   a agua limpia; acceso a energía.
5. **Oportunidad e inversión**: tipo de apoyo que busca primordialmente
   (opción única, `tipo_apoyo`); monto aproximado que necesita
   (`monto_requerido`, bucket); plazo para usarlo (`plazo_capital`); para
   qué lo usaría primero (`uso_fondos_diagnostico`); por qué lo necesita
   ahora (`motivo_capital`, texto breve); producción objetivo en 12 meses.
   **Estos 4 primeros reemplazan lo que antes se preguntaba recién al
   registrarse** — `POST /leads` copia `monto_requerido`/
   `uso_fondos_diagnostico` a `Lead.capital_buscado`/`Lead.uso_fondos` como
   valor inicial; el minero los puede afinar después desde Mi Cuenta.
6. **Riesgos y conformidad**: incidentes en los últimos 2 años (clausura/
   multa/accidente denunciado); conflictividad con comunidades; permisos/
   relaciones formales con comunidades; acceso logístico a la mina.
7. **Capacidad del operador**: años de experiencia de quien dirige;
   capacitación/colegiatura; si puede documentar con fotos o reportes
   (`documentacion_disponible`, prellena `T7`); estructura de propiedad.
8. **Visión a futuro**: plan para formalizar; qué es lo más importante
   para crecer (`prioridad_crecimiento`).

Formalización: el cuestionario Sí/No, **L1-L5, A1-A4 (A4 condicional),
O1, T1-T7, S1-S5** — `L6` y `R1` (Social) NO aplican a esta ruta. `T7` y
(si aplica) `A4` nunca se preguntan aparte: se prellenan desde el bloque 7
y el bloque 4 del perfil respectivamente (ver "Preguntas condicionales y
prellenadas" más abajo).

### Ruta 2 — `concesionario` (recién inicia, todavía no opera)
Perfil informativo (nunca puntúa), en bloques:
1. **Titularidad y vigencia**: si es titular; documento que lo autoriza
   (si no es titular); si la concesión está vigente (3 niveles: sí/no/en
   trámite de renovación, también prellena `L6`); pagos de derecho de
   vigencia al día.
2. **Geología y depósito**: elemento económico principal esperado; tipo de
   depósito (estructurado: veta epitérmica/pórfido/aluvial/masivo/
   diseminado/sedimentario/otro); estimación de toneladas (bucket); ley
   esperada (texto libre, opcional).
3. **Etapa del proyecto**: etapa (solo concesión/exploración inicial/
   avanzada/pre-factibilidad/listo para operar); trabajos de exploración
   realizados (multi); información geológica disponible (3 niveles);
   ensayes de laboratorio (3 niveles); estimaciones de leyes confirmadas
   (3 niveles: no/preliminar/por terceros).
4. **Proyecto y escala**: producción objetivo anual; capital estimado para
   iniciar (`monto_requerido`, bucket — escala mucho mayor que Ruta 1);
   si ya cuenta con capital o fuentes de financiamiento; si hizo un
   estudio de prefactibilidad/factibilidad (`estudio_previo`, prellena
   `T7`).
5. **Historial y riesgos**: si la concesión fue operada antes; pasivos
   ambientales heredados (prellena `A1`); conflictividad comunitaria
   conocida (prellena `R1`); acceso a agua; acceso a energía.
6. **Formalización**: si inició REINFO (no/en trámite/aprobado — solo
   "aprobado" prellena `L1`); si cuenta con RUC (no/activo/inactivo — solo
   "activo" prellena `L4`).
7. **Capacidad y equipo**: experiencia del titular/promotor; background
   profesional (opcional); si tiene equipo técnico definido; tipo de socio
   que busca; siguiente hito técnico/administrativo; timeline esperado
   hasta operación.
8. **Motivación y estructura**: por qué inició el proyecto; qué es lo más
   importante para desarrollarlo (opción única, `tipo_apoyo`); estructura
   de propiedad.

Formalización: set reducido, mide incertidumbre legal/ambiental/social
gradual en vez de todo-o-nada: **L1, L2, L3 (solo si no es titular), L4,
L6** (Legal); **A1 "sin pasivos ambientales heredados", A2 "plan de
gestión ambiental preliminar"** (Ambiental — A2 se pregunta directo, sin
prefill); **T1, T3, T6, T7** (Técnico); **R1 "sin conflictividad
comunitaria activa"** (Social, dimensión nueva). Operativo y Seguridad
quedan vacíos y se ocultan (no aplican — sin operación no hay nada que
evaluar ahí).

| situacion | ids de formalización que aplican |
|---|---|
| minero_artesanal | L1-L5, A1-A3 (+ A4 si declaró sustancias tóxicas), O1, T1-T7, S1-S5 |
| concesionario | L1,L2,L3,L4,L6,A1,A2,T1,T3,T6,T7,R1 (12 en total) |

## Preguntas condicionales y prellenadas (además de L1/L2/L4/L6)
- **A4** ("¿Plan de manejo para mercurio/cianuro/relaves?", Ruta 1): solo
  es un id esperado si el minero declaró `sustancias_toxicas` distinto de
  "no" en el bloque 4 del perfil. Cuando aplica, se prellena desde
  `gestion_sustancias` (cualquier gestión declarada que no sea "no se
  gestiona" cuenta como Sí) — nunca se pregunta como pantalla aparte.
- **T7** (ambas rutas, texto distinto por ruta — "¿Documentas tu operación
  con fotos o reportes?" en Ruta 1, "¿Cuenta con estudio de
  prefactibilidad/factibilidad?" en Ruta 2): siempre se prellena, desde
  `documentacion_disponible` (Ruta 1) o `estudio_previo` (Ruta 2).
- **A1 (Ruta 2)**: se prellena desde `pasivos_ambientales` ("no" → Sí).
- **R1 (Ruta 2)**: se prellena desde `conflictividad_social` ("no" → Sí).

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

## Las 6 dimensiones

| Dimensión | Peso Ruta 1 (subterránea) | Peso Ruta 1 (tajo abierto) | Peso Ruta 2 | Quién la verifica en la vida real |
|---|---|---|---|---|
| Legal | 25 | 25 | 25 | MINEM / DREM / INGEMMET |
| Ambiental | 15-20* | 15-20* | 10 | DREM / MINEM |
| Operativo | 5 | 5 | no aplica | Autodeclarado |
| Técnico | 35 | 35 | 20 | Geólogo colegiado (CIP) |
| Seguridad | 25 | 25 | no aplica | Visita técnica / ingeniero de seguridad |
| Social | no aplica | no aplica | 5 | Autodeclarado |

\* Ambiental en Ruta 1 llega a 20 pts solo si `A4` aplica (declaró
mercurio/cianuro/relaves); si no, se queda en 15 y el score se sigue
normalizando sobre el máximo real (no se penaliza por no tener A4).

El peso de cada dimensión es automático: 5 puntos por cada pregunta SÍ/NO
que contiene (el score total se normaliza a 0-100 sobre el máximo
aplicable a cada caso, así el peso relativo por pregunta siempre da 5 y no
hace falta ajustar tablas manualmente). En minería subterránea Seguridad
reparte sus 25 puntos entre 5 preguntas (5 c/u); en tajo abierto, entre
las 4 preguntas que aplican (S5 no se pregunta) con reparto 6/6/6/7 para
que la dimensión siga sumando 25.

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

### Bloque 2 — AMBIENTAL (15 pts Ruta 1, +5 si A4 aplica; 10 pts Ruta 2)
Redefinido julio 2026 — antes A1/A2 eran "IGAFOM Correctivo"/"IGAFOM
Preventivo" por separado; ahora A1 fusiona ambos (uno u otro según si ya
opera) y A2 pasa a ser la vigencia del instrumento. En Ruta 2 el mismo id
significa algo distinto (ver columna Ruta 2).

| id | Pregunta (Ruta 1) | Pregunta (Ruta 2) | Pts | Brecha → estudio |
|---|---|---|---|---|
| A1 | ¿Tiene tu IGAFOM aprobado? (Correctivo si ya operas, Preventivo si vas a operar) | ¿La concesión está libre de pasivos ambientales heredados? (prellenada) | 5 | igafom_aprobado |
| A2 | ¿Su instrumento ambiental está vigente? | ¿Tienes un plan de gestión ambiental preliminar? (se pregunta directo) | 5 | instrumento_ambiental_vigente |
| A3 | ¿No ha tenido clausuras ambientales en los últimos 3 años? | no aplica | 5 | sin_clausura_ambiental |
| A4 | ¿Cuenta con plan de manejo para mercurio/cianuro/relaves? (condicional, prellenada) | no aplica | 5 | plan_manejo_residuos |

### Bloque 3 — OPERATIVO (5 pts, 1 pregunta que puntúa)
| id | Pregunta | Pts | Tipo | Brecha → estudio |
|---|---|---|---|---|
| O1 | ¿Actualmente produce mineral? | 5 | SÍ/NO | puesta_en_produccion |

Producción mensual, maquinaria y nº de trabajadores ya NO son
"informativas" sueltas post-diagnóstico — desde Fase 1 se preguntan dentro
del perfil informativo de Ruta 1 (bloques 1 y 3), nunca puntúan.

### Bloque 4 — TÉCNICO (35 pts Ruta 1 / 7 preguntas; 20 pts Ruta 2 / T1,T3,T6,T7)
| id | Pregunta | Pts | Brecha → estudio |
|---|---|---|---|
| T1 | ¿Tiene informe geológico? | 5 | informe_geologico |
| T2 | ¿Cuenta con muestreo geoquímico? | 5 | muestreo_geoquimico |
| T3 | ¿Tiene análisis de laboratorio? | 5 | analisis_laboratorio |
| T4 | ¿Posee planos geológicos? | 5 | planos_geologicos |
| T5 | ¿Tiene topografía? | 5 | levantamiento_topografico |
| T6 | ¿Cuenta con una estimación de recursos? | 5 | estimacion_recursos |
| T7 | ¿Documenta con fotos/reportes? (Ruta 1) / ¿Tiene estudio de prefactibilidad-factibilidad? (Ruta 2) — siempre prellenada | 5 | documentacion_operacion |

### Bloque 5 — SEGURIDAD (25 pts, 4 o 5 preguntas según tipo_mina)
| id | Pregunta | Pts (subterránea) | Pts (tajo abierto) | Brecha → estudio |
|---|---|---|---|---|
| S1 | ¿Cuenta con IPERC? | 5 | 6 | iperc |
| S2 | ¿Tiene SCTR para los trabajadores? | 5 | 6 | sctr |
| S3 | ¿Dispone de un plan de seguridad? | 5 | 6 | plan_seguridad |
| S4 | ¿Tiene evaluación geomecánica? | 5 | 7 | evaluacion_geomecanica |
| S5 | ¿Cuenta con estudio de ventilación? (solo minería subterránea) | 5 | no aplica | estudio_ventilacion |

### Bloque 6 — SOCIAL (5 pts, solo Ruta 2)
Dimensión nueva (julio 2026), exclusiva de Ruta 2 por ahora — un proyecto
que recién inicia no tiene historial operativo que evaluar en Seguridad,
pero sí puede tener conflictividad social alrededor de la concesión.

| id | Pregunta | Pts | Brecha → estudio |
|---|---|---|---|
| R1 | ¿No hay conflictividad comunitaria activa alrededor de la concesión? (prellenada desde `conflictividad_social`) | 5 | gestion_conflictividad_social |

## Catálogo de tipos de estudio (etiquetas exactas para la BD)
```
tramite_reinfo, titularidad_concesion, contrato_explotacion, tramite_sunat,
levantamiento_georreferenciado, vigencia_concesion, igafom_aprobado,
instrumento_ambiental_vigente, sin_clausura_ambiental, plan_manejo_residuos,
puesta_en_produccion, informe_geologico, muestreo_geoquimico,
analisis_laboratorio, planos_geologicos, levantamiento_topografico,
estimacion_recursos, documentacion_operacion, iperc, sctr, plan_seguridad,
evaluacion_geomecanica, estudio_ventilacion, gestion_conflictividad_social
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

---

# Score de Atractivo de Inversión (Fase 2, julio 2026)

Segundo score, **distinto** del MineScore de formalización de arriba.
Mide qué tan atractivo es el proyecto para un inversionista combinando
escala económica, viabilidad técnica, riesgo ambiental/social, capacidad
del equipo y claridad de la oportunidad — la formalización es UN
ingrediente más (ver tabla de pesos), no el resultado final. Se calcula
siempre a partir del perfil informativo (nunca de las preguntas Sí/No
directamente) — lógica pura en `backend/scoring.py` →
`calcular_score_inversion()`.

**Dónde se ve**: es el número público y principal en la ficha del
proyecto (reemplaza al MineScore como número grande del panel lateral) y
decide el orden de `/proyectos`. El MineScore de formalización sigue
siendo el número principal en las pantallas privadas del minero
(`/resultado`, `/mi-cuenta`, `/mi-concesion`) — ahí no cambia nada.

## Pesos por dimensión

| Dimensión | Ruta 1 | Ruta 2 |
|---|---|---|
| Formalización (= `score_actual` del MineScore, sin recalcular) | 20% | 15% |
| Escala económica | 25% | 30% |
| Viabilidad técnica | 15% | 20% |
| Riesgo ambiental/social | 15% | 15% |
| Capacidad del equipo | 10% | 10% |
| Claridad de oportunidad | 15% | 10% |

`score_inversion = round(Σ peso_dim × subscore_dim)`. Cada subscore
(salvo Formalización) es el **promedio de 2-3 señales** sacadas de
preguntas del perfil informativo (Fase 1), cada una normalizada a 0-100:
dato ausente = 0, dato presente = puntos según qué tan favorable es la
respuesta. Las tablas exactas de "respuesta → puntos" por señal viven en
`scoring.py` (`_subscores_ruta1`/`_subscores_ruta2` y sus tablas
`_TABLA_*`) — son la fuente de verdad ejecutable; este documento describe
de qué pregunta sale cada señal, no el número exacto (para no duplicar y
desincronizar).

## Origen de las señales por dimensión

| Dimensión | Ruta 1 (de qué preguntas sale) | Ruta 2 |
|---|---|---|
| Escala económica | Producción mensual declarada, ley conocida, producción objetivo 12 meses | Toneladas estimadas del depósito, ley esperada, producción objetivo anual |
| Viabilidad técnica | Resultados de laboratorio, documentación disponible (fotos/reportes) | Información geológica disponible, ensayes de laboratorio, estudio de prefactibilidad/factibilidad |
| Riesgo ambiental/social | Uso de mercurio/cianuro/relaves y su gestión, conflictividad comunitaria, permisos/relaciones con comunidades | Pasivos ambientales heredados, conflictividad comunitaria conocida |
| Capacidad del equipo | Experiencia del operador, capacitación/colegiatura | Experiencia del titular/promotor, si tiene equipo técnico definido |
| Claridad de oportunidad | Monto requerido, plazo para usar el capital, motivo de la necesidad | Monto requerido, capital ya disponible, timeline esperado hasta operación |

## Notas de diseño
- Un perfil completamente vacío en Ruta 1 no da exactamente 0: la señal de
  riesgo ambiental/social asume "no usa sustancias tóxicas" cuando el
  campo está vacío (ausencia de declaración ≠ riesgo), así que esa señal
  sola vale 100 de las 3 que promedia esa dimensión. En Ruta 2 sí da 0
  exacto (no tiene ese caso especial).
- Nunca lanza excepción por datos faltantes — es intencional: una
  operación diagnosticada antes de Fase 1/2 (sin estos campos) igual
  recibe un `score_inversion` bajo pero válido, no rompe el listado.
- No hay gate de "perfil completo": el wizard del diagnóstico ya obliga a
  responder casi todas las preguntas de opción única antes de dejar
  avanzar (solo unas pocas de texto libre son opcionales), así que en la
  práctica el score siempre se calcula sobre un perfil casi completo.

## Verificación por foto en la ficha pública (julio 2026)

El diagnóstico Sí/No es autodeclarado: el minero puede responder "sí" a
todo sin sustento. Por eso, en la ficha pública del proyecto
(`ProyectoDetalle.tsx`, secciones "Estado de Formalización" y
"Documentación Técnica"), el check ✓ **nunca** se basa solo en la
respuesta del diagnóstico — requiere además una foto de respaldo subida
para ese estudio (`DocumentoOperacion.categoria == código de estudio`,
sección "Respalda tu declaración" de `/mi-cuenta` o `/mi-concesion`).

- Backend: `routers/proyectos.py` calcula `brechas_verificadas` = el set
  completo de estudios aplicables a la ruta de la operación
  (`ids_esperados_para`) que NO están en `brechas_pendientes` (o sea: se
  respondió "sí", o un "no" que el admin marcó resuelto por seguimiento)
  **y además** tienen una foto subida. Este campo es distinto de
  `brechas_resueltas`, que solo trackea brechas marcadas resueltas
  manualmente por el admin — nunca incluye las respuestas "sí" originales.
- El score (`score_actual`/`score_inversion`) sigue calculándose sobre las
  respuestas autodeclaradas, sin requerir foto — la exigencia de foto es
  solo para el check visual en la ficha pública, no cambia el score ni el
  ranking de `/proyectos`.
- Frontend: la ficha pública agrupa el checklist de "Estado de
  Formalización" por dimensión (Legal/Ambiental/Seguridad/Social), igual
  que el bloque "Respalda tu declaración" del propio minero — mismo
  criterio de orden en ambas ventanas.

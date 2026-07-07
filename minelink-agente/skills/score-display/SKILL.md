---
name: score-display
description: Usa esta skill al crear o modificar componentes visuales del
  score del minero - número con semáforo, barras por dimensión, lista de
  brechas. Página /resultado del frontend.
---

# Skill: Score Display

## Componentes

### ScoreBadge — el número grande
- score_total en font-mono, 56px móvil / 72px desktop
- Color y etiqueta según semáforo de context/criterios_score.md
- Si bloqueado=true: badge rojo oscuro "Necesitas tu REINFO primero"
  ARRIBA del número, y el número en gris (se muestra igual: el minero
  necesita ver cuánto avanzó en lo demás)

### DimensionBars — 5 barras horizontales
- Una por dimensión: nombre + puntaje/máximo + barra de progreso
- Color de cada barra según su propio porcentaje (semáforo)
- Etiquetas en español: Legal, Ambiental, Operativo, Técnico, Seguridad
- El máximo de Seguridad varía según tipo_mina (25 siempre, pero repartido
  distinto si es tajo abierto) — no asumir un máximo fijo por pregunta
- NO usar radar chart en móvil: las barras se leen mejor a 360px.
  Radar solo si el ancho ≥ 768px (opcional, con recharts)

### ListaBrechas — qué te falta
- Una tarjeta por brecha con: nombre simple del estudio, qué resuelve
  (1 línea), y botón "Buscar quién me ayuda con esto"
- Nombres simples (mapeo etiqueta → texto para el minero):

| Etiqueta | Texto visible |
|---|---|
| tramite_reinfo | Poner al día tu REINFO |
| titularidad_concesion | Ser titular de tu concesión |
| contrato_explotacion | Contrato con el dueño de la concesión |
| tramite_sunat | Activar tu RUC minero |
| levantamiento_georreferenciado | Medir tu labor con GPS (sinceramiento) |
| igafom_correctivo | Tu plan ambiental (IGAFOM correctivo) |
| igafom_preventivo | Tu plan ambiental (IGAFOM preventivo) |
| aprobacion_instrumento_ambiental | Aprobar tu instrumento ambiental |
| puesta_en_produccion | Poner tu operación en producción |
| informe_geologico | Informe geológico de tu veta |
| muestreo_geoquimico | Muestreo geoquímico de tu mineral |
| analisis_laboratorio | Análisis de laboratorio de tu mineral |
| planos_geologicos | Planos de tu estructura mineralizada |
| levantamiento_topografico | Topografía de tu labor |
| estimacion_recursos | Estimación de tus recursos minerales |
| iperc | Identificación de peligros y riesgos (IPERC) |
| sctr | Seguro SCTR para tus trabajadores |
| plan_seguridad | Plan de seguridad de tu labor |
| evaluacion_geomecanica | Revisar el sostenimiento de tu labor |
| estudio_ventilacion | Medir el aire de tus labores (solo subterránea) |

## Reglas
- Nunca decimales en scores
- El orden de las brechas: primero las de la dimensión con menor
  porcentaje (donde está más débil)
- Animación de entrada de barras: transition-all duration-700 (sensación
  de "calculando tu resultado")
- Las 3 preguntas informativas de Operativo (producción mensual,
  maquinaria, nº de trabajadores) NUNCA aparecen como brechas: no puntúan
  y no tienen "estudio" asociado

# Sistema de Diagnóstico y Ruteo — Formalización Minera (Qorilink)

> **FUENTE DE VERDAD** del diagnóstico desde julio 2026 (reemplaza el modelo de 22 preguntas
> Sí/No + MineScore descrito históricamente en criterios_score.md). Entregado por Esthiven.
>
> **Propósito:** Cuestionario inteligente que ubica a cualquier persona en su etapa exacta del
> proceso minero-legal peruano, le entrega un diagnóstico con semáforos y la enruta hacia:
> (a) su checklist de formalización, y (b) preparación para atraer inversionistas.
>
> **Rol del sistema:** Actuar como un experto en formalización minera en el Perú con más de
> 10 años de experiencia en campo, ayudando a: personas que buscan una concesión,
> concesionarios que no saben cómo formalizar, mineros con REINFO (explotan y formalizan a la
> vez) y mineros formales que buscan crecer.
>
> **Regla de oro del experto:**
> 1. **SOBREVIVIR** — ¿algo está por vencer/caducar? (vigencia, suspensión, plazo REINFO)
> 2. **ORDENAR** — completar documentos de la etapa actual
> 3. **CRECER** — recién ahí, buscar capital/inversionista
>
> Nunca presentar un inversionista a un minero cuya concesión caduca pronto o cuyo REINFO está
> suspendido. Primero se apaga el incendio.

---

## Arquitectura general

```
                    ┌─────────────────────────┐
                    │   MÓDULO 0: UBICACIÓN     │
                    │   "¿Dónde estás parado?"  │
                    │   (4 preguntas filtro)    │
                    └────────────┬────────────┘
                                 │
        ┌──────────────┬─────────┼──────────────┬──────────────┐
        ▼              ▼         ▼              ▼              ▼
   ┌─────────┐   ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌─────────┐
   │ PERFIL A │   │ PERFIL B │  │ PERFIL C │  │ PERFIL D  │  │ SIN RUTA │
   │ Cero, sin│   │ Concesión│  │ REINFO   │  │ Formal    │  │ (opera   │
   │ concesión│   │ sin      │  │ (opera y │  │ pleno     │  │ sin nada │
   │          │   │ operar   │  │ formaliza│  │           │  │ = ilegal)│
   └────┬────┘   └────┬────┘  └────┬────┘  └────┬─────┘  └─────────┘
        │             │            │             │
        ▼             ▼            ▼             ▼
   [MÓDULO A]    [MÓDULO B]   [MÓDULO C]   [MÓDULO D]
        │             │            │             │
        └─────────────┴─────┬─────┴─────────────┘
                            ▼
              ┌───────────────────────────┐
              │  MÓDULO INV: PREPARACIÓN    │
              │  PARA INVERSIONISTA         │
              │  (transversal a todos)      │
              └───────────────────────────┘
```

---

## MÓDULO 0: Preguntas de Ubicación (filtro inicial)

Estas 4 preguntas clasifican a cualquier persona en su perfil.

| # | Pregunta | Opciones de respuesta | Lógica de ruteo |
|---|----------|----------------------|-----------------|
| 0.1 | ¿Tienes una concesión minera a tu nombre, o un contrato de cesión/explotación firmado con un titular? | (a) Sí, propia<br>(b) Sí, por contrato<br>(c) No, nada<br>(d) Estoy en trámite (petitorio) | (c) → **Perfil A**<br>(d) → **Perfil A avanzado**<br>(a)/(b) → continuar a 0.2 |
| 0.2 | ¿Actualmente estás extrayendo mineral en esa área? | (a) Sí<br>(b) No | (b) → **Perfil B**<br>(a) → continuar a 0.3 |
| 0.3 | ¿Estás inscrito en el REINFO? | (a) Sí, vigente<br>(b) Sí, pero suspendido<br>(c) No<br>(d) No sé | (a)/(b) → continuar a 0.4<br>(c) → ⚠️ **SIN RUTA** (opera sin amparo legal)<br>(d) → guía de consulta REINFO en web MINEM con DNI/RUC, luego repetir |
| 0.4 | ¿Tienes autorización de inicio/reinicio de actividades emitida por la DREM/GREM? | (a) Sí<br>(b) No<br>(c) No sé | (a) → **Perfil D**<br>(b) → **Perfil C**<br>(c) → guía de verificación, luego repetir |

**Nota de experto:** La opción "No sé" en 0.3 es crítica. En campo, la mayoría de mineros no sabe si su inscripción sigue vigente o fue suspendida (~82% de inscritos está suspendido y muchos no se han enterado). El sistema debe enseñar a consultar el estado en la web del MINEM.

**Caso SIN RUTA:** Persona que opera sin concesión/contrato ni REINFO. El REINFO está cerrado a nuevas inscripciones desde septiembre 2020. Su única salida legal: detener operación y seguir el régimen general (Perfil A/B). El sistema debe informar esto sin juzgar, mostrando riesgos objetivos (decomiso, proceso penal por minería ilegal) y la ruta legal disponible.

---

## MÓDULO A: Perfil "Desde Cero" (quiere concesión)

**Objetivo del diagnóstico:** viabilidad del área de interés + capacidad económica.

### Bloque A1 — Área de interés

| # | Pregunta | Opciones | Para qué sirve |
|---|----------|----------|----------------|
| A1.1 | ¿Ya identificaste un área específica de interés? | Sí / No | No → derivar a guía educativa de búsqueda de áreas libres en GEOCATMIN |
| A1.2 | ¿Verificaste en el catastro minero (GEOCATMIN/INGEMMET) que el área está libre? | Sí / No / No sé cómo | Evita gastar en un área ya concesionada |
| A1.3 | ¿Tienes las coordenadas UTM del área? | Sí / No | Dato técnico necesario para el petitorio |

### Bloque A2 — Descalificadores automáticos

| # | Pregunta | Opciones | Efecto |
|---|----------|----------|--------|
| A2.1 | ¿El área está dentro de alguna de estas zonas? | Área Natural Protegida / Zona arqueológica / Zona urbana o de expansión urbana / Cauce de río / Zona de frontera / Ninguna | ANP, arqueológica, urbana, cauce → 🔴 no concesionable o restricción grave. Frontera → requisito extra (solo peruanos, o D.S. autoritativo para extranjeros) |
| A2.2 | ¿Piensas usar dragas o artefactos similares en cuerpos de agua? | Sí / No | Sí → 🔴 descalificador automático PMA/PPM (prohibido por ley) |

### Bloque A3 — Terreno superficial

| # | Pregunta | Opciones | Para qué sirve |
|---|----------|----------|----------------|
| A3.1 | ¿De quién es el terreno superficial sobre el área? | Mío / Privado (tercero) / Comunidad campesina / Del Estado / No sé | La concesión es del subsuelo; el terreno superficial requiere acuerdo previo o servidumbre |
| A3.2 | Si es de un tercero/comunidad, ¿ya conversaste con ellos? | Sí / No / No aplica | Mide avance en el frente social — cuello de botella frecuente |

### Bloque A4 — Capital

| # | Pregunta | Opciones | Para qué sirve |
|---|----------|----------|----------------|
| A4.1 | ¿Puedes cubrir el petitorio, el derecho de vigencia anual y los trámites iniciales? | Sí, completo / Parcialmente / No | No/Parcial → activar **Módulo INV** temprano |
| A4.2 | ¿Estarías dispuesto a asociarte con un inversionista a cambio de participación? | Sí / No / Tal vez | Prepara perfil para match futuro |

### Bloque A5 — Intención de trabajo (pre-clasificación PMA/PPM)

| # | Pregunta | Opciones | Para qué sirve |
|---|----------|----------|----------------|
| A5.1 | ¿Piensas trabajar de forma manual/artesanal o con maquinaria? | Manual / Maquinaria / Aún no sé | Manual → candidato PMA; Maquinaria → candidato PPM |
| A5.2 | ¿Qué sustancia buscas explotar? | Oro / Cobre / Polimetálico / No metálico / Otro | Determina tipo de expediente técnico e IGA |

### Salidas del Módulo A

- 🟢 **"Puedes iniciar el petitorio ya"** → checklist de petitorio (solicitud + plano UTM + pago; ante GORE si es PM/MA)
- 🟡 **"Área con riesgos, verifica primero X"** → guía de verificación GEOCATMIN / consulta de zonas restringidas
- 🔴 **"Esa área no es concesionable"** → sugerir búsqueda de otra área
- 💰 **"Sin capital suficiente → tu palanca es un socio/inversionista"** → Módulo INV

---

## MÓDULO B: Perfil "Concesionario sin operar"

**Objetivo:** decidir su camino y protegerlo de perder la concesión.

### Bloque B1 — Salud de la concesión

| # | Pregunta | Opciones | Para qué sirve |
|---|----------|----------|----------------|
| B1.1 | ¿Estás al día en el pago del derecho de vigencia? | Sí / Debo 1 año / Debo 2+ años / No sé | Debo 2+ → 🚨 riesgo de caducidad inminente |
| B1.2 | ¿En qué año te otorgaron el título? | Año (número) | Calcula el reloj de producción mínima: PPM año 6, PMA año 10; penalidad después |
| B1.3 | ¿Ya te toca pagar penalidad por no producir? | Sí, la pago / Sí, no la pago / Aún no me toca / No sé | No la paga 2 años → 🚨 caducidad |

### Bloque B2 — Clasificación

| # | Pregunta | Opciones | Para qué sirve |
|---|----------|----------|----------------|
| B2.1 | ¿Tienes constancia PMA o PPM vigente? | PMA / PPM / No tengo / No sé qué es | Sin constancia paga vigencia US$3/ha en vez de US$1/ha y producción mínima más alta |
| B2.2 | Extensión total de tus derechos mineros (ha) | Número | Valida límites: PMA ≤ 1,000 ha; PPM ≤ 2,000 ha |

### Bloque B3 — Conocimiento del recurso

| # | Pregunta | Opciones | Para qué sirve |
|---|----------|----------|----------------|
| B3.1 | ¿Sabes qué mineral hay en tu concesión y en qué cantidad aproximada? | Sí, con estudios / Sí, por referencias / No | Base del Índice de Madurez (Módulo INV) |
| B3.2 | ¿Has hecho muestreo, calicatas o algún estudio geológico? | Sí, con laboratorio / Sí, artesanal / No | Nivel de evidencia técnica |

### Bloque B4 — Camino elegido

| # | Pregunta | Opciones | Ruteo |
|---|----------|----------|-------|
| B4.1 | ¿Qué quieres hacer con tu concesión? | Operarla yo mismo / Cederla a un tercero (contrato) / Atraer un inversionista / Aún no sé | Operar → checklist régimen general. Ceder → guía de contratos de cesión/explotación. Inversionista → Módulo INV |

### Bloque B5 — Avance en permisos (régimen general)

| # | Pregunta | Opciones | Para qué sirve |
|---|----------|----------|----------------|
| B5.1 | ¿Iniciaste tu instrumento ambiental (DIA o EIA-sd)? | Aprobado / En trámite / No iniciado / No sé cuál me toca | Requisito indispensable pre-operación |
| B5.2 | ¿Tienes acuerdo con el dueño del terreno superficial (o servidumbre)? | Sí / En negociación / No / El terreno es mío | Bloqueante frecuente |
| B5.3 | ¿Tienes licencia de uso de agua (ANA)? | Sí / En trámite / No / Mi operación no usa agua | Sin ella no se puede operar legalmente |
| B5.4 | ¿Solicitaste la autorización de inicio de actividades a la DREM/GREM? | Sí / No / No sabía que se necesita | Último paso para ser formal |

### Salidas del Módulo B

- ⏰ **"Tu concesión entra en riesgo de penalidad/caducidad en X años"** → alertas con fechas
- 🧭 **"Te falta: [permisos pendientes en orden]"** → checklist régimen general
- 💰 **"Concesión sin capital ni estudios → ruta inversionista"** → Módulo INV
- 📜 **"Puedes rentabilizarla cediéndola por contrato a un operador"** → guía de contratos

---

## MÓDULO C: Perfil "REINFO" (opera y formaliza en paralelo)

**Objetivo:** completar los 7 requisitos ANTES del cierre del plazo (dic. 2026). Grupo cerrado: solo inscritos antes de septiembre 2020.

### Bloque C1 — Estado real del REINFO

| # | Pregunta | Opciones | Efecto |
|---|----------|----------|--------|
| C1.1 | ¿Tu inscripción está vigente o suspendida? | Vigente / Suspendida / No sé | Suspendida → 🚨 prioridad máxima: identificar y subsanar causal. Recordar: suspendido NO puede operar legalmente mientras dure la suspensión |
| C1.2 | ¿Ya hiciste el sinceramiento de coordenadas georreferenciadas (Ley 32537, plazo 120 días)? | Sí / No / No sé qué es | No → 🚨 riesgo de exclusión |

### Bloque C2 — Sinceramiento de ubicación (Ley 32537 — plazo específico)

| # | Pregunta | Opciones | Efecto |
|---|----------|----------|--------|
| C2.1 | ¿Ya presentaste el sinceramiento de coordenadas georreferenciadas de tu operación? | Sí, ya presentado / En trámite / No, no sabía que debía hacerlo / No sé qué es esto | No → 🚨 riesgo de exclusión, prioridad alta |
| C2.2 | ¿Las coordenadas donde realmente trabajas coinciden con las que declaraste al inscribirte en REINFO? | Sí, coinciden / No, he trabajado en otra zona / No estoy seguro | "No coinciden" es un riesgo grave — puede generar exclusión, requiere asesoría legal inmediata |

### Bloque C3 — Checklist de los 7 requisitos de culminación

Por cada requisito, estado: **Aprobado / Presentado (en evaluación) / No iniciado / No sé**

| # | Requisito | Si "No iniciado" → conecta con |
|---|-----------|-------------------------------|
| C3.1 | IGAFOM Aspecto Correctivo | Autogestionable (declaración jurada simple) — mostrar guía |
| C3.2 | IGAFOM Aspecto Preventivo | Consultor ambiental colegiado (directorio) |
| C3.3 | Acreditación de terreno superficial | Si no es dueño → abogado/gestor de acuerdos |
| C3.4 | Titularidad / contrato de cesión o explotación (inscrito en SUNARP) | Ver Bloque C4 si el titular no coopera |
| C3.5 | Declaración Jurada de Inexistencia de Restos Arqueológicos | Autogestionable — mostrar guía/formato |
| C3.6 | Expediente Técnico (según sustancia y método) | Ingeniero/geólogo (directorio) |
| C3.7 | RUC activo, 3ra categoría, rubro minería | Autogestionable vía SUNAT — guía rápida |
| C3.8 | Declaración de producción semestral al día | Atrasada/nunca → 🚨 causal directa de suspensión |

**Nota:** El IGAFOM preventivo requiere profesional ambiental colegiado con mínimo 3 años de experiencia. Mostrar como barra de progreso "X/8 completados" — genera sensación clara de avance.

### Bloque C4 — Relación con el titular (solo si opera en concesión de tercero)

| # | Pregunta | Opciones | Efecto |
|---|----------|----------|--------|
| C4.1 | ¿Cómo es tu relación actual con el titular de la concesión? | Excelente, colabora / Buena pero lento / Tensa / No tengo contacto directo | Contexto para calibrar el tipo de ayuda (mediación vs. legal) |
| C4.2 | ¿Qué le impide firmar/inscribir el contrato? | Pide dinero que no puedo pagar / Está en otro país o inubicable / No confía en el proceso / Ya casi lo tenemos listo | Determina si necesita asesoría legal, mediación, o solo tiempo |

### Bloque C5 — Producción y evidencia económica

| # | Pregunta | Opciones | Para qué sirve |
|---|----------|----------|----------------|
| C5.1 | ¿Cuánto produces aproximadamente al mes? | Rangos (ej. <10 TM, 10-50 TM, 50+ TM, o en gramos de oro) | Perfil económico para Módulo INV |
| C5.2 | ¿Vendes con liquidación de venta formal (factura de empresa comercializadora registrada)? | Siempre / A veces / Nunca | Esto acredita producción mínima ante el Estado, y es lo que un inversionista quiere ver |
| C5.3 | ¿A quién le vendes tu mineral? | Empresa comercializadora formal / Intermediario informal / No vendo aún | Vender a informal es riesgo reputacional/legal adicional |

### Bloque C6 — Cálculo de urgencia (automático, no se pregunta — se calcula)

```python
# Lógica de backend, no pregunta al usuario
dias_restantes = fecha_limite_formalizacion - hoy  # 31/12/2026
docs_completados = suma(C3.1 a C3.8 == "Aprobado")
docs_pendientes = 8 - docs_completados

ritmo_necesario = dias_restantes / max(docs_pendientes, 1)

if ritmo_necesario < 30:  # menos de 30 días por documento pendiente
    urgencia = "🔴 CRÍTICA — necesitas ayuda profesional YA"
elif ritmo_necesario < 90:
    urgencia = "🟡 MODERADA — organízate esta semana"
else:
    urgencia = "🟢 CONTROLADA — sigue el orden recomendado"
```

Se muestra como contador regresivo visual en el dashboard.

### Salidas del Módulo C

- 🚨 **"Suspendido: subsana YA esto: [causal]"** → prioridad máxima
- 📋 **"Te faltan X de 8 documentos; el orden recomendado es: ..."** → ruta crítica con plazos
- 🤝 **"Tu traba es el contrato con el titular → asesoría legal"** → directorio de proveedores
- 💰 **"Ya produces + avance documentario = perfil atractivo para inversionista"** → Módulo INV (el perfil más fuerte para capital: riesgo controlado, flujo probado)

### Resumen visual del Módulo C

```
┌──────────────────────────────────────────────┐
│ Tu situación REINFO                              │
│                                                  │
│ Estado: 🟢 Vigente                                │
│ Progreso: ████████░░ 5/8 documentos                │
│ Plazo restante: 174 días                            │
│ Urgencia: 🟡 Necesitas ~2 documentos más antes         │
│           de fin de año                                │
│                                                  │
│ Tu próximo paso recomendado:                          │
│ → Completar Expediente Técnico (C3.6)                  │
│   [Ver proveedores sugeridos]                             │
└──────────────────────────────────────────────┘
```

---

## MÓDULO D: Perfil "Formal pleno"

**Objetivo:** mantenerse formal + crecer. Menor urgencia legal, pero mayor atractivo para inversionistas (riesgo controlado).

### Bloque D1 — Verificación de cumplimiento continuo (chequeo de salud anual)

| # | Pregunta | Opciones | Efecto |
|---|----------|----------|--------|
| D1.1 | ¿Estás al día en el pago del derecho de vigencia de este año? | Sí / No, debo este año / No sé | No → alerta, aunque tenga colchón de 1 año |
| D1.2 | ¿Tu producción actual cumple o supera el mínimo exigido por ley? | Sí, la supero / Sí, la cumplo justo / No, pago penalidad / No sé calcularlo | No → conectar con calculadora de producción mínima |
| D1.3 | ¿Presentaste tu Declaración Anual Consolidada (DAC) del año pasado? | Sí / No / No sabía que existía | No → 🚨 obligación tributaria-minera que muchos formales olvidan |
| D1.4 | ¿Tienes fiscalizaciones activas de OEFA, OSINERGMIN o SUNAFIL con observaciones pendientes? | Sin observaciones / Con observaciones en subsanación / Con multas impagas | Con multas → riesgo reputacional serio ante un inversionista |
| D1.5 | ¿Tus trabajadores están en planilla formal? | Sí, todos / Parcialmente / No | Riesgo de fiscalización SUNAFIL (la Ley 32537 refuerza esto) |

### Bloque D2 — Salud documentaria (papeles que vencen o requieren renovación)

| # | Pregunta | Opciones | Efecto |
|---|----------|----------|--------|
| D2.1 | ¿Tu constancia PMA/PPM sigue vigente? | Sí / Venció, no renové / No sé cuándo vence | La Declaración Jurada es bienal — se vence sin aviso si no está en el calendario |
| D2.2 | ¿Tu instrumento ambiental (DIA/EIA-sd) tiene alguna actualización pendiente por cambios en tu operación? | No, sigue igual / Sí, he ampliado/cambiado algo sin actualizar | Cambios no declarados = riesgo de sanción ambiental |
| D2.3 | ¿Tu licencia de uso de agua sigue vigente? | Sí / Por vencer / Vencida / No sé | ANA también tiene renovaciones periódicas |

### Bloque D3 — Intención de crecimiento

| # | Pregunta | Opciones | Ruteo |
|---|----------|----------|-------|
| D3.1 | ¿Qué te gustaría lograr en los próximos 1-2 años? | Ampliar capacidad de producción / Conseguir una concesión adicional / Construir planta de beneficio propia / Mejorar procesos (equipo, seguridad) / Mantenerme como estoy | Cada opción activa un sub-set específico |
| D3.2 | ¿Cómo planeas financiar ese crecimiento? | Con mis propias utilidades / Buscando un inversionista / Crédito bancario / Aún no lo he pensado | "Buscando inversionista" → Módulo INV directo |

**Sub-preguntas según D3.1 (solo si aplica):**

| Si eligió... | # | Pregunta |
|---|---|---|
| Ampliar capacidad de producción | D3.1a | ¿Tu capacidad actual instalada está limitada por tu clasificación PMA/PPM (25 o 350 TM/día)? |
| Ampliar capacidad de producción | D3.1b | ¿Necesitarías pasar de PMA a PPM, o de PPM a régimen general? |
| Conseguir una concesión adicional | D3.1c | ¿Ya identificaste el área nueva? *(reconecta con el Módulo A)* |
| Construir planta de beneficio propia | D3.1d | ¿Sabes que la concesión de beneficio es un derecho minero aparte, con su propio derecho de vigencia? |

### Bloque D4 — Evidencia económica (para Módulo INV, si busca crecer con capital externo)

| # | Pregunta | Opciones | Para qué sirve |
|---|----------|----------|----------------|
| D4.1 | ¿Tienes registros financieros ordenados (ingresos, costos, utilidad)? | Sí, formales / Sí, informales / No | Base del nivel 4 del Índice de Madurez |
| D4.2 | ¿Cuánto tiempo llevas produciendo de forma continua y formal? | <1 año / 1-3 años / 3+ años | Historial = menor riesgo percibido |
| D4.3 | ¿Cuánto capital buscarías y para qué? | Monto + uso (equipo / exploración adicional / planta / capital de trabajo) | Alimenta directo la tarjeta de proyecto del Módulo INV |

### Salidas del Módulo D

- ✅ Alertas de cumplimiento anual (vigencia, DAC, declaraciones, renovación bienal PMA/PPM)
- 💰 "Buscando inversión" → **Módulo INV** (perfil de menor riesgo de todos)

### Resumen visual del Módulo D

```
┌──────────────────────────────────────────────┐
│ Tu situación: Formal Pleno ✅                     │
│                                                  │
│ Cumplimiento: 🟢 Todo al día                        │
│ Próximo vencimiento: Vigencia — en 8 meses            │
│                                                  │
│ ⚠️ Detectamos: tu constancia PMA vence en 3 meses       │
│    (renovación bienal) → [Ver cómo renovar]                │
│                                                  │
│ Tu meta: Ampliar capacidad de producción                  │
│ → Esto requeriría pasar a PPM (más hectáreas/TM permitidas)│
│                                                  │
│ [Explorar inversionistas para tu expansión]                  │
└──────────────────────────────────────────────┘
```

---

## MÓDULO INV: Preparación para Inversionista (transversal, completo)

Se activa para cualquier perfil (A, B, C, D) que responda que busca capital. El objetivo ya no es "ubicar en qué etapa legal está" (eso ya se resolvió en su módulo de origen) sino **construir la tarjeta de proyecto** que el inversionista evaluará.

### Regla de bloqueo (prioridad de experto)

```
SI (vigencia en riesgo de caducidad) O (REINFO suspendido) O (plazo crítico):
    → NO mostrar el proyecto a inversionistas
    → Mostrar al minero: "Primero resolvamos [X]; luego te preparamos para inversión"
```

### Bloque INV1 — Confirmación del punto de partida (heredado, no se repregunta)

| Dato heredado | De qué módulo viene |
|---|---|
| Semáforo Legal (🟢/🟡/🔴) | Módulo A/B/C/D |
| Perfil (A/B/C/D) | Módulo 0 |
| Clasificación PMA/PPM | Módulo A/B |

### Bloque INV2 — Madurez técnico-geológica (niveles 1-3 del índice)

| # | Pregunta | Opciones | Nivel que acredita |
|---|----------|----------|--------------------|
| INV2.1 | ¿Tienes mapeo geológico de superficie de tu área (así sea básico)? | Sí, con plano/informe / Sí, pero solo en mi cabeza / No | Nivel 1 |
| INV2.2 | ¿Has tomado muestras y las llevaste a laboratorio? | Sí, con certificado de laboratorio / Sí, pero análisis informal / No | Nivel 2 |
| INV2.3 | Si tienes análisis de laboratorio, ¿cuál es la ley promedio obtenida? | Campo numérico (g/t Au, % Cu, etc.) | Dato clave para la tarjeta |
| INV2.4 | ¿Tienes una estimación de tonelaje o recursos, aunque sea preliminar? | Sí, con cálculo / Solo un estimado a ojo / No | Nivel 3 |
| INV2.5 | ¿Qué método de extracción usas o planeas usar? | Manual / Semi-mecanizado / Mecanizado | Contexto técnico |
| INV2.6 | ¿Qué método de procesamiento/beneficio usas? | Gravimetría / Amalgamación / Cianuración / Flotación / Aún no defino | Relevante para riesgo ambiental percibido |

### Bloque INV3 — Madurez económica (nivel 4)

| # | Pregunta | Opciones | Para qué sirve |
|---|----------|----------|-----------------|
| INV3.1 | ¿Tienes tus costos operativos mensuales documentados? | Sí, detallados / Tengo una idea aproximada / No | Nivel 4 |
| INV3.2 | ¿Cuál es tu costo operativo mensual aproximado? | Rango en S/ | Base para VAN/margen simplificado |
| INV3.3 | ¿Tienes estimado el CAPEX necesario (equipos, infraestructura)? | Sí / No / Ya lo tengo, no necesito más | Determina el "para qué" de la inversión |

### Bloque INV4 — Evidencia de producción (nivel 5, el más fuerte)

| # | Pregunta | Opciones | Para qué sirve |
|---|----------|----------|-----------------|
| INV4.1 | ¿Tienes producción histórica? | Sí, continua / Sí, esporádica / No, aún no produzco | Nivel 5 — el dato más valioso para el inversionista |
| INV4.2 | ¿Tienes liquidaciones de venta que lo acrediten? | Sí, todas / Algunas / No | Evidencia dura vs. declaración de palabra |
| INV4.3 | ¿Cuánto tiempo llevas produciendo de forma consistente? | <6 meses / 6 meses - 2 años / 2+ años | Historial = menor riesgo percibido |

### Bloque INV5 — La propuesta de inversión (alimenta el term sheet)

| # | Pregunta | Opciones | Para qué sirve |
|---|----------|----------|-----------------|
| INV5.1 | ¿Cuánto capital buscas? | Rango en S/ o monto exacto | Monto del deal |
| INV5.2 | ¿Para qué usarías principalmente el capital? | Insumos/explosivos / Maquinaria / Formalización (trámites/estudios) / Planta de beneficio / Capital de trabajo | Uso de fondos — clave para credibilidad |
| INV5.3 | ¿Qué modalidad prefieres? | Préstamo con interés / Participación % sobre producción / Aún no sé, quiero asesoría | Determina tipo de term sheet a generar |
| INV5.4 | ¿En cuánto tiempo esperas poder devolver o generar retorno? | <6 meses / 6-12 meses / 1-2 años / Más de 2 años | Plazo estimado del deal |
| INV5.5 | ¿Tienes algo que ofrecer como garantía? | Equipo propio / Derecho de preferencia sobre producción futura / Aval de tercero / No tengo garantías | Mitigación de riesgo para el inversionista |

### Bloque INV6 — Transparencia y disposición a supervisión

| # | Pregunta | Opciones | Para qué sirve |
|---|----------|----------|-----------------|
| INV6.1 | ¿Estarías dispuesto a reportes periódicos de producción al inversionista? | Sí, mensual / Sí, pero menos frecuente / Prefiero no comprometerme | Mide "invertibilidad" — no reportar es señal de alerta |
| INV6.2 | ¿Aceptarías visitas de verificación en campo? | Sí / Con previo aviso / No | "Sí" reduce la percepción de riesgo |

### Cálculo de salida: Índice de Madurez consolidado

```python
nivel = 0
if INV2.1 == "con plano/informe": nivel = max(nivel, 1)
if INV2.2 == "con certificado de laboratorio": nivel = max(nivel, 2)
if INV2.4 == "con cálculo": nivel = max(nivel, 3)
if INV3.1 == "detallados": nivel = max(nivel, 4)
if INV4.1 in ["continua", "esporádica"] and INV4.2 in ["todas", "algunas"]:
    nivel = max(nivel, 5)

# Bonus de confianza (no sube nivel, pero mejora el badge)
transparencia_score = INV6.1 + INV6.2  # más reportes/visitas = mejor badge
```

### Tarjeta de Proyecto (versión completa, lo que ve el inversionista)

```
┌──────────────────────────────────────────────┐
│ 🟢 Track Legal: REINFO vigente, 6/8 docs         │
│ 📊 Madurez técnica-económica: Nivel 4/5            │
│    ✅ Mapeo  ✅ Laboratorio  ✅ Estimado recursos    │
│    ✅ Costos documentados  ⬜ Producción histórica    │
│ 💰 Ley promedio: 8.5 g/t Au                          │
│ 🎯 Busca: S/ 45,000 — para Expediente Técnico +       │
│    equipo de perforación                               │
│ 📄 Modalidad propuesta: Participación 15% sobre          │
│    producción, plazo 18 meses                             │
│ 🔍 Transparencia: Reportes mensuales + visitas OK ✅        │
│ 🛡️ Perfil de riesgo: Operación probada, riesgo controlado    │
└──────────────────────────────────────────────┘
```

---

## Semáforos de salida (todos los perfiles)

Cada diagnóstico termina en dos semáforos independientes (nunca mezclados en un solo puntaje):

| Semáforo | Verde 🟢 | Amarillo 🟡 | Rojo 🔴 |
|----------|---------|------------|---------|
| **Track Legal** | Todos los requisitos críticos de su etapa cumplidos | Falta algo subsanable (en trámite) | Bloqueante activo (caducidad, suspensión, zona prohibida, sin amparo legal) |
| **Track Técnico-Económico** | Madurez ≥ 4 con datos verificables | Madurez 2–3 | Madurez 0–1 (sin evidencia del recurso) |

---

## Notas de implementación (backend)

- **Campos derivados** (calculados, no ingresados): `perfil` (A/B/C/D/sin_ruta), `clasificacion` (PMA/PPM/no_califica), `semaforo_legal`, `semaforo_tecnico`, `indice_madurez`, `dias_restantes_reinfo`, `riesgo_caducidad`.
- Recalcular derivados en cada cambio de respuesta; loguear con fecha (las condiciones cambian en el tiempo).
- Opción **"No sé"** en toda pregunta técnica → dispara micro-guía educativa antes de continuar.
- Máximo 3–4 preguntas por pantalla; advertencias de descalificadores mostradas inline, no al final.
- Preguntas con nombres propios → siempre opciones categóricas (consistente con el diseño ya definido de Ruta 1/Ruta 2).

## Pendientes / siguientes pasos

- [ ] Redactar el copy exacto de cada pregunta (lenguaje llano, probado con usuarios reales)
- [ ] Definir pesos/puntaje del semáforo legal por perfil
- [ ] Definir umbral de inversión que exige factibilidad completa vs. prefactibilidad simplificada
- [ ] Micro-guías educativas ("cómo consultar tu REINFO", "cómo usar GEOCATMIN")
- [ ] Integración con directorio de proveedores (Fase 2 del roadmap)
- [ ] Verificar vigencia normativa antes del lanzamiento (REINFO/Ley 32537 cambia seguido)

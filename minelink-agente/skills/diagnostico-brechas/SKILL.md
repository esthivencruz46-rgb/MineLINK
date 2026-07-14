---
name: diagnostico-brechas
description: Usa esta skill al implementar o modificar el diagnóstico
  (perfiles, semáforos, madurez, scores), la detección de brechas o el
  recomendador de empresas en el backend.
---

# Skill: Diagnóstico de brechas (modelo A/B/C/D, julio 2026)

## Fuente de verdad
- Negocio: `context/diagnostico_formalizacion.md` (perfiles, semáforos,
  madurez) + `context/criterios_score.md` (reglas transversales).
- Ejecutable: `backend/catalogo_diagnostico.py` (formalización),
  `backend/catalogo_inversion.py` (Módulo INV), `backend/scoring.py`
  (derivaciones). Si el spec cambia, el código se actualiza para
  reflejarlo — nunca al revés. NO duplicar tablas de puntos/ids en docs.

## Arquitectura del cálculo (todo lógica pura, sin BD)

```
respuestas (dict id→str) ──▶ catalogo_diagnostico.ids_esperados()      ← set EXACTO o ValueError
                          ──▶ catalogo_diagnostico.validar_respuestas() ← tipos/valores por pregunta
                          ──▶ scoring.clasificar_perfil()               ← A/A_avanzado/B/C/D/sin_ruta
                          ──▶ scoring.semaforo_legal()                  ← (color, bloqueantes[]) por CONDICIONES, no puntos
                          ──▶ scoring.indice_madurez()                  ← 0-5 (None si módulo INV en pausa / perfil A)
                          ──▶ scoring.calcular_diagnostico(respuestas, hoy=...)  ← todo junto; `hoy` inyectable
operacion ────────────────▶ scoring.estado_seguimiento(operacion)      ← estado VIGENTE: parcha respuestas con
                                                                          brechas_resueltas_json (VALOR_RESUELTO_POR_PREGUNTA),
                                                                          descarta solo condicionales huérfanas del parche,
                                                                          recalcula perfil/semáforos/urgencia/apto
```

Reglas clave:
- **Condiciones, no puntos**: el semáforo legal es una lista CERRADA de
  bloqueantes por perfil (caducidad, REINFO suspendido, plazo crítico,
  zona prohibida/dragas en A...). Rojo > amarillo > verde.
- **Derivados del tiempo** (urgencia C5, reloj de producción B) se
  recalculan en CADA lectura — nunca persistir días restantes.
- **La declaración original es inmutable**: el seguimiento parcha una
  COPIA de las respuestas; `respuestas_json` no se toca jamás.
- Filas del modelo viejo (respuestas booleanas) degradan con gracia:
  derivados None, nunca excepción hacia el caller.

## Scores 0-100 por track (`scoring.py`)

- `score_formalizacion(operacion)`: rango por etapa
  (`RANGO_SCORE_POR_PERFIL`) + avance interno (checklist 60 / semáforo 25
  / evidencia 15). None si no hay perfil calculable.
- `score_inversion(operacion, lead)`: INV enviado + datos duros +
  respaldos − brechas INV. El bono "sin brechas" solo si respondió el
  módulo (la honestidad no baja el score). None si el INV no se ofrece.
- Constantes marcadas "PENDIENTE DE CALIBRAR" — ajustar solo ahí.

## Módulo INV (`catalogo_inversion.py`)

Catálogo SEPARADO con validador propio (tiene `multi_opcion` con tope de
selecciones, que el catálogo principal no soporta). Piezas:
- `activacion_inversion(perfil, respuestas_diag)` → si se ofrece y con
  qué prioridad.
- `ids_esperados_inversion(perfil, respuestas_inv)` → INV_0 común
  (INV_0_8 solo perfil D; INV_0_7 condicional) + bloque del perfil.
- `respaldos_declarados_inversion(...)` → slots de archivo derivados SOLO
  de respuestas positivas + regla de evidencia (un archivo subido para
  una brecha negativa gana slot igual — lo subido nunca queda invisible).
- `brechas_inversion` / `brechas_inversion_en_proceso` → alimentan
  "Lo que te falta".
- `alertas_inversion` → AL1-AL10, informativas para el admin, NUNCA
  bloquean el envío del minero.

## Brecha → estudio → empresa (sobrevive a todo rediseño)

`BRECHA_POR_PREGUNTA` (formalización) y `_BRECHA_INV_POR_PREGUNTA` (INV)
mapean respuestas malas a códigos de estudio; los mismos códigos etiquetan
empresas (`Empresa.estudios_json`). El recomendador cruza brechas
pendientes contra ese array (coincidencias desc, luego rating). Estudios
legacy sin pregunta siguen siendo tags válidos en empresas viejas; el
formulario de consultores solo ofrece `ESTUDIOS_CON_PREGUNTA`.

Al agregar un estudio NUEVO tocar los 4 lugares o el matching queda cojo:
1. `catalogo_diagnostico.py` (o `catalogo_inversion.py`): el mapeo brecha→estudio
2. `frontend/src/data/brechas.ts` (INFO_BRECHA: texto simple + qué resuelve)
3. `frontend/src/data/estudioDimension.ts` + `estudiosPorDimension.ts`
4. `uploads_config.py` si necesita categoría de archivo propia (CATEGORIAS_ESTUDIO
   se deriva sola) — y revisar si le aplica una equivalencia

## Sincronía backend ↔ frontend (la causa nº1 de 422)

El frontend espeja los catálogos en `data/preguntas.ts` y
`data/preguntasInversion.ts`. `POST /diagnostico` y `POST /mineros/inversion`
validan con set EXACTO de ids: si un catálogo cambia de un lado y no del
otro, el envío revienta con 422 al terminar el wizard. Todo cambio de
catálogo toca AMBOS lados + fixtures de `test_smoke.py`.

## Tests obligatorios
- `tests/test_scoring.py`: clasificación de perfil, cada bloqueante del
  semáforo por perfil, madurez, urgencia con `hoy` inyectado, seguimiento
  (parche + huérfanas), rangos de score por etapa.
- `tests/test_smoke.py`: fábricas `payload_perfil_a/b/c/d`, envío INV
  completo por perfil, regla de bloqueo en /proyectos, evidencia
  (subir respaldo resuelve brecha; ✓ público solo con foto).

# Criterios del diagnóstico — reglas transversales

> Reescrito julio 2026 (F5). El diagnóstico actual (perfiles A/B/C/D, dos
> semáforos, Índice de Madurez) está especificado en
> **`context/diagnostico_formalizacion.md`** — ese archivo es la fuente de
> verdad del negocio para preguntas, rutas y semáforos. La verdad
> EJECUTABLE vive en `backend/catalogo_diagnostico.py`, `backend/scoring.py`
> y `backend/catalogo_inversion.py`. Este archivo conserva las reglas
> TRANSVERSALES que sobrevivieron al rediseño (evidencia, equivalencias,
> catálogo de estudios, scores) y el resumen del modelo anterior en pausa.

## Regla de bloqueo (vigente — reemplaza a la regla vieja de REINFO)

`apto_inversionistas` decide si un proyecto aparece en `/proyectos`:
- Perfil ∈ {B, C, D} (A/A_avanzado y filas del modelo viejo nunca listan)
- Semáforo legal ≠ rojo (caducidad, REINFO suspendido, plazo crítico —
  "nunca presentar inversionistas a quien tiene un incendio legal activo")
- El minero ENVIÓ sus documentos de formalización Y su Módulo INV
  (`documentos_enviados_en` + `inv_enviado_en`). NO hay visto bueno manual
  del admin: la publicación es automática al presentar todo.

Se recalcula EN CADA lectura pública (la urgencia del plazo REINFO cambia
con el tiempo). Ver `scoring.estado_seguimiento`.

## Scores 0-100 por track (julio 2026)

Dos scores que COMPLEMENTAN a los semáforos (nunca los reemplazan en la
regla de bloqueo) — sirven para comparar/ordenar proyectos en la cartera:
- **`score_formalizacion`**: la ETAPA define el rango
  (`RANGO_SCORE_POR_PERFIL`: A 0-15 · A_avanzado 15-30 · B 30-55 ·
  C 55-80 · D 80-100 — un formal pleno SIEMPRE puntúa sobre un
  concesionario) y el avance interno (checklist 60% + semáforo legal 25%
  + evidencia subida 15%) mueve el puntaje dentro del rango.
- **`score_inversion`**: qué tan completo y respaldado está el perfil que
  ve el inversionista (INV enviado + datos duros + respaldos − brechas
  INV abiertas; la honestidad no baja el score: el bono "sin brechas"
  solo aplica si respondió el módulo).

Pesos marcados "PENDIENTE DE CALIBRAR" en `scoring.py` — ajustar allí,
nunca duplicar los números en docs.

## Evidencia primero (verificación por foto)

El diagnóstico es autodeclarado. Por eso:
- El check ✓ público (`brechas_verificadas`) exige foto de respaldo
  subida, no solo la respuesta "sí" ni la resolución del admin.
- El minero se auto-atiende: cada brecha en "Lo que te falta" tiene
  "Ya lo tengo — subir respaldo"; subir el archivo la resuelve solo
  (`subir_documento` → `brechas_resueltas_json`). `estado_seguimiento()`
  recalcula parchando respuestas a su "valor resuelto" sin mutar jamás la
  declaración original.
- Los scores se calculan sobre lo declarado + evidencia; el ✓ visual
  público es más estricto que el score.
- Todo PDF subido se convierte a foto de su primera hoja (PyMuPDF) —
  nunca se guarda ni sirve un PDF crudo.

## Público vs privado (julio 2026 — no violar)

- **Públicos**: fotos de galería (mina, mineral, acceso, agua/energía,
  maquinaria, muestreo propio, labores antiguas, área del petitorio),
  fotos de documentos legales y de estudios del catálogo, y las
  respuestas de DECISIÓN del Módulo INV (`IDS_INV_PUBLICOS` en
  `routers/proyectos.py`: capital, uso, qué ofrece/aporta, retorno,
  estructura legal, % a ceder, deudas declaradas).
- **Privados para siempre**: liquidaciones de venta, estados financieros,
  registro OPEX, fotos de TRABAJADORES (derecho a la imagen de terceros)
  y el historial de negociaciones (INV_0_6/0_7). Públicamente solo se
  muestra el HECHO verificado (`IndicadoresVerificadosOut`: "✓ ventas
  verificadas · 3 docs · junio 2026"), nunca el archivo.

## Catálogo de estudios (matching con empresas)

El mecanismo brecha→estudio→empresa sobrevive a todo rediseño: respuestas
NO/pendientes mapean a códigos de estudio (`BRECHA_POR_PREGUNTA` en
`catalogo_diagnostico.py`, `_BRECHA_INV_POR_PREGUNTA` en
`catalogo_inversion.py`); los mismos códigos etiquetan empresas
(`Empresa.estudios_json`).

Estudios con pregunta generadora HOY (23 — lista ejecutable:
`ESTUDIOS_CON_PREGUNTA` en `frontend/src/data/estudiosPorDimension.ts`):
```
acreditacion_terreno, analisis_laboratorio, autorizacion_inicio_actividades,
contrato_explotacion, costos_opex, declaracion_anual_consolidada,
declaracion_bienal_pma_ppm, declaracion_produccion_semestral,
dj_arqueologica, documentacion_operacion, elaboracion_petitorio,
estimacion_recursos, expediente_tecnico, igafom_aprobado,
informe_geologico, instrumento_ambiental_dia_eia,
levantamiento_georreferenciado, licencia_agua_ana, puesta_en_produccion,
subsanacion_fiscalizacion, tramite_reinfo, tramite_sunat, vigencia_concesion
```
(+ `autorizacion_drem`, la credencial del perfil D — se pide como respaldo
aunque no sea brecha.)

Estudios del catálogo viejo SIN pregunta (iperc, sctr, plan_seguridad,
evaluacion_geomecanica, estudio_ventilacion, muestreo_geoquimico,
planos_geologicos, levantamiento_topografico, etc.): siguen siendo tags
válidos en empresas existentes (no se borran), pero el formulario de
postulación de consultores solo ofrece los que una pregunta actual puede
generar.

## Categorías de documento equivalentes

Varios estudios piden en la práctica LA MISMA foto que otra categoría —
`uploads_config.categoria_equivalente(categoria, situacion)` evita pedirla
dos veces (la fuente ejecutable es `_EQUIVALENCIAS_ESTUDIO`; esta tabla es
solo lectura rápida):

| Estudio (no se pide aparte) | Categoría equivalente |
|---|---|
| titularidad_concesion | titulo_concesion |
| tramite_sunat | ruc |
| levantamiento_georreferenciado | catastro |
| puesta_en_produccion | fotos_mina |
| analisis_laboratorio | informe_leyes |
| documentacion_operacion | fotos_mina (solo Ruta 1 / minero_artesanal) |

`vigencia_concesion` y los estudios nuevos del pipeline
(acreditacion_terreno, dj_arqueologica, expediente_tecnico,
declaracion_produccion_semestral...) tienen slot PROPIO.

Se usa en dos lugares que deben mantenerse sincronizados:
`scoring.estudios_aplicables()` (qué slots se piden al minero) y
`routers/proyectos.py detalle_proyecto()` (qué cuenta como respaldo del ✓
público y de dónde sale la miniatura).

## Reglas puntuales que siguen vigentes

- **Titularidad, un solo documento**: `_es_titular_concesion(operacion)`
  decide si se muestra "Título de concesión" O "Contrato de explotación"
  — nunca ambos (son mutuamente excluyentes), ni en la cuenta del minero
  ni en la ficha pública.
- **Fotos condicionadas al perfil** (`CATEGORIAS_FOTO_PERFIL`:
  foto_mineral / foto_acceso / foto_agua / foto_energia): solo si el
  minero declaró el dato, con su respuesta en la etiqueta. Van a la
  galería pública.
- **Verificación REINFO manual**: el código REINFO queda en el lead y
  Esthiven lo consulta en pad.minem.gob.pe. Nunca prometer "verificación
  automática" del REINFO. (La verificación automática que SÍ existe es
  contra GEOCATMIN/INGEMMET: concesión y geología en el pin declarado —
  `backend/geocatmin.py`, presentada siempre como dato referencial.)
- **Datos estructurados junto a los archivos**: ley del mineral
  (elemento+valor+unidad → `ley_promedio`), minerales/litología
  (→ `especie_mineral`), reservas (→ `toneladas_estimadas`), costo por TN,
  maquinaria, nº de trabajadores y fechas de trámites
  (→ `datos_formalizacion_json`, merge por clave; la clave interna
  `_geocatmin` es el caché de INGEMMET, no tocarla desde la UI).

---

## Modelo anterior (2025 — EN PAUSA, no borrar)

El diagnóstico previo (2 rutas `minero_artesanal`/`concesionario`, perfil
informativo de 8 bloques, cuestionario Sí/No L/A/O/T/S/R con puntos por
dimensión, MineScore 0-100 y Score de Atractivo de Inversión por 6
dimensiones) quedó pausado por decisión del dueño — NO borrado:
- Código: `backend/scoring_legacy.py` (no importar),
  `frontend/src/data/preguntasPerfil.ts`, `perfilInformativo.ts`,
  `components/PerfilInformativoAgrupado.tsx`.
- La especificación completa de ese modelo está en el historial git de
  este archivo (versión anterior a julio 2026).
- Pendiente del dueño: decidir si algún día se reincorporan el perfil
  informativo y las preguntas técnicas/seguridad como módulo opcional.

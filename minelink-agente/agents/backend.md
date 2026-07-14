# Agente: Backend — FastAPI + SQLAlchemy (SQLite dev / Supabase prod)

## Rol
Construyes y mantienes el backend: modelos, endpoints, catálogos del
diagnóstico y del Módulo INV, semáforos/scores, mapeo de brechas y
recomendador de empresas. Fuente de verdad del negocio:
`context/diagnostico_formalizacion.md` + `context/criterios_score.md`
(reglas transversales).

## Skill asociada
Carga `skills/diagnostico-brechas/SKILL.md` para cualquier tarea que
involucre el diagnóstico, los scores o la recomendación de empresas.

## Piezas clave (ver árbol completo en el CLAUDE.md orquestador)
- `catalogo_diagnostico.py` / `catalogo_inversion.py`: qué se pregunta
  (ids, tipos, condicionales) + brecha→estudio. Validación por set EXACTO
  de ids — el frontend espeja estos catálogos y un desfase = 422.
- `scoring.py`: lógica PURA (sin BD, `hoy` inyectable) — perfiles,
  semáforos por condición, madurez, scores 0-100 por track,
  `estado_seguimiento` (parche de brechas resueltas sin mutar la
  declaración), `estudios_aplicables`.
- `scoring_legacy.py`: ⏸️ EN PAUSA, no importar.
- Routers: `diagnostico` (POST), `mineros` (cuenta, documentos, INV,
  notificaciones), `proyectos` (cartera + ficha pública + GEOCATMIN),
  `empresas`, `leads`, `inversionistas`, `admin`, `eventos`.
- Servicios externos SIEMPRE best-effort con caché (`geoubicacion.py`,
  `geocatmin.py`): una página pública nunca se cae ni se cuelga por un
  tercero. Tests los desactivan (`MINELINK_RESOLVER_MAPS=0`,
  `MINELINK_GEOCATMIN=0`).

## Modelos de datos (los importantes)
- **Operacion**: el diagnóstico anónimo — `respuestas_json` (dict
  id→str, INMUTABLE), `estado_formalizacion` (= perfil A/…/D),
  `brechas_json`, `brechas_resueltas_json`, `inv_respuestas_json`,
  `inv_enviado_en`, `documentos_enviados_en`, `datos_formalizacion_json`
  (dict categoria→valor, merge por clave; `_geocatmin` es caché interno),
  `ley_promedio` / `especie_mineral` / `toneladas_estimadas`.
- **Lead**: la cuenta real (nombre, WhatsApp, credenciales, ubicación
  Maps + coords) → apunta a su Operacion. Contactos solo en admin.
- **DocumentoOperacion**: archivos por categoría (legales, estudios,
  galería, INV). PDF → foto de la 1ª hoja al subir, siempre.
- **Empresa** (estudios_json = tags del catálogo), **InteresInversion**,
  **InteresEmpresa**, **Notificacion**, **Evento**.

## Reglas técnicas
- Validación estricta: set exacto de ids del catálogo o 422 con detalle.
- Lógica de negocio nueva va en `scoring.py`/catálogos como funciones
  puras testeables; los routers solo orquestan.
- Un router NUNCA importa de otro router (helpers compartidos → scoring.py
  o módulo propio).
- `apto_inversionistas` se recalcula en cada lectura pública (deriva del
  tiempo). No confiar en columnas cacheadas para la regla de bloqueo.
- Privacidad: liquidaciones/financieros/OPEX/fotos de trabajadores jamás
  se sirven por endpoints públicos — solo hechos derivados
  (`IndicadoresVerificadosOut`). Test de regresión obligatorio si tocas
  esa superficie.
- RUC 11 dígitos; WhatsApp normalizado +51XXXXXXXXX; JWT solo /admin/*.
- ⚠️ `backend/.env` apunta a PRODUCCIÓN: los seeds corren contra la base
  real. Nunca correr una migración sin confirmación de Esthiven.

## Comandos (Windows del usuario)
```
cd backend
pip install -r requirements.txt --break-system-packages
uvicorn main:app --reload --host 127.0.0.1 --port 8000
pytest -q
```
Recordatorio de errores_aprendidos.md: uvicorn SIEMPRE desde backend/,
usar 127.0.0.1 en vez de localhost.

## Definición de terminado (para cualquier tarea)
1. El código corre sin errores
2. `pytest -q` pasa en verde COMPLETO (~205 tests, no solo los nuevos)
3. Probaste el endpoint con un request real y muestras la respuesta

# MineLink — Motor de Búsqueda de Formalización Minera

## Objetivo del proyecto
Plataforma web donde un minero artesanal peruano:
1. Responde el **diagnóstico de formalización** (fuente de verdad:
   `context/diagnostico_formalizacion.md`; ejecutable:
   `backend/catalogo_diagnostico.py` + `backend/scoring.py`): 4 preguntas
   filtro (M0) lo ubican en su perfil exacto del pipeline —
   **A** "desde cero" / **A_avanzado** "petitorio en trámite" /
   **B** "concesionario sin operar" / **C** "opera con REINFO" /
   **D** "formal pleno" / **SIN RUTA** (opera sin amparo legal: página
   informativa, sin cuenta ni POST) — y responde SOLO el módulo de su
   perfil. La salida son DOS semáforos independientes (Track Legal y
   Track Técnico con Índice de Madurez 0-5) + un checklist de su etapa +
   sus brechas. Regla de oro: SOBREVIVIR → ORDENAR → CRECER.
2. Ve las empresas y consultores que hacen EXACTAMENTE los estudios que
   le faltan (brecha→estudio→`Empresa.estudios_json`), o se postula él
   mismo como consultor (el formulario solo ofrece estudios que una
   pregunta actual puede generar — `ESTUDIOS_CON_PREGUNTA`). El WhatsApp
   de la empresa NO es público: el minero deja su interés
   (`POST /empresas/{id}/interes`) y Esthiven intermedia desde /admin.
3. Se registra (nombre, WhatsApp, departamento obligatorio, nombre de su
   operación, usuario/contraseña + pregunta de seguridad para recuperar
   contraseña solo) y vuelve a entrar por `/ingresar` → `/mi-cuenta`
   (perfiles C/D) o `/mi-concesion` (A/B).
4. Desde su cuenta: **"Respalda tu declaración"** — un slot de foto por
   cada estudio que declaró tener (`estudios_aplicables`; el perfil D
   además sube su credencial `autorizacion_drem`), con fechas y datos
   estructurados junto a los archivos (ley del mineral, minerales/
   litología, reservas, costo por TN, maquinaria, trabajadores →
   `datos_formalizacion_json`). Todo PDF se convierte a foto de su
   primera hoja (nunca se sirve un PDF crudo). En "Lo que te falta" cada
   brecha tiene "Ya lo tengo — subir respaldo": subir el archivo la
   resuelve solo (evidencia primero, sin aprobación del admin). Al enviar
   sus documentos se abre el **Módulo INV** (`catalogo_inversion.py`,
   wizard modal): bloque común INV_0 + bloque por perfil, con sus propios
   respaldos y brechas. Una campanita de notificaciones le avisa de
   novedades.
5. **Publicación automática**: con perfil B/C/D, semáforo legal ≠ rojo y
   AMBAS partes enviadas (documentos + Módulo INV), el proyecto aparece
   en `/proyectos` — sin visto bueno manual. La cartera muestra tarjetas
   con los dos **scores 0-100 por track** (`score_formalizacion` anclado
   a la etapa, `score_inversion`), chip "✓ Ventas verificadas", la
   mini-foto de la **credencial** que prueba que existe (autorización
   DREM / título de concesión) y selector de orden. SIN datos de contacto.
6. La **ficha pública** (`/proyectos/{id}`): mosaico superior con la
   ubicación en vista SATELITAL (parte ancha) + fotos; Resumen Ejecutivo;
   checklist de formalización SOLO con los estudios de su perfil
   (tarjetas grandes de documento con sello "Verificado" + visor con
   flechas; lo pendiente en chips); "Oportunidad de inversión"
   (respuestas públicas del INV: capital, % a ceder, deudas, estructura
   legal...); "Datos de la operación"; **"Cotejo con registros públicos"**
   (GEOCATMIN/INGEMMET: concesión del catastro minero + geología del
   punto, caché 30 días, siempre referencial); indicadores verificados en
   el panel lateral; y descarga de ficha en PDF (jsPDF, 2 páginas).
7. **Privacidad por diseño**: liquidaciones de venta, estados
   financieros, registro OPEX y fotos de TRABAJADORES son privados para
   siempre — públicamente solo se muestra el hecho verificado
   (`IndicadoresVerificadosOut`). El inversionista deja su interés
   (`POST /proyectos/{id}/interes`, crea su cuenta en el mismo paso) y
   Esthiven intermedia — nunca se revela el contacto del minero. El
   minero ve el CONTEO de intereses recibidos y puede "ver su proyecto
   como lo ve el inversionista".

Esthiven es el único administrador: carga empresas (una por una, o en
lote por CSV — el importador acepta tanto el formato propio como el
archivo crudo del scraper de Google Places, y todo lo importado en lote
nace INACTIVO y sin exigir RUC/colegiatura hasta que él lo revise y
active), revisa leads con su perfil/semáforos/alertas del Módulo INV
(AL1-AL10), APRUEBA/RECHAZA cada documento subido (julio 2026: ese
estado_revision es lo único que otorga el sello público "Con respaldo" —
subir el archivo resuelve la brecha pero no da el sello), verifica a
mano códigos REINFO (el cotejo automático está desactivado), resetea
contraseñas y puede marcar brechas puntuales como resueltas por
seguimiento manual. Las empresas NO tienen acceso; su rating solo se ve
en el admin (ordena internamente /empresas sin mostrarse).

## Rol de este archivo
Este es el archivo del ORQUESTADOR. Cuando recibas una instrucción:
1. Lee SIEMPRE primero `errores_aprendidos.md` antes de tocar código
2. Identifica qué agente corresponde según la tabla de abajo
3. Lee el archivo del agente en `agents/` y sigue sus reglas
4. Carga la skill correspondiente de `skills/` solo si la tarea la necesita
5. Los archivos de `context/` son la fuente de verdad del negocio:
   NUNCA contradigas `diagnostico_formalizacion.md`, `criterios_score.md`
   (reglas transversales) ni `perfil_usuario.md`

## Tabla de enrutamiento (qué agente activar)

| Si la tarea involucra... | Agente | Skill asociada |
|---|---|---|
| Endpoints, modelos BD, semáforos/scores, catálogos, FastAPI, pytest | agents/backend.md | skills/diagnostico-brechas |
| Páginas, componentes React, cuestionario UI, Tailwind, resultados | agents/frontend.md | skills/score-display, skills/empresa-card |
| Panel de administración, CRUD empresas, tabla de leads, JWT | agents/admin.md | skills/admin-panel |
| Tareas mixtas (ej. "conecta el frontend al backend") | backend primero, luego frontend | las de ambos |

## Stack tecnológico
- Backend: Python 3.10+ · FastAPI · SQLAlchemy · **Postgres vía Supabase** (ver abajo)
- Frontend: React 18 · TypeScript strict · Tailwind CSS · Vite
- Tests: pytest (backend) · sin tests frontend en MVP
- Idioma: código en inglés, comentarios y respuestas en español

## Producción (IMPORTANTE: el proyecto YA está desplegado)

- **Web pública**: https://mine-link-seven.vercel.app (Vercel, carpeta `frontend/`)
- **API pública**: https://minelink-api.onrender.com (Render, carpeta `backend/`, plan gratuito)
- **Auto-deploy**: cada push a `main` en GitHub (repo `esthivencruz46-rgb/MineLINK`) redespliega
  ambos automáticamente. El push lo hace Esthiven desde GitHub Desktop (la terminal del agente
  no tiene sus credenciales) — tras un commit, pedirle "dale Push origin en GitHub Desktop".
- **Variables de entorno de producción**: viven en los paneles de Render y Vercel (no en el repo).
  Render necesita: DATABASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD, SECRET_KEY, FRONTEND_URL,
  PYTHON_VERSION=3.12.8 (¡crítico: sin ella el build falla con Python nuevo!), SUPABASE_URL,
  SUPABASE_SERVICE_KEY. Vercel: VITE_API_URL_WEB y VITE_API_URL_NATIVE.
- **UptimeRobot** visita /health cada 5 min: mantiene despierto el plan gratuito de Render y
  alerta por correo si algo cae.
- El APK de Android apunta al backend público. Tras cambios de frontend, el ciclo completo es:
  `npm run android:sync` → `gradlew assembleDebug` → copiar a `Descargas\MineLink.apk` →
  `python -m seeds.publicar_apk` (lo sube al bucket PÚBLICO `descargas` de Supabase, de donde
  descarga el botón "Descargar la app" de la portada — URL fija). NO regenerar el APK tras cada
  cambio — solo cuando Esthiven lo pida explícitamente.
- CORS: orígenes locales + regex `https://mine-link-[a-z0-9-]+\.vercel\.app` + FRONTEND_URL
  (ver `main.py`). Si la web pública no carga datos, revisar esto primero.

## Comandos comunes

### Backend (desde `backend/`)
```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000   # servidor dev
pytest -q                                                 # toda la suite (~230 tests)
pytest tests/test_scoring.py -q                           # un archivo
pytest tests/test_smoke.py::test_post_diagnostico -q      # un test puntual
pip install -r requirements.txt                           # dependencias (usar --break-system-packages en este entorno)
```
Los tests (`tests/test_smoke.py`, `tests/test_scoring.py`) usan un engine SQLite en memoria propio
vía `app.dependency_overrides[get_db]` — nunca tocan la base real (SQLite local ni Supabase),
así que corren igual sin importar qué diga `DATABASE_URL`. Además desactivan toda llamada
externa: `MINELINK_RESOLVER_MAPS=0` (Google Maps) y `MINELINK_GEOCATMIN=0` (INGEMMET).

### Frontend (desde `frontend/`)
```bash
npm run dev       # servidor dev en 127.0.0.1:5173 (usar 127.0.0.1, no localhost — ver errores_aprendidos.md)
npm run build     # tsc -b && vite build — usar esto para chequear tipos, no hay comando "typecheck" separado
npm run preview   # sirve el build de producción
```
No hay linter ni test runner de frontend configurado en este proyecto.

Rutas principales (públicas, inversionista, admin) están listadas en `RUTAS.md`.

### App Android (Capacitor, desde `frontend/`)
```bash
npm run android:sync    # npm run build + npx cap sync android
npm run android:open    # abre el proyecto nativo en Android Studio
```
Capacitor 6.x fijado (NO 8.x — requiere Node ≥22, este entorno tiene Node 18). El proyecto nativo
generado vive en `frontend/android/` (no editar a mano salvo `AndroidManifest.xml`). Para compilar
por línea de comandos (`gradlew assembleDebug`) hace falta `JAVA_HOME` apuntando al JBR de la
versión de Android Studio instalada (ver `errores_aprendidos.md`). Tres ajustes son obligatorios
para que la app hable con un backend HTTP local en desarrollo (quitar cuando haya HTTPS real):
- `capacitor.config.ts`: `server: { androidScheme: "http" }` (si no, Mixed Content bloquea las
  llamadas desde `https://localhost` a un backend HTTP plano).
- Backend corriendo con `--host 0.0.0.0` (no solo `127.0.0.1`) para que el emulador lo alcance
  vía `10.0.2.2`.
- `AndroidManifest.xml`: `android:usesCleartextTraffic="true"` (Android 9+ bloquea HTTP plano por
  defecto y esto falla en silencio, sin log visible).

## Base de datos: SQLite local + Supabase

El backend soporta ambos motores sin cambiar código (`database.py`):
- **Sin `DATABASE_URL` configurada** → usa `sqlite:///./minelink.db` automáticamente (modo dev
  original, cero fricción). Activa `PRAGMA journal_mode=WAL` y `busy_timeout=5000` en cada conexión.
- **Con `DATABASE_URL` en `backend/.env`** (cadena de Postgres de Supabase, formato
  `postgresql://...`) → usa esa. `backend/.env` NUNCA se comparte ni se sube a ningún repo
  (ver `.env.example` para la plantilla). Producción/el proyecto real ya está migrado a Supabase.
  **⚠️ `backend/.env` apunta a producción: cualquier seed corrido localmente ejecuta contra la
  base real — nunca correr uno sin confirmación explícita de Esthiven.**
- RLS (Row Level Security) está activado en las tablas de Supabase, sin políticas — bloquea el
  acceso vía la API pública de PostgREST (anon key), pero no afecta al backend porque se conecta
  como el owner (`postgres`) de las tablas.
- `backend/seeds/*.py` son scripts de migración/utilidad de un solo uso (correr con
  `python -m seeds.<nombre>` desde `backend/`). Antes de escribir una migración nueva, copiar el
  patrón de `seeds/migrar_ubicacion_maps.py` (usa el engine de `database.py`, respeta
  `DATABASE_URL`, funciona en ambos motores). Los seeds antiguos con `sqlite3` directo solo
  tocan la SQLite local.
- `backend/seeds/backup_db.py` respalda `minelink.db` + `uploads/` a `backend/backups/` (conserva
  los últimos 14). Uso seguro con el servidor corriendo (usa el backup API de sqlite3).

## Archivos subidos (fotos, PDFs)

Modo dual vía `backend/storage.py` (la BD solo guarda el nombre de archivo, no el contenido):
- **Con `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` en el entorno** → Supabase Storage, bucket privado
  `archivos-minelink` (carpetas `documentos_mineros/` y `cvs/`). Es el modo de producción (Render
  tiene disco efímero: lo escrito ahí se borra en cada deploy). Los archivos se sirven SIEMPRE a
  través del backend, nunca por URL directa del bucket.
- **Sin esas variables** → disco local `backend/uploads/` (dev y tests, como siempre).
- `seeds/migrar_archivos_a_storage.py` COPIA lo local al bucket (verificación byte a byte, no
  borra nada). Los archivos locales quedan como respaldo permanente.
- **Nunca borrar archivos de `backend/uploads/` con comandos amplios tipo `rm -f uploads/*/*`**
  — ver `errores_aprendidos.md`, ya causó pérdida de datos reales dos veces.

## Estructura del proyecto
```
/
├── CLAUDE.md                  ← este archivo (orquestador)
├── errores_aprendidos.md      ← LEER SIEMPRE antes de tocar código
├── RUTAS.md                   ← rutas principales del frontend (público/inversionista/admin)
├── DESPLIEGUE.md              ← checklist de despliegue (ya ejecutado; sirve para replicar/migrar)
├── LIMPIEZA.md                ← cómo borrar datos de simulación de forma segura
├── INTERMEDIACION.md          ← filosofía de negocio del match minero-inversionista
├── context/
│   ├── diagnostico_formalizacion.md ← SPEC ACTUAL: perfiles A/B/C/D, semáforos, madurez
│   ├── criterios_score.md     ← reglas transversales (evidencia, equivalencias, catálogo,
│   │                             scores) + resumen del modelo viejo en pausa
│   └── perfil_usuario.md      ← quién es el minero, tono de UI
├── agents/
│   ├── backend.md
│   ├── frontend.md
│   └── admin.md
├── skills/
│   ├── diagnostico-brechas/SKILL.md
│   ├── score-display/SKILL.md
│   ├── empresa-card/SKILL.md
│   └── admin-panel/SKILL.md
├── backend/
│   ├── main.py                 ← registra los routers, crea tablas al arrancar
│   ├── database.py             ← engine SQLite/Postgres, WAL, get_db()
│   ├── models.py               ← SQLAlchemy: Operacion, Lead, Empresa, DocumentoOperacion,
│   │                              InteresInversion, InteresEmpresa, Notificacion, Evento
│   ├── schemas.py              ← Pydantic (request/response)
│   ├── catalogo_diagnostico.py ← catálogo del diagnóstico: ids, tipos, condicionales,
│   │                              brecha→estudio (BRECHA_POR_PREGUNTA)
│   ├── catalogo_inversion.py   ← Módulo INV: activación, ids por perfil, respaldos
│   │                              declarados, brechas INV, alertas AL1-AL10
│   ├── scoring.py              ← perfiles/semáforos/madurez/scores + estado_seguimiento
│   │                              (lógica pura, `hoy` inyectable)
│   ├── scoring_legacy.py       ← ⏸️ MineScore viejo (EN PAUSA, no importar)
│   ├── auth.py                 ← JWT admin/minero/inversionista, hashing de passwords
│   ├── security.py             ← rate-limit de logins y validación de magic bytes
│   ├── storage.py              ← archivos en Supabase Storage (prod) o disco local (dev/tests)
│   ├── imagenes.py             ← compresión de fotos y conversión PDF → foto (PyMuPDF)
│   ├── geoubicacion.py         ← enlace de Google Maps → coordenadas (best-effort, con
│   │                              auto-reparación al leer: reparar_ubicacion_coords)
│   ├── geocatmin.py            ← INGEMMET por punto: catastro minero + geología (best-effort,
│   │                              caché 30 días en datos_formalizacion_json["_geocatmin"])
│   ├── uploads_config.py       ← categorías de archivos + equivalencias + fotos de perfil
│   ├── notificaciones.py       ← crear_notificacion (campanita del minero)
│   ├── routers/
│   │   ├── diagnostico.py      ← POST /diagnostico
│   │   ├── eventos.py          ← POST /eventos (métricas de embudo, anónimas)
│   │   ├── empresas.py         ← GET /empresas, POST /consultores/postular, /interes
│   │   ├── leads.py            ← POST /leads (registro del minero + su cuenta)
│   │   ├── mineros.py          ← login, /me, perfil-inversion, documentos, /inversion,
│   │   │                          notificaciones
│   │   ├── inversionistas.py   ← /inversionistas/login, /me
│   │   ├── proyectos.py        ← cartera pública, ficha, indicadores, GEOCATMIN, /interes
│   │   └── admin.py            ← todo lo protegido por JWT admin
│   ├── seeds/                  ← migraciones/utilidades de un solo uso (⚠️ corren contra prod)
│   ├── uploads/                ← archivos subidos — NUNCA `rm -f *`
│   └── tests/                  ← test_smoke.py (end-to-end) + test_scoring.py (lógica pura)
└── frontend/
    ├── capacitor.config.ts     ← config de la app Android
    ├── android/                ← proyecto nativo generado (no editar salvo AndroidManifest.xml)
    └── src/
        ├── data/               ← espejos TS de los catálogos backend (preguntas.ts,
        │                          preguntasInversion.ts, brechas.ts, estudiosPorDimension.ts)
        │                          — ⚠️ los sets de ids DEBEN coincidir con el backend o el
        │                          POST devuelve 422; preguntasPerfil.ts/perfilInformativo.ts
        │                          están EN PAUSA (no borrar)
        ├── components/         ← incluye proyecto/ para la ficha pública
        ├── config/marca.ts     ← ÚNICA fuente del nombre de marca ("MineLink") — todo
        │                          texto visible la importa; nunca escribir la marca a mano
        ├── pages/              ← incluye admin/ para el panel
        ├── context/            ← AuthContext (admin), MineroAuthContext, InversionistaAuthContext
        ├── types/
        └── services/api.ts     ← todas las llamadas fetch al backend
```

### Línea visual (julio 2026, aprobada por Esthiven — "más profesionalismo")
Estética institucional en TODA la web y el admin: bordes finos
(`border border-black/10 dark:border-white/10`) en vez de tarjetas con
sombra y `rounded-*`; chips planos con borde en vez de burbujas de color;
`font-semibold` en vez de `font-bold`; el color de acento reservado para
la acción principal. El verde/ámbar/rojo semántico se mantiene SOLO donde
comunica estado real (semáforos, verificaciones, alertas). Cualquier UI
nueva debe seguir esta línea.

## Reglas de autonomía

### Puedes hacer SIN confirmar
- Crear/editar archivos de código
- Instalar dependencias (pip install --break-system-packages / npm install)
- Ejecutar uvicorn, npm run dev, pytest, npm run build
- Corregir errores de TypeScript, Python o ESLint

### SIEMPRE confirma antes de
- Borrar archivos o carpetas
- Modificar el esquema de BD si ya tiene datos, y CORRER cualquier seed/migración
  (ejecutan contra producción vía `backend/.env`)
- Cambiar tsconfig.json, vite.config.ts o pyproject de forma sustancial
- Conectar un servicio externo NUEVO (Supabase y GEOCATMIN ya están conectados,
  eso no cuenta como "nuevo" — pero desplegar a un hosting, cambiar de proyecto de
  Supabase, o conectar otro servicio sí requiere confirmar)
- Correr cualquier `rm`/borrado sobre `backend/uploads/` más allá de un archivo puntual
  que el propio agente subió en la misma sesión (ver errores_aprendidos.md)

### Flujo ante un error
1. Intenta resolverlo hasta 2 veces
2. Si persiste → registra en errores_aprendidos.md (formato definido ahí)
3. Avisa: qué falló, qué intentaste, qué necesitas

## Reglas duras del negocio (NUNCA violar)
- **Regla de bloqueo**: un proyecto con semáforo legal ROJO nunca se muestra a
  inversionistas; perfiles A/A_avanzado y filas del modelo viejo nunca listan en
  `/proyectos`; publicar exige haber ENVIADO documentos de formalización + Módulo INV.
  No hay visto bueno manual del admin — la publicación es automática al cumplir eso
- **Privacidad de archivos**: liquidaciones de venta, estados financieros, registro
  OPEX y fotos de TRABAJADORES son PRIVADOS para siempre (públicamente solo el hecho
  verificado — `IndicadoresVerificadosOut`). Las fotos de documentos legales/estudios y
  la galería sí son públicas (decisión explícita del cliente). Solo se aceptan/guardan
  como foto (PDF se convierte al subir), nunca como PDF crudo
- El ✓ público de un requisito exige foto de respaldo subida — nunca solo la
  declaración
- El minero NUNCA ve datos de otros mineros
- Los datos de contacto del minero (leads) solo son visibles en el panel admin —
  ni empresas ni inversionistas los reciben directo; Esthiven intermedia siempre
- No inventes empresas: solo se muestran las que Esthiven cargó
- Todos los textos visibles al minero en lenguaje simple (ver perfil_usuario.md)
- Un mismo WhatsApp o código REINFO no puede registrar dos leads (409 si se repite)
- Un CIP (colegiatura) de consultor es único: no se puede postular dos veces con el mismo
- Los datos de GEOCATMIN son siempre REFERENCIALES (el pin es aproximado; operar la
  concesión de otro titular por contrato es legal) — nunca presentarlos como acusación
- Las preguntas viejas EN PAUSA no se borran (decisión del dueño)

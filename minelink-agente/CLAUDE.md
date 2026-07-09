# MineLink — Motor de Búsqueda de Formalización Minera

## Objetivo del proyecto
Plataforma web donde un minero artesanal peruano:
1. Elige su situación — **2 rutas completamente distintas, no una
   variación de la misma** (ver context/criterios_score.md, fuente de
   verdad completa — esto es solo un resumen):
   - Ruta 1 `minero_artesanal` (ya opera): perfil informativo de 8 bloques
     (operación actual, conocimiento técnico, equipo, ambiente, oportunidad
     e inversión, riesgos/conformidad, capacidad del operador, visión a
     futuro) + el cuestionario Sí/No de formalización (L1-L5, A1-A4 con A4
     condicional, O1, T1-T7, S1-S5). `tipo_mina` se DERIVA del tipo de
     explotación que declara (ya no se pregunta aparte)
   - Ruta 2 `concesionario` (recién inicia, no opera): perfil informativo
     de 8 bloques (titularidad/vigencia, geología/depósito, etapa del
     proyecto, proyecto/escala, historial/riesgos, formalización,
     capacidad/equipo, motivación/estructura) + un set Sí/No reducido
     (L1,L2,L3,L4,L6,A1,A2,T1,T3,T6,T7,R1 — incluye Ambiental y una
     dimensión Social nueva) que mide incertidumbre legal/ambiental/social
     gradual, no todo-o-nada
   Varias preguntas del perfil se copian silenciosamente al cuestionario
   Sí/No en vez de repetirse (L1/L2/L4/L6/A1/A4/R1/T7 según ruta — ver
   "Preguntas condicionales y prellenadas" en criterios_score.md). El
   monto de capital que busca, el plazo y el uso de fondos se preguntan
   DURANTE el diagnóstico (ya no solo al registrarse) y se copian a
   `Lead.capital_buscado`/`uso_fondos` al crear la cuenta.
   Departamento NO se pregunta en el diagnóstico (queda "no especificado"
   en `Operacion.region` hasta que se registre); mineral se deriva del
   "elemento económico principal" que el usuario declara en el perfil de
   cada ruta
2. Recibe su score (0-100) y su lista de brechas
3. Ve las empresas y consultores que hacen EXACTAMENTE los estudios que
   le faltan, o postula él mismo como consultor si es profesional. El
   WhatsApp de la empresa NO es público (julio 2026, cambio de política):
   en vez de un link directo a wa.me, el minero deja su nombre/WhatsApp
   con "Me interesa" (`POST /empresas/{id}/interes`, crea un
   `InteresEmpresa`, sin cuenta) y Esthiven ve el interés en `/admin` →
   Leads → botón "Empresas", desde donde escribe a la empresa con su
   propio WhatsApp dándole el contacto del minero (mismo patrón de
   intermediación que con inversionistas, punto 8 más abajo)
4. Si busca ayuda cercana, se registra (nombre, WhatsApp, **departamento
   obligatorio** — reemplaza el "no especificado" tanto en el lead como en
   la operación, para que el filtro de /proyectos tenga sentido —, email
   opcional, nombre de su operación, usuario y contraseña que él elige) —
   ese registro reemplaza el antiguo modal de solo nombre+WhatsApp
5. Puede volver a iniciar sesión (`/ingresar` → `/mi-cuenta`) con ese
   usuario/contraseña para ver su score y brechas sin rehacer el
   cuestionario (`POST /mineros/login`, `GET /mineros/me`)
6. Desde `/mi-cuenta` (o `/mi-concesion` en Ruta 2) puede subir documentos
   (fotos de la mina, informe de leyes, catastro, RUC, contrato de
   explotación, título de concesión) y llenar un perfil de inversión
   opcional (descripción, producción/reservas — con selects estructurados,
   no texto libre, para evitar errores de redacción en lo que se publica —,
   capital buscado, uso de fondos). Todo PDF subido se convierte a foto de
   su primera hoja en el servidor (`imagenes.convertir_pdf_a_imagen`,
   PyMuPDF) — nunca se guarda ni se sirve un PDF crudo. Además, como el
   diagnóstico Sí/No es autodeclarado y no se puede comprobar por sí solo,
   hay una sección "Respalda tu declaración" con un slot de foto por cada
   estudio del catálogo aplicable a su ruta (ver
   `uploads_config.CATEGORIAS_ESTUDIO`, expuesto como `estudios_aplicables`
   en `GET /mineros/me`), sea cual haya sido su respuesta
7. Todas las operaciones registradas (con Lead) aparecen automáticamente
   en `/proyectos` — REINFO/formalización iniciada YA NO es requisito para
   listarse (enlazado desde Inicio como
   "Ver proyectos mineros"), una vitrina pública buscable por mineral y
   departamento — SIN nombre real, WhatsApp ni email (`GET /proyectos`,
   `GET /proyectos/minerales`). Al hacer clic en un proyecto se abre su
   detalle (`GET /proyectos/{operacion_id}`): perfil de inversión
   completo, fotos de la mina (públicas, `GET /proyectos/{id}/fotos/{doc_id}`),
   y las fotos reales de los documentos legales que presentó (RUC,
   catastro, contrato, título, informe de leyes — `GET
   /proyectos/{id}/documentos/{doc_id}`, público, sin login). Esto es la
   base de una futura conexión con inversionistas, pero todavía NO hay match
8. El detalle del proyecto tiene un diseño premium (estilo Stripe/Linear/
   Notion) con MineScore por dimensión, checklist de formalización,
   factores de riesgo y oportunidades — todo DERIVADO de datos reales del
   diagnóstico, nunca inventado (sin CAPEX/TIR/VPN/equipo técnico con
   nombres, porque esos datos no se recopilan). Un inversionista puede
   dejar sus datos (`POST /proyectos/{id}/interes`) y Esthiven los ve en
   `/admin` (`GET /admin/operaciones/{id}/intereses`) para hacer de
   intermediario — nunca se revela el WhatsApp/email del minero
9. Ese formulario de interés pide: nombre, teléfono, email (opcional),
   motivo de inversión, monto y qué información necesita — y crea la
   cuenta del inversionista en el mismo paso (usuario/contraseña, mismo
   patrón que el minero). Puede volver a entrar en
   `/ingresar-inversionista` → `/mi-cuenta-inversionista`
   (`POST /inversionistas/login`, `GET /inversionistas/me`); por ahora
   esa ventana solo muestra lo que ya dejó registrado, sin match ni
   funciones nuevas todavía

Esthiven es el único administrador: carga empresas (una por una o en lote
vía CSV con `POST /admin/empresas/importar` — su base externa de
profesionales con rating 0-5 y nº de reseñas), revisa leads, resetea
contraseñas de mineros y puede marcar brechas puntuales como resueltas
por seguimiento manual (ver agents/admin.md). Mineros e inversionistas
también pueden recuperar su propia contraseña sin el admin: al
registrarse eligen una pregunta y respuesta de seguridad (texto libre,
la respuesta se guarda hasheada); `GET /{mineros|inversionistas}/
pregunta-seguridad/{username}` + `POST .../recuperar-password` (4
intentos por cuenta, ver `security.py`). Cuentas viejas sin pregunta
configurada (nullable) siguen dependiendo del reseteo manual del admin. Las empresas NO tienen
acceso; Esthiven las carga manualmente, o las aprueba si un consultor
independiente se postuló solo. El rating de empresas/consultores solo se
ve en el admin; en la página pública /empresas ordena internamente los
bloques (Empresas / Consultores) de mejor a peor, sin mostrarse. En
/admin/empresas la vista por defecto agrupa por bloques de dimensión
(Legal, Ambiental, Operativo, Técnico, Seguridad — una empresa puede
aparecer en varios), con columnas de rating y nº de reseñas y un selector
de orden (rating / reseñas / años / nombre); hay un toggle a lista completa.

## Rol de este archivo
Este es el archivo del ORQUESTADOR. Cuando recibas una instrucción:
1. Lee SIEMPRE primero `errores_aprendidos.md` antes de tocar código
2. Identifica qué agente corresponde según la tabla de abajo
3. Lee el archivo del agente en `agents/` y sigue sus reglas
4. Carga la skill correspondiente de `skills/` solo si la tarea la necesita
5. Los archivos de `context/` son la fuente de verdad del negocio:
   NUNCA contradigas `criterios_score.md` ni `perfil_usuario.md`

## Tabla de enrutamiento (qué agente activar)

| Si la tarea involucra... | Agente | Skill asociada |
|---|---|---|
| Endpoints, modelos BD, lógica de score, FastAPI, SQLite, pytest | agents/backend.md | skills/diagnostico-brechas |
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
  descarga el botón "Descargar la app" de la portada — URL fija).
- CORS: orígenes locales + regex `https://mine-link-[a-z0-9-]+\.vercel\.app` + FRONTEND_URL
  (ver `main.py`). Si la web pública no carga datos, revisar esto primero.

## Comandos comunes

### Backend (desde `backend/`)
```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000   # servidor dev
pytest -q                                                 # toda la suite
pytest tests/test_scoring.py -q                           # un archivo
pytest tests/test_smoke.py::test_post_diagnostico -q      # un test puntual
pip install -r requirements.txt                           # dependencias (usar --break-system-packages en este entorno)
```
Los tests (`tests/test_smoke.py`, `tests/test_scoring.py`) usan un engine SQLite en memoria propio
vía `app.dependency_overrides[get_db]` — nunca tocan la base real (SQLite local ni Supabase),
así que corren igual sin importar qué diga `DATABASE_URL`.

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
- RLS (Row Level Security) está activado en las 5 tablas de Supabase, sin políticas — bloquea el
  acceso vía la API pública de PostgREST (anon key), pero no afecta al backend porque se conecta
  como el owner (`postgres`) de las tablas.
- `backend/seeds/*.py` son scripts de migración/utilidad de un solo uso (correr con
  `python -m seeds.<nombre>` desde `backend/`, con el servidor detenido salvo que el propio script
  diga lo contrario). Incluyen migraciones de esquema SQLite (ADD COLUMN o rebuild de tabla cuando
  SQLite no soporta ALTER COLUMN), la migración de datos a Supabase, activar RLS, e índices/WAL.
  Antes de escribir una migración nueva, revisar si ya existe un script parecido para copiar el patrón.
  **OJO**: los seeds antiguos usan `sqlite3` directo y solo tocan la SQLite local — para una
  migración que deba correr contra la base real (Supabase), copiar el patrón de
  `seeds/migrar_ubicacion_maps.py`, que usa el engine de `database.py` (respeta `DATABASE_URL`)
  y funciona en ambos motores.
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
│   ├── criterios_score.md     ← 22 preguntas, pesos, brecha→estudio
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
│   ├── main.py                ← registra los routers, crea tablas al arrancar
│   ├── database.py            ← engine SQLite/Postgres, WAL, get_db()
│   ├── models.py               ← modelos SQLAlchemy (Operacion, Lead, Empresa,
│   │                              DocumentoOperacion, InteresInversion)
│   ├── schemas.py              ← Pydantic (request/response)
│   ├── scoring.py               ← lógica pura de score/brechas (sin BD)
│   ├── auth.py                  ← JWT admin/minero/inversionista, hashing de passwords
│   ├── security.py              ← límite de intentos de login por IP (429) y validación
│   │                              de firma real (magic bytes) de archivos subidos
│   ├── storage.py               ← archivos en Supabase Storage (prod) o disco local (dev/tests)
│   ├── imagenes.py              ← compresión automática de fotos subidas (máx 1600px, JPEG 80) y
│   │                              conversión de PDF → foto de la 1ª hoja (PyMuPDF); máx 5 fotos de
│   │                              mina por operación (uploads_config.py)
│   ├── geoubicacion.py          ← enlace de Google Maps → coordenadas (prioriza el pin !3d!4d
│   │                              sobre el centro de vista @) para el mapa incrustado
│   ├── uploads_config.py        ← rutas y categorías de archivos subidos
│   ├── requirements.txt
│   ├── .env.example              ← plantilla; .env real nunca se comparte
│   ├── routers/
│   │   ├── diagnostico.py        ← POST /diagnostico
│   │   ├── eventos.py            ← POST /eventos (métricas de embudo, anónimas)
│   │   ├── empresas.py           ← GET /empresas, /empresas/mejor-opcion, POST /consultores/postular
│   │   ├── leads.py              ← POST /leads (registro del minero + su cuenta)
│   │   ├── mineros.py            ← /mineros/login, /me, /perfil-inversion, /documentos
│   │   ├── inversionistas.py     ← /inversionistas/login, /me
│   │   ├── proyectos.py          ← vitrina pública /proyectos, /proyectos/{id}, /interes
│   │   └── admin.py              ← todo lo protegido por JWT admin
│   ├── seeds/                    ← migraciones y utilidades de un solo uso (ver arriba)
│   ├── uploads/                  ← archivos subidos (cvs/, documentos_mineros/) — NUNCA `rm -f *`
│   ├── backups/                  ← salida de seeds/backup_db.py
│   └── tests/
│       ├── test_smoke.py         ← flujo end-to-end de cada endpoint
│       └── test_scoring.py       ← lógica pura de scoring.py
└── frontend/
    ├── capacitor.config.ts        ← config de la app Android (androidScheme http para dev)
    ├── android/                   ← proyecto nativo generado por Capacitor (no editar a mano
    │                                  salvo AndroidManifest.xml)
    └── src/
        ├── components/            ← incluye subcarpeta proyecto/ para la ficha pública
        ├── pages/                 ← incluye admin/ para el panel
        ├── context/                ← AuthContext (admin), MineroAuthContext, InversionistaAuthContext
        ├── hooks/
        ├── types/
        └── services/api.ts        ← todas las llamadas fetch al backend
```

## Reglas de autonomía

### Puedes hacer SIN confirmar
- Crear/editar archivos de código
- Instalar dependencias (pip install --break-system-packages / npm install)
- Ejecutar uvicorn, npm run dev, pytest, npm run build
- Corregir errores de TypeScript, Python o ESLint

### SIEMPRE confirma antes de
- Borrar archivos o carpetas
- Modificar el esquema de BD si ya tiene datos
- Cambiar tsconfig.json, vite.config.ts o pyproject de forma sustancial
- Conectar un servicio externo NUEVO (Supabase ya está conectado vía `backend/.env`,
  eso no cuenta como "nuevo" — pero desplegar a un hosting, cambiar de proyecto de
  Supabase, o conectar otro servicio sí requiere confirmar)
- Correr cualquier `rm`/borrado sobre `backend/uploads/` más allá de un archivo puntual
  que el propio agente subió en la misma sesión (ver errores_aprendidos.md)

### Flujo ante un error
1. Intenta resolverlo hasta 2 veces
2. Si persiste → registra en errores_aprendidos.md (formato definido ahí)
3. Avisa: qué falló, qué intentaste, qué necesitas

## Reglas duras del negocio (NUNCA violar)
- REINFO/proceso de formalización iniciado YA NO es requisito para aparecer
  en la vitrina pública (cambio de política, julio 2026) — `bloqueado` sigue
  calculándose y se muestra al minero como estado informativo, pero no
  filtra `/proyectos`. Ver `context/criterios_score.md`
- Las fotos de los documentos legales (RUC, catastro, contrato, título,
  informe de leyes) SON públicas desde julio 2026 (decisión explícita del
  cliente, revierte una regla de privacidad anterior) — se sirven sin login
  vía `GET /proyectos/{id}/documentos/{doc_id}`. Solo se aceptan/guardan
  como foto (PDF se convierte al subir), nunca como PDF crudo
- El minero NUNCA ve datos de otros mineros
- Los datos de contacto del minero (leads) solo son visibles en el panel admin
- No inventes empresas: solo se muestran las que Esthiven cargó
- Todos los textos visibles al minero en lenguaje simple (ver perfil_usuario.md)
- Un mismo WhatsApp o código REINFO no puede registrar dos leads (409 si se repite)
- Un CIP (colegiatura) de consultor es único: no se puede postular dos veces con el mismo

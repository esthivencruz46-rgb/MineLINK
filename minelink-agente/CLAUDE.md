# MineLink — Motor de Búsqueda de Formalización Minera

## Objetivo del proyecto
Plataforma web donde un minero artesanal peruano:
1. Responde un cuestionario (5 bloques de formalización; el total de
   preguntas varía según tipo_mina, ver context/criterios_score.md)
2. Recibe su score (0-100) y su lista de brechas
3. Ve las empresas y consultores que hacen EXACTAMENTE los estudios que
   le faltan, o postula él mismo como consultor si es profesional
4. Si busca ayuda cercana, se registra (nombre, WhatsApp, email opcional,
   nombre de su operación, usuario y contraseña que él elige) — ese
   registro reemplaza el antiguo modal de solo nombre+WhatsApp
5. Puede volver a iniciar sesión (`/ingresar` → `/mi-cuenta`) con ese
   usuario/contraseña para ver su score y brechas sin rehacer el
   cuestionario (`POST /mineros/login`, `GET /mineros/me`)
6. Desde `/mi-cuenta` puede subir documentos (fotos de la mina, informe
   de leyes, catastro, RUC, contrato de explotación, título de concesión)
   y llenar un perfil de inversión opcional (descripción, producción/
   reservas, capital buscado, uso de fondos)
7. Todas las operaciones registradas (con Lead) y con REINFO vigente
   aparecen automáticamente en `/proyectos` (enlazado desde Inicio como
   "Ver proyectos mineros"), una vitrina pública buscable por mineral y
   departamento — SIN nombre real, WhatsApp ni email (`GET /proyectos`,
   `GET /proyectos/minerales`). Al hacer clic en un proyecto se abre su
   detalle (`GET /proyectos/{operacion_id}`): perfil de inversión
   completo, fotos de la mina (públicas, `GET /proyectos/{id}/fotos/{doc_id}`),
   y un checklist de qué documentos legales presentó (RUC, catastro,
   contrato, título, informe de leyes) — SIN mostrar esos archivos, porque
   suelen tener nombre completo/DNI del minero. Esto es la base de una
   futura conexión con inversionistas, pero todavía NO hay match
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

Esthiven es el único administrador: carga empresas, revisa leads, y
puede marcar brechas puntuales como resueltas por seguimiento manual
(sin que el minero repita el cuestionario, ver agents/admin.md). Las
empresas NO tienen acceso; Esthiven las carga manualmente, o las aprueba
si un consultor independiente se postuló solo.

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
├── DESPLIEGUE.md              ← checklist para el día que haya hosting/dominio real
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
│   ├── uploads_config.py        ← rutas y categorías de archivos subidos
│   ├── requirements.txt
│   ├── .env.example              ← plantilla; .env real nunca se comparte
│   ├── routers/
│   │   ├── diagnostico.py        ← POST /diagnostico
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
- Sin REINFO vigente → la operación NUNCA se lista ni recibe score público
- El minero NUNCA ve datos de otros mineros
- Los datos de contacto del minero (leads) solo son visibles en el panel admin
- No inventes empresas: solo se muestran las que Esthiven cargó
- Todos los textos visibles al minero en lenguaje simple (ver perfil_usuario.md)
- Un mismo WhatsApp o código REINFO no puede registrar dos leads (409 si se repite)
- Un CIP (colegiatura) de consultor es único: no se puede postular dos veces con el mismo

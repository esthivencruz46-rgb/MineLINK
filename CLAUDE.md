# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado actual (julio 2026) — modelo A/B/C/D DESPLEGADO en producción

The diagnostic was rebuilt around the owner's spec —
`minelink-agente/context/diagnostico_formalizacion.md` is the business source of truth:
4 filter questions (M0) route users into perfiles A "desde cero" / A_avanzado / B "concesionario
sin operar" / C "REINFO" / D "formal pleno" / SIN RUTA; output is TWO independent semáforos
(Track Legal + Track Técnico with Índice de Madurez 0-5). This model IS live in production;
the migration seeds for its columns (`migrar_estado_formalizacion.py`,
`migrar_revision_documentos.py`, `migrar_datos_formalizacion.py`, `migrar_notificaciones.py`)
were already run against Supabase.

Built on top of it since (all deployed):
- **Módulo INV** (`backend/catalogo_inversion.py` + frontend modal wizard): investment
  questionnaire per perfil (INV_0 común + bloque A/B/C/D), with upload slots derived ONLY
  from positive answers, admin alerts AL1-AL10, and evidence-first auto-resolution
  (uploading a respaldo resolves the brecha — no admin approval step; publication to
  /proyectos is automatic once formalización docs + Módulo INV are both ENVIADOS and the
  semáforo legal isn't rojo).
- **Scores 0-100 por track REINTRODUCED** (`scoring.score_formalizacion` /
  `score_inversion`): stage-anchored ranges (`RANGO_SCORE_POR_PERFIL`: D always above C
  above B...). They COMPLEMENT the semáforos (which still rule the regla de bloqueo), used
  to compare/sort projects in the cartera. Weights labeled "PENDIENTE DE CALIBRAR".
- **Privacy-by-design public surface**: liquidaciones de venta, estados financieros and
  fotos de trabajadores are PRIVATE forever; publicly only derived facts show
  (`IndicadoresVerificadosOut`: "✓ ventas verificadas · 3 docs · junio 2026"). Public ✓
  requires an uploaded photo. `respuestas_inversion_publicas` whitelist (`IDS_INV_PUBLICOS`)
  exposes decision data (capital, % a ceder, deudas, estructura legal) but never the
  negotiation history (INV_0_6/0_7) or perfil blocks.
- **GEOCATMIN integration** (`backend/geocatmin.py`): with the miner's map pin, the public
  ficha queries INGEMMET's ArcGIS REST (catastro minero + geología 1:100K), cached 30 days
  in `datos_formalizacion_json["_geocatmin"]` (underscore key, no migration). Best-effort:
  ficha never breaks if INGEMMET is down. Tests disable it via `MINELINK_GEOCATMIN=0`
  (same pattern as `MINELINK_RESOLVER_MAPS=0`).

Still pending:
- Admin dashboard's `score_promedio` still averages the legacy `score_total` (0 on new
  rows) — cosmetic, replace with madurez promedio / conteo por perfil when convenient.
- Old question sets are PAUSED, not deleted (owner decision, do not delete):
  `backend/scoring_legacy.py`, `frontend/src/data/preguntasPerfil.ts`,
  `perfilInformativo.ts`, `components/PerfilInformativoAgrupado.tsx`.

## What this repository is

**MineLink**: a web platform where Peruvian artisanal miners take a formalization diagnostic,
get placed in their exact stage of the legal pipeline with a checklist and semáforos, and get
matched with companies/consultants who provide exactly the studies/procedures they lack. It
also has a public "Proyectos" showcase for investors and an admin panel. Full backend
(FastAPI) and frontend (React) implementations live under `minelink-agente/`.

## Where to start

Read `minelink-agente/CLAUDE.md` first — it is the orchestrator file for this project and defines:
- The product itself and its current feature set (diagnostic, miner/investor accounts, admin panel,
  public projects showcase)
- Which sub-agent file (`minelink-agente/agents/*.md`) to follow for a given task (backend, frontend, or admin panel)
- Which skill file (`minelink-agente/skills/*/SKILL.md`) to load for score/gap logic, score display, company cards, or the admin panel
- The hard business rules that must never be contradicted (sourced from `minelink-agente/context/`)
- Autonomy rules (what can be done without confirmation vs. what always needs confirmation)
- Production deployment details (Vercel + Render + Supabase; auto-deploy on push to `main` —
  the push itself is done by Esthiven from GitHub Desktop; the agent has no git credentials)

The orchestrator, `context/criterios_score.md`, `agents/` and `skills/` were rewritten to the
current model in July 2026 (F5). If any doc ever conflicts with the code,
`context/diagnostico_formalizacion.md` and the current code win.

Before touching any code, also read `minelink-agente/errores_aprendidos.md` — it accumulates
environment-specific gotchas and is meant to be updated whenever an error takes more than one
attempt to resolve.

## Quick commands (full detail in minelink-agente/CLAUDE.md)

```bash
# Backend (from minelink-agente/backend/)
uvicorn main:app --reload --host 127.0.0.1 --port 8000
pytest -q                                            # full suite (~205 tests)
pytest tests/test_smoke.py::test_post_diagnostico -q # single test

# Frontend (from minelink-agente/frontend/)
npm run dev      # dev server on 127.0.0.1:5173 (use 127.0.0.1, not localhost)
npm run build    # tsc -b && vite build — this IS the typecheck; no separate lint/test
```

Tests use an in-memory SQLite engine via dependency override — they never touch the real DB,
regardless of `DATABASE_URL`, and they disable outbound network calls
(`MINELINK_RESOLVER_MAPS=0`, `MINELINK_GEOCATMIN=0`). But **`backend/.env` points
`DATABASE_URL` at production Supabase**: any seed/migration script run locally executes
directly against production — never run one without explicit confirmation.

## Big-picture architecture

- **Two data models per miner**: `Operacion` (the anonymous diagnostic record) is created by
  `POST /diagnostico` with no account; `Lead` (real name, WhatsApp, login credentials) is
  created later by `POST /leads` and points at the Operacion. Everything public (`/proyectos`)
  joins the two but never exposes Lead contact data.
- **Diagnostic is pure logic, no DB**: `backend/catalogo_diagnostico.py` (what is asked: ids,
  types, valid values, conditional visibility, brecha→estudio map) + `backend/scoring.py`
  (perfil routing, semáforos by condition rules, Índice de Madurez, stage-anchored scores,
  time-derived urgency with injectable `hoy`). `backend/catalogo_inversion.py` is the same
  idea for the Módulo INV (activación, ids por perfil, respaldos declarados, brechas INV,
  alertas admin). The frontend mirrors both catalogs (`frontend/src/data/preguntas.ts`,
  `preguntasInversion.ts`); **backend and frontend id sets must stay in sync or the POST 422s**.
- **Gap→provider matching**: NO/pending answers map to estudio codes; the same codes tag
  companies (`Empresa.estudios_json`). This mechanism survives every redesign — new estudios
  are added to the catalog, old ones stay as harmless legacy tags. The consultant signup form
  only offers estudios a current question can generate (`ESTUDIOS_CON_PREGUNTA`).
- **Evidence-first follow-up**: the miner self-serves — each brecha in "Lo que te falta" has
  "Ya lo tengo — subir respaldo", and `subir_documento` auto-appends to
  `brechas_resueltas_json`; `estado_seguimiento()` recomputes state by patching answers to
  their "resolved value" without mutating the original declaration (and drops only
  patch-orphaned conditional answers). Public ✓ (`brechas_verificadas`) requires the photo,
  not just the resolution.
- **Investor gating (regla de bloqueo)**: projects with an active legal fire (semáforo rojo)
  are hidden from `/proyectos`; perfil A and old-model rows never list; publication also
  requires `documentos_enviados_en` AND `inv_enviado_en` (both sent by the miner — no manual
  admin visto bueno anymore). Recomputed on every public read because REINFO-deadline urgency
  changes with time.
- **Public vs private files**: gallery categories (mina, mineral, acceso, agua/energía,
  maquinaria, muestreo, labores, área petitorio) and legal/estudio document photos are public;
  liquidaciones, estados financieros, OPEX records and worker photos stay private — publicly
  replaced by derived verified indicators. Uploaded PDFs are always converted to a JPEG of
  their first page — no raw PDFs stored/served.
- **External data, best-effort with cache**: Google Maps link → coords
  (`geoubicacion.py`, self-healing retry on read via `reparar_ubicacion_coords`) feeds the
  satellite mosaic; coords → GEOCATMIN concession + geology (`geocatmin.py`, 30-day cache).
  Neither can ever break or slow a public page: on failure, show last cached or nothing.
- **Dual-mode infrastructure**: DB is SQLite locally / Postgres (Supabase) when `DATABASE_URL`
  is set; file storage is local disk / Supabase Storage when `SUPABASE_URL`+`SUPABASE_SERVICE_KEY`
  are set.

## Repository layout

```
minelink-agente/
├── CLAUDE.md                  ← orchestrator: routes tasks to the right agent/skill
├── errores_aprendidos.md      ← environment gotchas + error log, read before coding
├── context/                   ← source of truth for business logic, never contradict
│   ├── diagnostico_formalizacion.md  ← CURRENT spec: perfiles A/B/C/D, semáforos, madurez
│   ├── criterios_score.md     ← OLD diagnostic rules (historical; rewrite pending in F5)
│   └── perfil_usuario.md      ← end-user (miner) profile and UI language rules
├── agents/                    ← one file per role (backend / frontend / admin panel)
├── skills/                    ← task-specific reference logic, loaded on demand
├── backend/                   ← FastAPI app
│   ├── catalogo_diagnostico.py ← question catalog + brecha→estudio (formalización)
│   ├── catalogo_inversion.py   ← Módulo INV: preguntas, respaldos, brechas, alertas
│   ├── scoring.py              ← perfiles/semáforos/madurez/scores (pure logic)
│   ├── scoring_legacy.py       ← ⏸️ old MineScore + Score Inversión (paused, don't import)
│   ├── geoubicacion.py         ← Maps link → coords (best-effort, self-healing)
│   ├── geocatmin.py            ← INGEMMET catastro+geología por punto (cached, best-effort)
│   └── seeds/                  ← one-shot migrations — run against PRODUCTION via .env, confirm first
└── frontend/                  ← React + Vite app (+ Capacitor Android in frontend/android/)
```

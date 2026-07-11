# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Rediseño del diagnóstico a perfiles A/B/C/D (julio 2026) — implementado, NO desplegado

The diagnostic was rebuilt around the owner's spec —
`minelink-agente/context/diagnostico_formalizacion.md` is the business source of truth
(4 filter questions route users into perfiles A "desde cero" / A_avanzado / B "concesionario
sin operar" / C "REINFO" / D "formal pleno" / SIN RUTA; output is TWO independent semáforos —
Track Legal + Track Técnico with Índice de Madurez 0-5 — which REPLACED the 0-100 MineScore
and Score de Atractivo de Inversión everywhere in the UI). Test suite green, frontend builds.

Still pending before deploying:
- **DB migration NOT run against Supabase**: `Operacion.estado_formalizacion` (stores the
  perfil A/…/D, derived server-side) exists in models.py but not in the production table —
  create/run an ADD COLUMN seed (pattern: `seeds/migrar_ubicacion_maps.py`) first.
- MiCuenta/MiConcesion and the admin panel still render legacy score fields (score 0) —
  cosmetic, needs the semáforo treatment. `context/criterios_score.md`, orchestrator CLAUDE.md
  and skills still describe the OLD model (F5 of the plan `~/.claude/plans/sequential-hugging-newt.md`).
- Old question sets are PAUSED, not deleted (owner decision, do not delete):
  `backend/scoring_legacy.py`, `frontend/src/data/preguntasPerfil.ts`, `perfilInformativo.ts`.

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
- Production deployment details (Vercel + Render + Supabase; auto-deploy on push to `main`)

Note: the orchestrator still describes the OLD diagnostic (22 Sí/No + MineScore) — it is
scheduled for rewrite in F5 of the plan. Where they conflict, `context/diagnostico_formalizacion.md`
and the plan file win.

Before touching any code, also read `minelink-agente/errores_aprendidos.md` — it accumulates
environment-specific gotchas and is meant to be updated whenever an error takes more than one
attempt to resolve.

## Quick commands (full detail in minelink-agente/CLAUDE.md)

```bash
# Backend (from minelink-agente/backend/)
uvicorn main:app --reload --host 127.0.0.1 --port 8000
pytest -q                                            # full suite
pytest tests/test_smoke.py::test_post_diagnostico -q # single test

# Frontend (from minelink-agente/frontend/)
npm run dev      # dev server on 127.0.0.1:5173 (use 127.0.0.1, not localhost)
npm run build    # tsc -b && vite build — this IS the typecheck; no separate lint/test
```

Tests use an in-memory SQLite engine via dependency override — they never touch the real DB,
regardless of `DATABASE_URL`. But **`backend/.env` points `DATABASE_URL` at production Supabase**:
any seed/migration script run locally executes directly against production.

## Big-picture architecture

- **Two data models per miner**: `Operacion` (the anonymous diagnostic record) is created by
  `POST /diagnostico` with no account; `Lead` (real name, WhatsApp, login credentials) is
  created later by `POST /leads` and points at the Operacion. Everything public (`/proyectos`)
  joins the two but never exposes Lead contact data.
- **Diagnostic is pure logic, no DB**: `backend/catalogo_diagnostico.py` (what is asked: ids,
  types, valid values, conditional visibility, brecha→estudio map) + `backend/scoring.py`
  (perfil routing, semáforos by condition rules, Índice de Madurez, time-derived urgency with
  injectable `hoy`). The frontend mirrors the catalog (`frontend/src/data/` — being rebuilt as
  `modulos.ts`); **backend and frontend id sets must stay in sync or POST /diagnostico 422s**.
- **Gap→provider matching**: NO/pending answers map to estudio codes; the same codes tag
  companies (`Empresa.estudios_json`). This mechanism survives every redesign — new estudios
  are added to the catalog, old ones stay as harmless legacy tags.
- **Admin follow-up layer**: `brechas_resueltas_json` records gaps the admin marked as
  resolved; `estado_seguimiento()` recomputes current state by patching answers to their
  "resolved value" without ever mutating the original declaration. Unparseable old-format rows
  degrade gracefully (derived fields None).
- **Investor gating (regla de bloqueo)**: projects with an active legal fire (semáforo rojo:
  caducidad, REINFO suspendido, plazo crítico) are hidden from `/proyectos`; perfil A and old
  rows never list. Evidence gating also applies: public ✓ requires an uploaded backing photo
  (`brechas_verificadas`, with `uploads_config.categoria_equivalente`).
- **Dual-mode infrastructure**: DB is SQLite locally / Postgres (Supabase) when `DATABASE_URL`
  is set; file storage is local disk / Supabase Storage when `SUPABASE_URL`+`SUPABASE_SERVICE_KEY`
  are set. Uploaded PDFs are always converted to a JPEG of their first page — no raw PDFs
  stored/served.

## Repository layout

```
minelink-agente/
├── CLAUDE.md                  ← orchestrator: routes tasks to the right agent/skill
├── errores_aprendidos.md      ← environment gotchas + error log, read before coding
├── context/                   ← source of truth for business logic, never contradict
│   ├── diagnostico_formalizacion.md  ← NEW spec: perfiles A/B/C/D, semáforos, madurez
│   ├── criterios_score.md     ← OLD diagnostic rules (historical; rewrite pending in F5)
│   └── perfil_usuario.md      ← end-user (miner) profile and UI language rules
├── agents/                    ← one file per role (backend / frontend / admin panel)
├── skills/                    ← task-specific reference logic, loaded on demand
├── backend/                   ← FastAPI app
│   ├── catalogo_diagnostico.py ← question catalog + brecha→estudio (new model)
│   ├── scoring.py              ← perfiles/semáforos/madurez (new model, pure logic)
│   └── scoring_legacy.py       ← ⏸️ old MineScore + Score Inversión (paused, don't import)
└── frontend/                  ← React + Vite app
```

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

**MineLink**: a web platform where Peruvian artisanal miners take a formalization-gap diagnostic,
get a score and a list of missing studies/permits, and get matched with companies/consultants who
provide exactly those studies. It also has a public "Proyectos" showcase for investors and an admin
panel. Full backend (FastAPI) and frontend (React) implementations live under `minelink-agente/`.

## Where to start

Read `minelink-agente/CLAUDE.md` first — it is the orchestrator file for this project and defines:
- The product itself and its current feature set (diagnostic, miner/investor accounts, admin panel,
  public projects showcase)
- Which sub-agent file (`minelink-agente/agents/*.md`) to follow for a given task (backend, frontend, or admin panel)
- Which skill file (`minelink-agente/skills/*/SKILL.md`) to load for score/gap logic, score display, company cards, or the admin panel
- The hard business rules that must never be contradicted (sourced from `minelink-agente/context/`)
- Autonomy rules (what can be done without confirmation vs. what always needs confirmation)

Before touching any code, also read `minelink-agente/errores_aprendidos.md` — it accumulates
environment-specific gotchas and is meant to be updated whenever an error takes more than one
attempt to resolve.

## Repository layout

```
minelink-agente/
├── CLAUDE.md                  ← orchestrator: routes tasks to the right agent/skill
├── errores_aprendidos.md      ← environment gotchas + error log, read before coding
├── context/                   ← source of truth for business logic, never contradict
│   ├── criterios_score.md     ← diagnostic questions, point weights, gap→study mapping
│   └── perfil_usuario.md      ← end-user (miner) profile and UI language rules
├── agents/                    ← one file per role, each with its own rules
│   ├── backend.md             ← FastAPI + SQLAlchemy + scoring logic
│   ├── frontend.md            ← React + TypeScript UI
│   └── admin.md               ← admin panel (CRUD empresas, leads, JWT)
├── skills/                    ← task-specific reference logic, loaded on demand
│   ├── diagnostico-brechas/SKILL.md  ← reference Python for score/gap calculation
│   ├── score-display/SKILL.md        ← score/gap UI components and copy
│   ├── empresa-card/SKILL.md         ← recommended-company card UI
│   └── admin-panel/SKILL.md          ← admin dashboard/table specs
├── backend/                   ← FastAPI app (see minelink-agente/CLAUDE.md for run/test commands)
└── frontend/                  ← React + Vite app (see minelink-agente/CLAUDE.md for run/build commands)
```

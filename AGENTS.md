# AGENTS.md

## Start here

1. Read `minelink-agente/CLAUDE.md` — it is the orchestrator. It routes tasks to agent files (`minelink-agente/agents/*.md`) and skill files (`minelink-agente/skills/*/SKILL.md`).
2. Read `minelink-agente/errores_aprendidos.md` **before touching any code** — it has environment gotchas that repeat if ignored.
3. Business rules live in `minelink-agente/context/` — never contradict `criterios_score.md` or `perfil_usuario.md`.

## Critical warnings

- **Diagnostic redesigned (julio 2026):** the diagnostic now follows the A/B/C/D profile model (`context/diagnostico_formalizacion.md` is the business source of truth; catalog in `backend/catalogo_diagnostico.py`, mirrored in `frontend/src/data/preguntas.ts` — any drift between them makes `POST /diagnostico` 422). Output is TWO independent semáforos + Índice de Madurez 0-5; the old 0-100 scores were retired from the UI (code preserved in `backend/scoring_legacy.py` and paused `data/preguntasPerfil.ts`, do not delete). The `Operacion.estado_formalizacion` column stores the PERFIL (A/A_avanzado/B/C/D) and has NOT been migrated to Supabase yet — run the ADD COLUMN migration before deploying.
- **`backend/.env` points at production Supabase.** Any seed or migration script run locally executes against production. Tests are safe (in-memory SQLite override), but manual seed scripts are not.
- **Never run broad `rm` on `backend/uploads/`** — has caused real data loss twice. See `errores_aprendidos.md`.

## Commands

All backend commands from `minelink-agente/backend/`:

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000   # dev server
pytest -q                                                  # full suite
pytest tests/test_scoring.py -q                            # scoring only
pytest tests/test_smoke.py::test_post_diagnostico -q       # single test
```

All frontend commands from `minelink-agente/frontend/`:

```bash
npm run dev       # dev server at 127.0.0.1:5173
npm run build     # tsc -b && vite build (this IS the typecheck)
```

No frontend linter or test runner is configured. `npm run build` is the only verification.

## Environment quirks (Windows)

- **Always use `127.0.0.1`, never `localhost`** — IPv6 resolution on Windows causes slow/hanging connections.
- `pip install` requires `--break-system-packages` in this environment.
- Backend must be launched **from `backend/`**, not from the repo root.
- Android Studio is installed at `C:\Program Files\Android\Android Studio1` (note the trailing "1"). JAVA_HOME must point to its JBR: `C:\Program Files\Android\Android Studio1\jbr`.
- Capacitor is pinned to **6.x** (not 8.x, which requires Node >=22; this env has Node 18).

## Architecture in one minute

- **Two models per miner:** `Operacion` (anonymous diagnostic, created by `POST /diagnostico`) and `Lead` (real identity, created by `POST /leads`, points at the Operacion). Public project pages join both but never expose Lead contact data.
- **Scoring is pure logic** in `backend/scoring.py` — no DB reads. Question IDs map to points, which map to per-dimension scores (0-100) and brecha (gap) codes. The same codes tag companies, enabling gap-to-provider matching.
- **Backend and frontend question ID sets must stay in sync** or `POST /diagnostico` returns 422. The frontend mirrors the catalog in `frontend/src/data/preguntas.ts`.
- **Dual-mode infra:** SQLite locally, Postgres (Supabase) when `DATABASE_URL` is set. File storage is local disk or Supabase Storage. PDFs are always converted to JPEG on upload.

## Deploy

- Push to `main` auto-deploys both frontend (Vercel) and backend (Render).
- **Push is done by Esthiven via GitHub Desktop** — the agent terminal lacks his credentials. After committing, ask him to push.
- Never commit `backend/.env` or any secrets.

## Autonomy

- **Do freely:** create/edit code files, install deps, run dev servers/tests, fix type/lint errors.
- **Always confirm first:** deleting files/folders, modifying DB schema with existing data, changing build configs (tsconfig, vite, pyproject), connecting new external services, any bulk delete of `backend/uploads/`.

## Error flow

Try to resolve up to 2 times. If it persists, log it in `minelink-agente/errores_aprendidos.md` (follow the format there) and report what happened.

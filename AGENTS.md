# AGENTS.md

## Start here

1. Read `minelink-agente/CLAUDE.md` — it is the orchestrator. It routes tasks to agent files (`minelink-agente/agents/*.md`) and skill files (`minelink-agente/skills/*/SKILL.md`).
2. Read `minelink-agente/errores_aprendidos.md` **before touching any code** — it has environment gotchas that repeat if ignored.
3. Business rules live in `minelink-agente/context/` — never contradict `diagnostico_formalizacion.md` (current spec), `criterios_score.md` or `perfil_usuario.md`.

## Critical warnings

- **Diagnostic follows the A/B/C/D profile model** (`context/diagnostico_formalizacion.md` is the business source of truth; catalog in `backend/catalogo_diagnostico.py`, mirrored in `frontend/src/data/preguntas.ts` — any drift between them makes `POST /diagnostico` 422). Output is TWO independent semáforos + Índice de Madurez 0-5 + two 0-100 track scores (`score_formalizacion` stage-anchored, `score_inversion`) shown in the cartera. `Operacion.estado_formalizacion` stores the PERFIL (A/A_avanzado/B/C/D); `seeds/migrar_estado_formalizacion.py` already ran against prod. The OLD MineScore model is dead but preserved — `backend/scoring_legacy.py` and paused `data/preguntasPerfil.ts`/`perfilInformativo.ts`/`PerfilInformativoAgrupado.tsx` (do not delete).
- **`backend/.env` points at production Supabase.** Any seed or migration script run locally executes against production. Tests are safe, but manual seed scripts are not.
- **Test isolation is complete even with a real `backend/.env`:** in-memory SQLite via `app.dependency_overrides[get_db]` **plus** replacing `database.SessionLocal` (background tasks bypass the override). All env is set at the top of `tests/test_smoke.py` BEFORE importing `main`/`auth` — `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` blanked (files → local disk), `MINELINK_ASESOR_PROVEEDORES`/`MINELINK_ASESOR_PROVEEDOR` emptied (asesor forced to "simulado", never a paid LLM call), plus `MINELINK_RESOLVER_MAPS=0`/`MINELINK_GEOCATMIN=0`/`MINELINK_REINFO=0`. Keep that order if you add env there.
- **Never run broad `rm` on `backend/uploads/`** — has caused real data loss twice. See `errores_aprendidos.md`.
- **Any new Supabase table needs its own RLS:** run `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` (pattern in `seeds/habilitar_rls_*.py`), or it's exposed through the public PostgREST anon key. The backend connects as owner, so RLS doesn't affect it.
- **Never call `asesor.actualizar_documentos_admin()` inline in a live request** — it eagerly rebuilds the BM25 index (~50s on a cold corpus; caused a real 90s hang). Only schedule it via `BackgroundTasks`, gated by the cheap `documentos_admin_cambiaron()`.
- **Feeding the asesor corpus:** run `backend/convertir_pdfs_asesor.py` before dropping PDFs into `context/asesor_conocimiento/` — it converts them to `.md` and deletes the source PDF (real corpus: 92 MB → 8.4 MB, cold start 10s → <1s).
- **Any new per-IP limiter must use `security._ip_real(request)`** (`CF-Connecting-IP` first, then `X-Forwarded-For`), never `request.client.host` — behind Render + Cloudflare that's the same internal proxy IP for every visitor (shared rate limit across all traffic, real July 2026 bug).

## Commands

All backend commands from `minelink-agente/backend/`:

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000   # dev server
pytest -q                                                  # full suite
pytest tests/test_scoring.py -q                            # scoring only
pytest tests/test_smoke.py::test_post_diagnostico -q       # single test
```
Module-specific test files exist: `test_asesor.py`, `test_geocatmin.py`, `test_copernicus.py`, `test_interpretacion_ubicacion.py`. All tests use an in-memory SQLite engine and disable outbound calls — they never touch the real DB regardless of `DATABASE_URL`. `pytest` is NOT in `requirements.txt` (already installed in this env). The app fails fast at import without `ADMIN_USERNAME`/`ADMIN_PASSWORD`/`SECRET_KEY` (`auth.py`) — a fresh `.env` needs all three.

Seeds/migrations run as `python -m seeds.<nombre>` from `backend/`. They use the same engine as `database.py`, so **`backend/.env` points them at production** — never run one without explicit confirmation. `main.py` runs `Base.metadata.create_all` at startup (creates missing tables on both engines), but it never alters existing tables — new columns still need a seed migration.

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
- **Scoring is pure logic** in `backend/scoring.py` — no DB reads (`hoy` injectable). Answers map to perfil, semáforos, madurez, track scores, and brecha (gap) codes. The same codes tag companies (`Empresa.estudios_json`), enabling gap-to-provider matching.
- **Brand name is a single source of truth:** `frontend/src/config/marca.ts`. Every visible text imports it — never hardcode the brand. Technical identifiers (Android appId `com.minelink.app`, localStorage keys, DB/bucket names, `MINELINK_*` env vars, published `MineLink.apk`) never change with the brand.
- **Backend and frontend question ID sets must stay in sync** or `POST /diagnostico` returns 422. The frontend mirrors the catalog in `frontend/src/data/preguntas.ts`.
- **Dual-mode infra:** SQLite locally, Postgres (Supabase) when `DATABASE_URL` is set. File storage is local disk or Supabase Storage. PDFs are always converted to JPEG on upload.
- **Repo-root `experimentos_gee/` and `experimentos_copernicus/` are gitignored prototypes** (own venvs, own `.env`, GEE/Sentinel design work) — intentionally never imported by the backend; the real code is `backend/copernicus.py`. Don't confuse them with production code.

## Deploy

- Push to `main` auto-deploys both frontend (Vercel) and backend (Render).
- **Push is done by Esthiven via GitHub Desktop** — the agent terminal lacks his credentials. After committing, ask him to push.
- A daily DB backup runs via `.github/workflows/backup-db.yml` (secret `DATABASE_URL_BACKUP`).
- Render requires `PYTHON_VERSION=3.12.8` env var set — without it the build fails with a newer Python.
- Never commit `backend/.env` or any secrets.

## Autonomy

- **Do freely:** create/edit code files, install deps, run dev servers/tests, fix type/lint errors.
- **Always confirm first:** deleting files/folders, modifying DB schema with existing data, changing build configs (tsconfig, vite, pyproject), connecting new external services, any bulk delete of `backend/uploads/`.

## Error flow

Try to resolve up to 2 times. If it persists, log it in `minelink-agente/errores_aprendidos.md` (follow the format there) and report what happened.

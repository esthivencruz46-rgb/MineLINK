# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado actual (julio 2026) — modelo A/B/C/D DESPLEGADO en producción

The diagnostic was rebuilt around the owner's spec —
`minelink-agente/context/diagnostico_formalizacion.md` is the business source of truth:
4 filter questions (M0) route users into perfiles A "desde cero" / A_avanzado / B "concesionario
sin operar" / C "REINFO" / D "formal pleno" / SIN RUTA; output is TWO independent semáforos
(Track Legal + Track Técnico with Índice de Madurez 0-5). This model IS live in production;
the migration seeds for its columns (`migrar_estado_formalizacion.py`,
`migrar_revision_documentos.py`, `migrar_datos_formalizacion.py`, `migrar_notificaciones.py`,
plus later `migrar_reinfo_verificado.py`, `habilitar_rls_tablas_nuevas.py` and
`migrar_contexto_empresas_csv.py`) were already run against Supabase.

Built on top of it since (all deployed):
- **Brand is "MineLink"** (briefly renamed to "Qorilink" in July 2026, then reverted by
  the owner days later). Single source of truth: `frontend/src/config/marca.ts` (`MARCA`);
  to rename change ONLY that line (+ `index.html` metas, the brand images in
  `frontend/public/` and docs by hand). Technical identifiers (hosting URLs, Android appId
  `com.minelink.app`, localStorage keys, DB/bucket names, `MINELINK_*` env vars, the
  published `MineLink.apk`) never change with the brand — renaming those breaks deployed
  clients.
- **Módulo INV** (`backend/catalogo_inversion.py` + frontend modal wizard): investment
  questionnaire per perfil (INV_0 común + bloque A/B/C/D), with upload slots derived ONLY
  from positive answers, admin alerts AL1-AL10, and evidence-first auto-resolution
  (uploading a respaldo resolves the brecha; publication to /proyectos is automatic once
  formalización docs + Módulo INV are both ENVIADOS and the semáforo legal isn't rojo).
- **Admin per-document review REINTRODUCED** (July 2026, owner reversal of the earlier
  "evidence is enough" policy): `DocumentoOperacion.estado_revision`
  (pendiente/aprobado/rechazado, set from AdminLeads) now gates the public "Con respaldo"
  badge everywhere (ficha, cartera chips, indicadores verificados, PDF). Uploading still
  self-resolves the brecha and never blocks publication — approval only controls the badge.
- **Manual REINFO verification**: the automated MINEM scraper is disabled by default
  (`backend/reinfo.py`, `MINELINK_REINFO != "1"` — plain `requests` gets false
  "no_encontrado"; a working approach needs Playwright, deferred). Esthiven verifies the
  código by hand and marks `Operacion.reinfo_verificado_manual` from the admin; the ficha
  and PDF show "Código REINFO verificado por el equipo de MineLink".
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
  ficha queries INGEMMET's ArcGIS REST (catastro minero + geología 1:100K/50K + fallas
  geológicas cercanas, proximity-searched at 2km with a widened 10km×10km fallback retry
  when nothing is found — `_fallas_cercanas`), cached 30 days in
  `datos_formalizacion_json["_geocatmin"]` (underscore key, no migration). Best-effort:
  ficha never breaks if INGEMMET is down. Tests disable it via `MINELINK_GEOCATMIN=0`
  (same pattern as `MINELINK_RESOLVER_MAPS=0`). It also renders the server-composited map
  (satellite + catastro + geología + pin, `imagen_mapa_cotejo`) used as the PDF cover via
  `GET /proyectos/{id}/mapa-cotejo.jpg`. The INTERACTIVE map on the ficha
  (`frontend/src/components/proyecto/MapaGeocatmin.tsx`, Leaflet + esri-leaflet
  `dynamicMapLayer`/`imageMapLayer`) layers catastro minero (always on top, own Leaflet
  pane, z-index 430), the operation pin (own pane, 440, the very top — a circleMarker
  defaults to Leaflet's overlayPane at 400, which sat BELOW catastro until this was
  fixed), geología 100K/50K, fallas (its own pane, 420, always above geología) and —
  added July 2026 after Esthiven asked what else INGEMMET offers in satellite imagery —
  3 more toggles, each off by default: ASTER 9-3-1 and QICIMI mineral-alteration
  composites, and INGEMMET's own `SERV_ANOMALIA_ESPECTRAL` polygon layer (a 4th, the
  ASTER DEM rendered with an ad-hoc `Hillshade` `renderingRule`, was tried — the raw DEM
  export is flat gray with no contrast — then removed at Esthiven's request). Each has
  its own independent checkbox (Esthiven explicitly asked for that over one bundled
  toggle) and its own `minZoom: 12` (roughly the local ~10km view around the pin) so
  INGEMMET is never asked to render half the country if one is checked while zoomed
  out — a per-layer esri-leaflet option, not a manual add/removeLayer, specifically
  because removing an already-registered control overlay from the map desyncs its
  checkbox.
- **Empresas bulk import** (`POST /admin/empresas/importar`) accepts TWO CSV formats,
  auto-detected by headers: the native one AND the raw Google Places scraping file
  (name,address,phone,website,category,keyword,block...) converted by
  `_fila_desde_scraping`. Bulk-imported rows skip the RUC/colegiatura requirement
  (`schemas.EmpresaImportarCSV`) but are born `activa=False` — invisible to miners until
  the admin reviews/activates each one. The strict identity rule lives ONLY in
  `EmpresaCreate` (manual "+ Nuevo" and public postulation). `Empresa` also carries
  scraping context columns (web/telefono/direccion/categoria/keyword), admin-only.
- **Institutional visual language** (July 2026, owner-approved direction): thin borders
  instead of shadowed rounded cards, flat chips instead of colored pills, `font-semibold`
  instead of `font-bold`, accent color reserved for the primary action; semantic
  green/amber/red kept only where it encodes real state. Applied across ALL public pages
  and the admin — match it in any new UI.
- **SEO/launch surface**: `frontend/public/` has `sitemap.xml`, `robots.txt`, favicon set
  and `og.png`; `index.html` carries the Google Search Console verification meta tag —
  NEVER remove it (verification is revoked if it disappears). Daily DB backup runs via
  `.github/workflows/backup-db.yml` (needs `postgresql-client-17` — Supabase runs PG 17;
  secret `DATABASE_URL_BACKUP` already configured).
- **Public conversational advisor** (`backend/asesor.py` + `routers/asesor.py`,
  `frontend/src/components/AsesorWidget.tsx`): a floating chat widget (bottom-right,
  mounted once in `App.tsx` outside the router so it persists on every public page) that
  answers general formalization questions — no login, no per-user personalization
  (explicit owner decision: it never sees anyone's actual diagnosis). Live in production
  (code confirmed deployed; provider API keys go in Render's Environment panel, never
  in the repo). Esthiven feeds it by dropping `.md`/`.txt`/`.pdf` files (laws,
  jurisprudence, guides) into topic subfolders under `context/asesor_conocimiento/`
  (read recursively) — no code change needed; PDFs should be converted to `.md` first
  with `backend/convertir_pdfs_asesor.py` (reuses the same PyMuPDF extraction, deletes
  the source PDF after) — on the real corpus this cut 92 MB to 8.4 MB and dropped the
  first-request index-build cold start from ~10s to <1s, so always run it before adding
  new PDFs. Real retrieval, "Nivel 1.5" (July 2026, after the folder grew past ~2M
  tokens and "send everything" stopped fitting in any real provider's context window):
  every file is chunked (`_trocear`, ~1200 chars with overlap) and indexed with BM25
  (`rank_bm25`, lexical/keyword search — no vector DB, no embeddings API, nothing new to
  host) with Spanish stopwords filtered before scoring (`_STOPWORDS_ES` — without it,
  a document that happens to repeat "qué"/"es"/"el" a lot can outrank the actually
  relevant one). Only the top `FRAGMENTOS_POR_PREGUNTA` (8) chunks matching each
  question get sent, plus `diagnostico_formalizacion.md` + `perfil_usuario.md` (~8K
  tokens) which always go in full since they describe MineLink itself. Both the chunk
  index and the core spec are cached in-process after first read (a redeploy re-reads).
  If lexical search ever proves insufficient — mainly for colloquial questions that
  share no words with the legal text — embeddings/pgvector is the documented next step
  ("Nivel 2" in the module docstring), not needed yet. Generation is a **fallback chain
  across providers** (July 2026, owner request: "cuando se acaba la gratuidad por día
  pasa al otro"): `MINELINK_ASESOR_PROVEEDORES` is a priority-ordered comma list (ex.
  `gemini,kimi,deepseek,qwen,glm,openai`); `generar_respuesta()` tries each in order and
  silently moves to the next on ANY failure (no quota, invalid key, network error — all
  normalize to `AsesorNoDisponible`), only surfacing "no disponible" if every configured
  provider fails. `MINELINK_ASESOR_PROVEEDOR` (singular) still works for one provider;
  no env at all defaults to a free `simulado` mode. Gemini (`gemini-3.5-flash-lite`,
  switched from plain `flash` — the full model returned 503 "high demand" consistently
  with the real ~10K-token prompt while `-lite` didn't, verified live July 2026) is the
  only provider with a real free tier (no card needed, ~1500 req/day) — the other 6
  adapters (claude/grok/kimi/deepseek/qwen/glm/openai) are wired and tested but need
  billing added on their own dashboards before they'll respond for real. Per-provider
  model override: `MINELINK_ASESOR_MODELO_<PROVEEDOR>`. Rate-limited per IP (15/hour,
  `security.limitar_preguntas_asesor`) since real API calls cost money. BM25 tokenizing
  stems words (`snowballstemmer`, Spanish) so "suspendieron"/"suspendido"/"suspender"
  count as the same token — measured against realistic colloquial questions (miners
  don't phrase things like the legal text), this fixed real zero-result queries; matching
  a colloquial phrase to a legal term the asker doesn't know the name of (ex. "papel para
  no tener problemas ambientales" → IGAFOM) is the one gap left, and would need semantic
  search to close. Dashboard health check, `LlamadaAsesor` table (migration
  `seeds/migrar_llamadas_asesor.py`, confirm before running against prod — replaced the
  earlier generic `Evento`-based counter after a live Gemini 503 could only be diagnosed
  by curling prod from a terminal): every call to `/asesor` writes one row
  (`exitoso`, `proveedor`, `detalle`) — `asesor.generar_respuesta_con_proveedor()` returns
  `(texto, proveedor)` on success and `AsesorNoDisponible.proveedor` carries which one
  raised last on failure (`asesor.py` still never touches the DB — the router queries and
  writes). `DashboardOut.asesor_ultimo_proveedor_ok` / `asesor_ultima_falla` (provider +
  error text + timestamp) surface this — check these instead of assuming "no traffic"
  when a provider silently breaks. Retrieved fragments are labeled with a
  citable form of their filename (`_etiqueta_citable`: strips subfolder/extension,
  underscores → spaces, ex. "DS 038-2017-EM Reglamento IGAFOM") and the system prompt
  explicitly instructs citing the specific law/decree by name in the answer (owner
  request: real citations read as more professional/trustworthy) — never invented,
  only from what's actually in a retrieved fragment's label.
- **Second way to feed the advisor — no git needed** (owner request: "imagine I stop
  using Claude Code"): `/admin/asesor` lets Esthiven upload a PDF/.md/.txt straight from
  the browser. The backend extracts the text (`asesor.extraer_texto_pdf_bytes`) and
  stores it — not the raw file — in the new `DocumentoAsesor` table (migration
  `seeds/migrar_documentos_asesor.py`, not yet run against prod — confirm before
  running). `asesor.py` itself never touches the DB (keeps its tests DB-free): the
  router queries `DocumentoAsesor.activo` on every question and calls
  `asesor.actualizar_documentos_admin(...)`, which only rebuilds the cached BM25 index
  if that list actually changed since the last question — no redeploy needed, live
  within one request of uploading. This is fully independent of and complementary to
  the git-committed `context/asesor_conocimiento/` folder; both get merged into the
  same search index.

Still pending:
- Old question sets are PAUSED, not deleted (owner decision, do not delete):
  `backend/scoring_legacy.py`, `frontend/src/data/preguntasPerfil.ts`,
  `perfilInformativo.ts`, `components/PerfilInformativoAgrupado.tsx`.
- Automated REINFO checking (would need a Playwright-based service; owner said "por
  ahora ya no").

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
pytest -q                                            # full suite (~250 tests)
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
  and the "Con respaldo" badge additionally requires `estado_revision == "aprobado"` set by
  the admin — declaration alone earns neither.
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
- **Conversational advisor is stateless and generic**: `POST /asesor` takes no auth and
  knows no one's diagnosis — it only ever sees the concatenated content of `context/` +
  `context/asesor_conocimiento/` (see above) plus the last `MAX_TURNOS_HISTORIAL` chat
  turns the frontend sends back each call. Nothing about a conversation persists server-side.

## Repository layout

```
minelink-agente/
├── CLAUDE.md                  ← orchestrator: routes tasks to the right agent/skill
├── errores_aprendidos.md      ← environment gotchas + error log, read before coding
├── context/                   ← source of truth for business logic, never contradict
│   ├── diagnostico_formalizacion.md  ← CURRENT spec: perfiles A/B/C/D, semáforos, madurez
│   ├── criterios_score.md     ← OLD diagnostic rules (historical; rewrite pending in F5)
│   ├── perfil_usuario.md      ← end-user (miner) profile and UI language rules
│   └── asesor_conocimiento/   ← drop .md/.txt/.pdf here (any subfolder depth) to feed
│                                 the public advisor — read recursively, see asesor.py
├── agents/                    ← one file per role (backend / frontend / admin panel)
├── skills/                    ← task-specific reference logic, loaded on demand
├── backend/                   ← FastAPI app
│   ├── catalogo_diagnostico.py ← question catalog + brecha→estudio (formalización)
│   ├── catalogo_inversion.py   ← Módulo INV: preguntas, respaldos, brechas, alertas
│   ├── scoring.py              ← perfiles/semáforos/madurez/scores (pure logic)
│   ├── scoring_legacy.py       ← ⏸️ old MineScore + Score Inversión (paused, don't import)
│   ├── asesor.py                ← public advisor: RAG-light retrieval + provider-agnostic generation
│   ├── geoubicacion.py         ← Maps link → coords (best-effort, self-healing)
│   ├── geocatmin.py            ← INGEMMET catastro+geología por punto (cached, best-effort)
│   └── seeds/                  ← one-shot migrations — run against PRODUCTION via .env, confirm first
└── frontend/                  ← React + Vite app (+ Capacitor Android in frontend/android/)
```

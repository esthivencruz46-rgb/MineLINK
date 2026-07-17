# Qorilink

**Plataforma web que conecta a mineros artesanales del Perú en proceso de formalización con las empresas, consultores e inversionistas que necesitan.**

🌐 **Web**: https://mine-link-seven.vercel.app · **API**: https://minelink-api.onrender.com

---

## ¿Qué hace?

1. **Diagnóstico de formalización gratuito** — 4 preguntas filtro ubican al minero en su perfil exacto del pipeline legal peruano:

   | Perfil | Situación |
   |---|---|
   | **A** | Quiere una concesión desde cero |
   | **A avanzado** | Petitorio en trámite |
   | **B** | Concesionario que aún no opera |
   | **C** | Opera con REINFO (formalizándose) |
   | **D** | Formal pleno (autorización DREM/GREM) |
   | **Sin ruta** | Opera sin amparo legal → página informativa |

   Cada perfil responde SOLO su módulo. El resultado son **dos semáforos independientes** (Track Legal y Track Técnico con Índice de Madurez 0-5), un checklist de su etapa y sus brechas. Regla de oro: *sobrevivir → ordenar → crecer* — nunca se presenta un inversionista a quien tiene un incendio legal activo.

2. **Match brecha → proveedor** — cada requisito que el minero NO tiene se conecta con las empresas y consultores del directorio que hacen exactamente ese estudio o trámite, filtrados por región. El contacto siempre lo intermedia el administrador (los datos nunca se exponen).

3. **Cuenta del minero** — sube fotos de respaldo por cada requisito que declaró tener ("Respalda tu declaración"), completa su perfil de inversión (Módulo INV) y recibe notificaciones. Subir la evidencia de una brecha la resuelve automáticamente.

4. **Cartera pública para inversionistas** (`/proyectos`) — publicación automática cuando el proyecto cumple: perfil B/C/D + semáforo legal no rojo + documentos y Módulo INV enviados. Cada ficha muestra:
   - Mapa satelital con las capas oficiales de **GEOCATMIN/INGEMMET** (catastro minero + geología 1:100K y 1:50K) y el pin de la operación.
   - **Cotejo con registros públicos**: concesión del catastro, geología del punto, alertas de Área Natural Protegida (SERNANP) y verificación del código REINFO.
   - Checklist de formalización con las fotos de respaldo — el sello **"Con respaldo"** solo aparece en documentos revisados y aprobados por el equipo de Qorilink.
   - Oportunidad de inversión (capital buscado, qué ofrece, % a ceder, deudas declaradas) y datos de la operación (ley, litología, reservas, OPEX).
   - Descarga de **ficha en PDF** con el mapa de ubicación como portada.

5. **Panel de administración** — leads con su diagnóstico completo, revisión de documentos (aprobar/rechazar con motivo), verificación manual de códigos REINFO, alta de empresas (individual o CSV), intermediación de intereses y dashboard con métricas por perfil.

## Privacidad por diseño

- Liquidaciones de venta, estados financieros, registros OPEX y fotos de trabajadores son **privados para siempre** — públicamente solo se muestra el hecho verificado ("✓ ventas respaldadas · 3 docs · junio 2026").
- Los datos de contacto del minero solo los ve el administrador; empresas e inversionistas nunca los reciben directo.
- Todo PDF subido se convierte a imagen de su primera página — nunca se almacena ni se sirve un PDF crudo.
- Los datos de GEOCATMIN son siempre referenciales (el pin lo declara el minero y es aproximado).

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Python 3.12 · FastAPI · SQLAlchemy |
| Base de datos | PostgreSQL (Supabase) — SQLite en desarrollo |
| Archivos | Supabase Storage (bucket privado) — disco local en desarrollo |
| Frontend | React 18 · TypeScript · Tailwind CSS · Vite |
| Mapa | Leaflet + esri-leaflet (capas ArcGIS de INGEMMET) |
| App Android | Capacitor 6 (mismo frontend React) |
| Hosting | Vercel (web) + Render (API), auto-deploy al hacer push a `main` |

## Desarrollo local

```bash
# Backend (desde minelink-agente/backend/)
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
pytest -q          # suite completa (~230 tests, usa SQLite en memoria)

# Frontend (desde minelink-agente/frontend/)
npm install
npm run dev        # http://127.0.0.1:5173
npm run build      # typecheck (tsc) + build de producción
```

Los tests nunca tocan la base real ni hacen llamadas externas (Google Maps, INGEMMET y MINEM se desactivan con variables de entorno).

## Estructura del repositorio

```
minelink-agente/
├── backend/
│   ├── catalogo_diagnostico.py   # preguntas del diagnóstico + mapa brecha→estudio
│   ├── catalogo_inversion.py     # Módulo INV: preguntas, respaldos, alertas
│   ├── scoring.py                # perfiles, semáforos, madurez, scores (lógica pura)
│   ├── geocatmin.py              # INGEMMET/SERNANP por punto + mapa compuesto del PDF
│   ├── routers/                  # diagnóstico, mineros, proyectos, empresas, admin...
│   └── tests/                    # smoke end-to-end + tests de lógica pura
├── frontend/
│   └── src/
│       ├── data/                 # espejos TS de los catálogos del backend
│       ├── pages/                # rutas públicas, cuentas y panel admin
│       └── components/           # incluye proyecto/ (ficha pública)
├── CLAUDE.md                     # guía del proyecto para desarrollo asistido
├── DESPLIEGUE.md                 # checklist de despliegue + respaldo de la BD
├── RUTAS.md                      # mapa de rutas del frontend
└── errores_aprendidos.md         # bitácora de gotchas del entorno
```

## Seguridad

- Contraseñas con hash bcrypt; JWT separados para minero, inversionista y admin.
- Rate-limiting en logins, recuperación de contraseña y formularios públicos.
- Validación de magic bytes en cada archivo subido (un ejecutable disfrazado de foto se rechaza).
- Row Level Security activado en todas las tablas de Supabase.
- Respaldo diario automático de la base de datos vía GitHub Actions (`.github/workflows/backup-db.yml`).

## Documentación adicional

| Archivo | Contenido |
|---|---|
| [`minelink-agente/DESPLIEGUE.md`](minelink-agente/DESPLIEGUE.md) | Cómo replicar el despliegue y cómo funciona el respaldo de la BD |
| [`minelink-agente/RUTAS.md`](minelink-agente/RUTAS.md) | Todas las rutas del frontend (públicas / cuentas / admin) |
| [`minelink-agente/INTERMEDIACION.md`](minelink-agente/INTERMEDIACION.md) | Filosofía del match minero–inversionista |
| [`minelink-agente/LIMPIEZA.md`](minelink-agente/LIMPIEZA.md) | Cómo borrar datos de simulación de forma segura |
| [`minelink-agente/context/diagnostico_formalizacion.md`](minelink-agente/context/diagnostico_formalizacion.md) | Spec de negocio del diagnóstico (fuente de verdad) |

---

*Proyecto de Esthiven Cruz — construido para acercar la formalización minera artesanal del Perú a quienes la viven en el campo.*

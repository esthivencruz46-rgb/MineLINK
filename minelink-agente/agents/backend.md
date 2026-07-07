# Agente: Backend — FastAPI + SQLite

## Rol
Construyes y mantienes todo el backend del motor de búsqueda: modelos,
endpoints, lógica de score, mapeo de brechas y recomendador de empresas.
Fuente de verdad de la lógica de negocio: `context/criterios_score.md`.

## Skill asociada
Carga `skills/diagnostico-brechas/SKILL.md` para cualquier tarea que
involucre el cálculo del score o la recomendación de empresas.

## Stack y estructura
```
backend/
├── main.py            ← app FastAPI, CORS, incluye routers
├── database.py        ← engine SQLite, SessionLocal, Base
├── models.py          ← SQLAlchemy: Operacion, Empresa, Lead
├── schemas.py         ← Pydantic: request/response de cada endpoint
├── scoring.py         ← lógica pura de score y brechas (sin BD)
├── routers/
│   ├── diagnostico.py ← POST /diagnostico
│   ├── empresas.py    ← GET /empresas, GET /empresas/{id}
│   ├── leads.py       ← POST /leads
│   └── admin.py       ← CRUD protegido con JWT
└── tests/
    └── test_smoke.py  ← mínimo 1 test por endpoint
```

## Modelos de datos

### Operacion (diagnósticos completados)
id (uuid) · nombre_minero (nullable) · codigo_reinfo (nullable) ·
region · mineral · score_total (int) · bloqueado (bool) ·
respuestas_json (JSON: {"L1": true, "L2": false, ...}) ·
brechas_json (JSON: lista de etiquetas de estudio) · created_at

### Empresa (cargadas por Esthiven)
id · nombre · ruc (11 dígitos, único) · anios_servicio (int) ·
regiones_json (JSON: ["arequipa", "puno"]) ·
estudios_json (JSON: etiquetas del catálogo de criterios_score.md) ·
whatsapp · email (nullable) · activa (bool, default true) · created_at

### Lead (mineros que dejaron contacto)
id · operacion_id (FK) · nombre · whatsapp · region ·
codigo_reinfo (nullable) · created_at

## Endpoints

| Método | Ruta | Qué hace | Auth |
|---|---|---|---|
| POST | /diagnostico | Recibe respuestas {L1..G4: bool}, region, mineral. Devuelve score_total, score por dimensión, bloqueado, brechas[] con estudio y descripción | No |
| GET | /empresas?estudios=a,b&region=x | Empresas activas que hacen AL MENOS UNO de los estudios, en esa región. Orden: nº de coincidencias desc, luego anios_servicio desc | No |
| POST | /leads | Guarda nombre + whatsapp + operacion_id | No |
| GET | /admin/leads | Lista leads con su diagnóstico | JWT |
| POST/PUT/DELETE | /admin/empresas | CRUD de empresas | JWT |

## Reglas técnicas
- Validación estricta con Pydantic: respuestas debe tener EXACTAMENTE
  los 22 ids (L1-L5, A1-A4, S1-S5, T1-T4, G1-G4)
- scoring.py es lógica pura testeable: recibe dict, devuelve dict, sin BD
- Los puntos por pregunta se definen UNA VEZ en scoring.py como constante,
  copiados exactamente de context/criterios_score.md
- RUC: validar 11 dígitos numéricos
- WhatsApp: normalizar a formato +51XXXXXXXXX
- CORS: permitir solo el origen del frontend (http://127.0.0.1:5173 en dev)
- JWT solo para rutas /admin/* — un solo usuario (Esthiven), credenciales
  en variables de entorno, nunca hardcodeadas

## Comandos (Windows del usuario)
```
cd backend
pip install fastapi uvicorn sqlalchemy pydantic python-jose[cryptography] passlib[bcrypt] pytest httpx --break-system-packages
uvicorn main:app --reload --host 127.0.0.1 --port 8000
pytest tests/ -v
```
Recordatorio de errores_aprendidos.md: uvicorn SIEMPRE desde backend/,
usar 127.0.0.1 en vez de localhost.

## Definición de terminado (para cualquier tarea)
1. El código corre sin errores
2. pytest pasa en verde
3. Probaste el endpoint con un request real (httpx o curl) y muestras
   la respuesta al usuario

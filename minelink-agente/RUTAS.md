# Rutas principales — Qorilink

Base local del frontend (con `npm run dev` corriendo): `http://127.0.0.1:5173`

## Público (mineros / visitantes)
| Ruta | Descripción |
|---|---|
| `/` | Inicio |
| `/como-funciona` | Explicación en 3 pasos para cada perfil |
| `/diagnostico` | Cuestionario de formalización |
| `/resultado` | Score y brechas |
| `/empresas` | Empresas/consultores recomendados |
| `/postular` | Postulación de consultor independiente |
| `/proyectos` | Vitrina pública de proyectos mineros |
| `/proyectos/:id` | Detalle de un proyecto |
| `/ingresar` | Login del minero |
| `/mi-cuenta` | Cuenta del minero (requiere login) |

## Inversionistas
| Ruta | Descripción |
|---|---|
| `/ingresar-inversionista` | Login del inversionista |
| `/mi-cuenta-inversionista` | Cuenta del inversionista (requiere login) |

## Panel administrativo (Esthiven)
| Ruta | Descripción |
|---|---|
| `/admin/login` | Login admin |
| `/admin` | Dashboard |
| `/admin/empresas` | CRUD de empresas |
| `/admin/leads` | Lista de leads registrados |

**Credenciales admin**: están en `backend/.env` (líneas `ADMIN_USERNAME` y
`ADMIN_PASSWORD`) — ese archivo solo existe en tu PC y nunca se sube al repo.

## Backend (API)
`http://127.0.0.1:8000` (o `http://0.0.0.0:8000` si se expone para el emulador/celular vía `10.0.2.2`)

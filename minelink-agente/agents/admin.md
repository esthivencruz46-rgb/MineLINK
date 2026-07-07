# Agente: Admin — Panel de Esthiven

## Rol
Construyes el panel privado donde Esthiven (único admin) gestiona
empresas y revisa leads. Es parte del frontend React pero con reglas
propias: aquí la eficiencia importa más que la simpleza — Esthiven es
usuario técnico.

## Skill asociada
`skills/admin-panel/SKILL.md`

## Rutas (todas bajo /admin, protegidas)

| Ruta | Contenido |
|---|---|
| /admin/login | Usuario + contraseña → JWT guardado en memoria (no localStorage) |
| /admin | Dashboard: leads de hoy, total diagnósticos, score promedio, brechas más comunes (top 5) |
| /admin/empresas | Tabla CRUD: crear, editar, desactivar empresas. Checkboxes para estudios[] (catálogo de criterios_score.md) y regiones[] |
| /admin/leads | Tabla de leads: nombre, WhatsApp (link directo wa.me), región, score, brechas, código REINFO si dejó. Filtros por fecha y región. Botón exportar CSV. Cada brecha se puede marcar/desmarcar como "resuelta" (seguimiento manual, ver más abajo) |

## Reglas técnicas
- JWT en memoria (useState/context), NUNCA en localStorage — si recarga,
  vuelve a loguearse; es un solo usuario, no es fricción real
- Toda ruta /admin/* redirige a /admin/login si no hay token válido
- El formulario de empresa valida: RUC 11 dígitos, WhatsApp formato
  +51, al menos 1 estudio y 1 región marcados
- Desactivar empresa (activa=false), nunca borrar: los leads históricos
  pueden referenciarla
- Export CSV con encoding UTF-8 BOM (para que Excel en Windows lea tildes)

## Seguimiento de brechas resueltas (sin rehacer el cuestionario)
Cuando Esthiven se entera (por WhatsApp) de que un minero ya resolvió
1 o 2 de sus brechas, NO debe hacerlo repetir todo el diagnóstico. En
`/admin/leads` puede marcar esas brechas puntuales como "resueltas":
- `PUT /admin/operaciones/{id}/brechas-resueltas` recalcula
  `score_actual`/`bloqueado_actual`/`brechas_pendientes` a partir de
  `respuestas_json` + la lista de resueltas, usando la misma lógica de
  `scoring.calcular_diagnostico` (nunca se duplica el cálculo de puntos)
- Esto es una capa de SEGUIMIENTO aparte, no una edición del diagnóstico
  original (ver regla de abajo). `score_total`/`brechas`/`bloqueado`
  (la declaración original) nunca cambian; lo que se actualiza es
  `score_actual`/`brechas_pendientes`/`bloqueado_actual`
- El dashboard (top 5 brechas) cuenta brechas PENDIENTES, no las ya
  resueltas — así refleja qué necesita reclutar Esthiven ahora

## Lo que este panel NUNCA hace
- Editar `respuestas_json`, `brechas_json`, `score_total` o `bloqueado`
  de un diagnóstico (son la declaración original del minero,
  inmutable). Marcar brechas como "resueltas" no es editar la
  declaración: es una capa de seguimiento aparte, ver arriba
- Enviar mensajes automáticos a leads (Esthiven escribe personalmente
  por WhatsApp — la confianza es el producto)

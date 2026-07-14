# Agente: Admin — Panel de Esthiven

## Rol
Construyes el panel privado donde Esthiven (único admin) gestiona
empresas, revisa leads con sus perfiles/semáforos/alertas del Módulo INV
e intermedia entre mineros, empresas e inversionistas. Es parte del
frontend React pero con reglas propias: aquí la eficiencia importa más
que la simpleza — Esthiven es usuario técnico.

## Skill asociada
`skills/admin-panel/SKILL.md`

## Rutas (todas bajo /admin, protegidas)

| Ruta | Contenido |
|---|---|
| /admin/login | Usuario + contraseña → JWT guardado en memoria (no localStorage) |
| /admin | Dashboard: leads/diagnósticos de hoy y total, top 5 brechas pendientes, últimos leads |
| /admin/empresas | Tabla CRUD + import CSV; vista por bloques de dimensión con rating/reseñas (solo visibles aquí) |
| /admin/leads | Tabla de leads: contacto (wa.me), perfil A/B/C/D, semáforos, brechas expandibles, código REINFO. Botones por fila: Documentos (solo lectura), Inversión (respuestas + alertas AL1-AL10), Empresas/Intereses (para intermediar), reseteo de contraseña |

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
- El minero se AUTO-resuelve subiendo el respaldo (flujo principal desde
  julio 2026). El marcado manual del admin
  (`PUT /admin/operaciones/{id}/brechas-resueltas`) queda para casos sin
  foto — y NO genera el ✓ público (eso exige foto).
- `estado_seguimiento` recalcula el estado vigente parchando respuestas;
  la declaración original (`respuestas_json`, `brechas_json`) es
  inmutable — el seguimiento es una capa aparte.
- El dashboard cuenta brechas PENDIENTES, no resueltas.

## Lo que este panel NUNCA hace
- Aprobar/rechazar documentos (se ELIMINÓ julio 2026 — la publicación es
  automática al enviar; no reintroducir sin decisión del dueño)
- Editar la declaración original del minero
- Enviar mensajes automáticos a leads (Esthiven escribe personalmente
  por WhatsApp — la confianza es el producto)
- Exponer contactos fuera del panel ni archivos privados fuera de él

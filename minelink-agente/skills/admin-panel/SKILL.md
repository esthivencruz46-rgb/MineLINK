---
name: admin-panel
description: Usa esta skill al construir o modificar el panel de
  administración de Esthiven - CRUD de empresas, tabla de leads,
  revisión de documentos e inversión, métricas del dashboard.
---

# Skill: Admin Panel

## Dashboard /admin
- Diagnósticos de hoy / total histórico (+ iniciados, del embudo de eventos)
- Leads de hoy / total
- Top 5 brechas PENDIENTES más comunes (con conteo) ← le dice a Esthiven
  qué tipo de empresas le conviene reclutar
- Últimos 10 leads
- ⚠️ Legacy conocido: `score_promedio` todavía promedia el `score_total`
  del modelo viejo (0 en filas nuevas) — pendiente reemplazarlo por
  madurez promedio / conteo por perfil y semáforo. No basar nada nuevo en
  ese campo.

## Tabla de leads (/admin/leads)
Columnas: fecha · nombre · WhatsApp (link wa.me clickeable — el admin SÍ
ve contactos) · región · perfil del pipeline (A/B/C/D) · semáforos ·
brechas (expandible) · código REINFO (con link a pad.minem.gob.pe para
verificación manual).

Botones por fila:
- **Documentos**: modal de SOLO LECTURA con los archivos subidos —
  Aprobar/Rechazar se ELIMINÓ (julio 2026): la publicación es automática
  al enviar, los inversionistas verifican por sí mismos. No reintroducir
  flujos de aprobación sin decisión explícita del dueño.
- **Inversión**: respuestas del Módulo INV + alertas AL1-AL10 activas
  (informativas — describen inconsistencias como "declara ventas sin
  liquidaciones" o "adelantos de compradores", nunca bloquean).
- **Empresas** / **Intereses**: los interesados (mineros→empresas,
  inversionistas→proyecto) para que Esthiven intermedie por WhatsApp.
- Expandir brechas: "Marcar como resuelta"
  (`PUT /admin/operaciones/{id}/brechas-resueltas`) — capa de SEGUIMIENTO,
  nunca edita la declaración original. Ojo: hoy el minero también se
  auto-resuelve subiendo respaldo; el marcado manual del admin queda para
  casos sin foto (y NO genera ✓ público — eso exige foto).

## Formulario de empresa
Campos: nombre* · RUC* (11 dígitos) · WhatsApp* (+51...) · email ·
rating 0-5 y nº de reseñas (solo visibles en admin; ordenan /empresas sin
mostrarse) · regiones* (checkboxes) · estudios* (checkboxes agrupados por
dimensión — catálogo completo, incluidos legacy: una empresa vieja puede
tenerlos) · activa (toggle). Import masivo por CSV
(`POST /admin/empresas/importar`). Desactivar, nunca borrar.

## Flujo de trabajo de Esthiven (para diseñar la UX)
Cada mañana: abre /admin → ve leads nuevos y sus alertas INV → contacta
por WhatsApp → revisa intereses de inversionistas/empresas y conecta a
las partes → según las brechas más comunes decide qué empresas reclutar.
El panel debe hacer ese ciclo en el menor número de clics posible.

## Seguridad
- Todas las llamadas /admin/* con header Authorization: Bearer {jwt}
- Si el backend responde 401 → limpiar token y redirigir a /admin/login
- JWT en memoria (no localStorage); un solo usuario, credenciales en
  variables de entorno del backend

## Lo que este panel NUNCA hace
- Editar `respuestas_json`, `inv_respuestas_json` o `brechas_json` (la
  declaración original del minero es inmutable)
- Enviar mensajes automáticos a leads (Esthiven escribe personalmente —
  la confianza es el producto)
- Exponer los archivos privados (liquidaciones, financieros, fotos de
  trabajadores) fuera del propio panel

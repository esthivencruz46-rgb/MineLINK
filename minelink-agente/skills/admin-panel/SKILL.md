---
name: admin-panel
description: Usa esta skill al construir o modificar el panel de
  administración de Esthiven - CRUD de empresas, tabla de leads,
  métricas del dashboard.
---

# Skill: Admin Panel

## Dashboard /admin — 4 métricas + 1 lista
- Diagnósticos de hoy / total histórico
- Leads de hoy / total
- Score promedio de todos los diagnósticos
- Top 5 brechas más comunes (con conteo) ← esto le dice a Esthiven qué
  tipo de empresas le conviene reclutar
- Últimos 10 leads (nombre, región, score, hora)

## Formulario de empresa
Campos: nombre* · RUC* (11 dígitos) · años de servicio* (número) ·
WhatsApp* (+51...) · email · regiones* (checkboxes de departamentos) ·
estudios* (checkboxes agrupados por dimensión, usando el catálogo de
context/criterios_score.md con sus textos simples) · activa (toggle)

Validación en el cliente Y en el backend. Errores en español bajo cada
campo.

## Tabla de leads
Columnas: fecha · nombre · WhatsApp (link wa.me clickeable) · región ·
score (con color del semáforo) · nº brechas (expandible para ver cuáles)
· código REINFO (si dejó; con link a pad.minem.gob.pe para verificar
manualmente)

- Filtros: rango de fechas, región, score (bloqueado/rojo/ámbar/verde)
- Orden default: más reciente primero
- Botón "Exportar CSV" (UTF-8 con BOM)
- Al expandir las brechas de un lead: cada una tiene un checkbox/botón
  "Marcar como resuelta" (llama a `PUT /admin/operaciones/{id}/brechas-resueltas`).
  Esto NO reabre el cuestionario del minero — es seguimiento manual de
  Esthiven cuando se entera por WhatsApp de que ya resolvió algo. Mostrar
  `score_actual` junto al `score_total` original cuando difieran

## Flujo de trabajo de Esthiven (para diseñar la UX)
Cada mañana: abre /admin → ve leads nuevos → los contacta por WhatsApp
uno por uno → según las brechas más comunes del dashboard, decide qué
empresas nuevas buscar y cargar. El panel debe hacer ese ciclo en el
menor número de clics posible.

## Seguridad
- Todas las llamadas /admin/* con header Authorization: Bearer {jwt}
- Si el backend responde 401 → limpiar token y redirigir a /admin/login
- No hay recuperación de contraseña en MVP (un solo usuario, credencial
  en variable de entorno del backend)

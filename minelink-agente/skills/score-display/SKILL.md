---
name: score-display
description: Usa esta skill al crear o modificar componentes visuales del
  resultado del diagnóstico - semáforos, Índice de Madurez, scores por
  track, checklists y lista de brechas (páginas /resultado, /mi-cuenta,
  /mi-concesion, /proyectos y ficha pública).
---

# Skill: Score Display (modelo A/B/C/D, julio 2026)

## Qué se muestra (y qué NO)

El resultado son DOS semáforos independientes + checklist de la etapa —
NUNCA un puntaje único tipo MineScore. Los scores 0-100 por track existen
pero son un COMPLEMENTO comparativo (cartera y cuenta), no el titular del
resultado del diagnóstico.

| Elemento | Dónde | Regla visual |
|---|---|---|
| Semáforo legal | Resultado, cuenta, ficha, tarjeta de cartera | Color por CONDICIÓN (rojo=bloqueante activo). Texto del track por perfil (ej. "REINFO vigente · 5/7 documentos") |
| Semáforo técnico + Madurez 0-5 | Resultado, ficha (panel lateral) | 5 segmentos rellenos; None = "Aún sin operación que medir" (nunca rojo castigador, típico en perfil A / INV en pausa) |
| Scores 0-100 por track | Cuenta (badges junto a los títulos de columna), tarjeta de cartera (chips), ficha (panel lateral) | Umbrales de color COMPARTIDOS: ≥70 emerald, ≥40 amber, resto red. Formato "N/100" o chip "Etiqueta N". Nunca decimales |
| Checklist de la etapa | Resultado, ficha | SOLO estudios aplicables al perfil (`estudios_aplicables`) — jamás el catálogo completo. Con foto → tarjeta grande de documento; sin foto → chip discreto |
| ✓ verificado | Ficha pública, cartera | Solo con foto de respaldo subida (`brechas_verificadas`, `ventas_verificadas`) — lo declarado sin foto se dice explícitamente ("Declarada, sin respaldo aún") |

## Semáforo (colores canónicos)

`utils/semaforo.ts` → `semaforoDesdeColor(color)` devuelve las clases;
verde emerald-500 · amarillo amber-500 · rojo red-500. No inventar
variantes por página.

## Lista de brechas ("Lo que te falta")

- UNA sola tarjeta unificada con subsecciones Formalización / Inversión
  (`LoQueTeFaltaCard.tsx`); los ítems "En proceso" van DENTRO de su
  subsección con chip ámbar, nunca como sección aparte.
- Cada brecha: texto simple + "¿Quién me ayuda?" (empresas por estudio) +
  "Ya lo tengo — subir respaldo" (los en-proceso solo tienen la subida).
- Los textos simples de cada estudio viven en
  `frontend/src/data/brechas.ts` (`INFO_BRECHA`) — NO duplicar la tabla
  aquí ni en otros docs; agregar el estudio nuevo ahí.
- Orden: primero lo legal/bloqueante, luego el resto.

## Reglas
- Nunca decimales en scores ni en madurez.
- Un dato ausente se omite (sin "N/A" ni recuadros vacíos) — los huecos
  visuales fueron motivo de rediseño explícito del dueño.
- Los semáforos mandan sobre los scores: en cualquier orden/listado, un
  proyecto verde va antes que uno amarillo aunque tenga menos score.
- Textos siempre en lenguaje simple (perfil_usuario.md); siglas con su
  aclaración la primera vez.

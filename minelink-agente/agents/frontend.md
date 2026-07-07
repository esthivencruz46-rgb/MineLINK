# Agente: Frontend — React + TypeScript

## Rol
Construyes la interfaz que ve el minero: cuestionario, resultados con
score y brechas, y directorio de empresas recomendadas. Todo el lenguaje
visible sigue las reglas de `context/perfil_usuario.md` — SIN EXCEPCIÓN.

## Skills asociadas
- `skills/score-display/SKILL.md` → para todo lo visual del score
- `skills/empresa-card/SKILL.md` → para tarjetas y filtros de empresas

## Stack
React 18 · TypeScript strict (prohibido any) · Tailwind CSS · Vite ·
React Router · tema oscuro/claro con toggle (oscuro por defecto).

## Paleta (definir como variables Tailwind en index.css)
```
Oscuro: fondo #0f1923 · tarjeta #1a2332 · acento #0e7c66 (verde mineral)
        · secundario #b4552d (cobre) · texto #f0f4f8 / #8899aa
Claro:  fondo #f4f6f8 · tarjeta #ffffff · mismos acentos
        · texto #1a2332 / #4a5568
Semáforo: verde emerald-500 · ámbar amber-500 · rojo red-500
```

## Páginas (React Router)

| Ruta | Página | Contenido |
|---|---|---|
| / | Inicio | Propuesta: "Descubre gratis qué te falta para formalizarte". Botón grande "Empezar mi diagnóstico". Sin registro. |
| /diagnostico | Cuestionario | Wizard de 22 preguntas en 5 bloques. Barra de progreso. Una pregunta por pantalla en móvil. Botones SÍ / NO / No sé (No sé = NO para el score). |
| /resultado | Resultado | Score con semáforo, barras por dimensión, lista de brechas en lenguaje simple, botón "Ver quién me puede ayudar". Campo opcional REINFO. |
| /empresas | Directorio | Tarjetas de empresas filtradas por las brechas del diagnóstico. Filtro manual adicional por región y tipo de estudio. |
| /gracias | Cierre | Tras dejar contacto: "Te escribiremos por WhatsApp". |

## Flujo de datos
1. /diagnostico guarda respuestas en estado local (useState en wizard)
2. Al terminar → POST /diagnostico → guarda respuesta en sessionStorage
   (NO localStorage) → navega a /resultado
3. /resultado lee de sessionStorage; si está vacío redirige a /
4. "Ver quién me puede ayudar" → GET /empresas con las brechas → /empresas
5. Modal de contacto (nombre + WhatsApp) → POST /leads → /gracias

## Reglas técnicas
- Interfaces TypeScript en src/types/ espejando los schemas del backend
- services/api.ts centraliza TODOS los fetch con base URL configurable
  y fallback a datos DEMO si el backend no responde (marcados // DEMO)
- Mobile-first: el minero usa celular; probar cada vista a 360px
- Botones táctiles mínimo 44px de alto
- Textos del cuestionario: copiar EXACTAMENTE de context/criterios_score.md
- Cada sigla con tooltip/nota: tomar las aclaraciones de perfil_usuario.md
- Sin librerías de estado (Redux/Zustand): useState + props alcanza

## Definición de terminado
1. npm run build pasa sin errores ni warnings de TypeScript
2. La vista funciona a 360px y a 1280px
3. Probaste el flujo completo contra el backend real corriendo

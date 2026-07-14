# Agente: Frontend — React + TypeScript

## Rol
Construyes la interfaz que ven el minero y el inversionista: wizard del
diagnóstico, cuentas del minero, cartera y ficha pública de proyectos,
directorio de empresas. Todo el lenguaje visible sigue las reglas de
`context/perfil_usuario.md` — SIN EXCEPCIÓN.

## Skills asociadas
- `skills/score-display/SKILL.md` → semáforos, madurez, scores, brechas
- `skills/empresa-card/SKILL.md` → tarjetas/filtros de empresas y postulación

## Stack
React 18 · TypeScript strict (prohibido any) · Tailwind CSS · Vite ·
React Router · tema oscuro/claro con toggle (oscuro por defecto) ·
Capacitor 6 para la app Android (misma UI).

## Paleta (variables Tailwind en index.css)
```
Oscuro: fondo #0f1923 · tarjeta #1a2332 · acento #0e7c66 (verde mineral)
        · secundario #b4552d (cobre) · texto #f0f4f8 / #8899aa
Claro:  fondo #f4f6f8 · tarjeta #ffffff · mismos acentos
        · texto #1a2332 / #4a5568
Semáforo: verde emerald-500 · ámbar amber-500 · rojo red-500
Scores 0-100: ≥70 emerald · ≥40 amber · resto red (umbrales compartidos)
```

## Superficies principales (rutas completas en RUTAS.md)
- **/** Inicio → botón "Empezar mi diagnóstico", sin registro.
- **/diagnostico** Wizard del modelo A/B/C/D (`Cuestionario.tsx` +
  `data/preguntas.ts`): REGLA DURA anti-bug — único estado = `respuestas`
  + paso actual; las pantallas aplicables se DERIVAN en cada render
  (nunca aritmética de saltos guardada). Tarjeta de tamaño FIJO
  (min-h, footer anclado, sin scroll interno), botones Volver Y
  Continuar siempre presentes; un clic en opción única también avanza.
  SIN RUTA → página informativa sin POST.
- **/resultado** Dos semáforos + checklist de la etapa + brechas.
- **/mi-cuenta** (C/D) y **/mi-concesion** (A/B): tira "Tus datos" +
  columna Formalización (archivos con fechas/datos estructurados,
  "Lo que te falta" unificado, ubicación al final) | columna Inversión
  (wizard INV en modal, "Tu perfil de inversión", respaldos). Autosave
  con debounce (~800ms) por campo; botón verde "Guardar" del header
  remonta con `key={recarga}`. Campanita de notificaciones.
- **/proyectos** cartera + **/proyectos/:id** ficha pública (mosaico
  satelital + fotos, tarjetas grandes de documento, oportunidad de
  inversión, GEOCATMIN, PDF descargable).
- **/empresas**, **/postular**, cuentas de inversionista, /admin.

## Flujo de datos
1. Wizard guarda respuestas en estado local → POST al terminar →
   sessionStorage (NO localStorage) → /resultado (vacío → redirige a /).
2. `services/api.ts` centraliza TODOS los fetch (base URL configurable).
3. Los catálogos de `data/` son ESPEJOS del backend: cambiar ids de
   preguntas toca ambos lados o el POST devuelve 422.
4. Campos nuevos del backend siempre con default defensivo (`?? []`,
   `?.`) — el frontend puede desplegarse antes/después que el backend
   (deploy-skew ya rompió la cuenta una vez).

## Reglas técnicas
- Interfaces TypeScript en src/types/ espejando los schemas del backend
- Mobile-first: el minero usa celular; probar cada vista a 360px
- Botones táctiles mínimo 44px de alto
- Cada sigla con su aclaración (perfil_usuario.md)
- Sin librerías de estado (Redux/Zustand): useState + props alcanza
- `data/preguntasPerfil.ts` y `perfilInformativo.ts` están ⏸️ EN PAUSA —
  no borrar, no importar en código nuevo

## Definición de terminado
1. npm run build pasa sin errores ni warnings de TypeScript
2. La vista funciona a 360px y a 1280px
3. Probaste el flujo completo contra el backend real corriendo

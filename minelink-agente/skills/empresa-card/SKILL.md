---
name: empresa-card
description: Usa esta skill al crear o modificar las tarjetas de empresas
  recomendadas, sus filtros o el formulario de postulación de consultores.
  Página /empresas y /postular del frontend.
---

# Skill: Empresa Card

## Tarjeta de empresa (datos que se muestran)
1. Nombre de la empresa (título)
2. RUC (font-mono, pequeño, da confianza de que es real)
3. Años de servicio ("12 años en el rubro") — se OCULTA si es 0 (los
   consultores nuevos ya no declaran años)
4. Badge destacado: "Resuelve N de tus M pendientes" (N = coincidencias
   con las brechas del minero — viene del recomendador)
5. Chips de los estudios que hace, con los que coinciden con las brechas
   del minero PRIMERO y en color acento
6. Regiones donde trabaja

## Contacto: intermediación, NUNCA WhatsApp directo (julio 2026)
El WhatsApp de la empresa NO es público. El botón es **"Me interesa"** →
modal con nombre + WhatsApp del minero → `POST /empresas/{id}/interes`
(crea `InteresEmpresa`, sin cuenta). Esthiven lo ve en /admin → Leads →
"Empresas" y conecta a las partes con su propio WhatsApp. No construir
enlaces wa.me hacia empresas en ninguna vista pública.

## Orden de las tarjetas
El que entrega el backend (coincidencias desc; el rating 0-5 ordena
internamente los bloques Empresas/Consultores de mejor a peor SIN
mostrarse — solo el admin ve el rating). NO reordenar en el frontend.

## Formulario de postulación de consultores (/postular)
- 2 columnas en desktop (`max-w-4xl grid md:grid-cols-2`), email
  OBLIGATORIO (validado), SIN campo de años de experiencia.
- "¿En qué me puedes ayudar?" ofrece SOLO estudios que una pregunta
  actual puede generar (`ESTUDIOS_CON_PREGUNTA` /
  `ESTUDIOS_POR_DIMENSION_CON_PREGUNTA`), agrupados en bloques por
  dimensión; una dimensión sin estudios vigentes se omite. Los estudios
  legacy (sctr, iperc, geomecánica...) siguen siendo tags válidos en
  empresas YA cargadas, pero no se ofrecen a postulantes nuevos.
- Un CIP (colegiatura) es único: postularse dos veces con el mismo → 409.

## Filtros (barra superior)
- Región (select con los departamentos presentes en las empresas)
- Tipo de estudio (multi-select con textos simples de `data/brechas.ts`)
- Los filtros re-consultan GET /empresas, no filtran en cliente

## Estados especiales
- Sin empresas para esas brechas/región: mensaje honesto "Aún no tenemos
  empresas registradas para esto en tu región"
- Backend caído: mostrar empresas DEMO marcadas visualmente como ejemplo

## Regla de confianza
NUNCA inventar empresas, testimonios ni calificaciones. Si no hay
rating real, no mostrar estrellas. La credibilidad de Esthiven es el
producto: una empresa falsa lo destruye todo.

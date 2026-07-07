---
name: empresa-card
description: Usa esta skill al crear o modificar las tarjetas de empresas
  recomendadas y sus filtros. Página /empresas del frontend.
---

# Skill: Empresa Card

## Tarjeta de empresa (datos que se muestran)
1. Nombre de la empresa (título)
2. RUC (font-mono, pequeño, da confianza de que es real)
3. Años de servicio: "12 años en el rubro"
4. Badge destacado: "Resuelve N de tus M pendientes" (N = coincidencias
   con las brechas del minero — viene del recomendador)
5. Chips de los estudios que hace, con los que coinciden con las brechas
   del minero PRIMERO y en color acento
6. Regiones donde trabaja
7. Botón principal: "Escribir por WhatsApp" → wa.me/{numero}?text={msg}

## Mensaje prellenado de WhatsApp
"Hola, vengo de MineLink. Mi diagnóstico dice que necesito: {lista de
brechas coincidentes en texto simple}. ¿Me pueden orientar?"
(URL-encodear correctamente; usar los textos simples de score-display)

## Orden de las tarjetas
El que entrega el backend (coincidencias desc, años desc). NO reordenar
en el frontend.

## Filtros (barra superior)
- Región (select con los departamentos presentes en las empresas)
- Tipo de estudio (multi-select con textos simples)
- Los filtros re-consultan GET /empresas, no filtran en cliente

## Estados especiales
- Sin empresas para esas brechas/región: mensaje honesto "Aún no tenemos
  empresas registradas para esto en tu región" + botón "Avísenme cuando
  haya" (abre el modal de contacto → POST /leads)
- Backend caído: mostrar empresas DEMO marcadas visualmente como ejemplo

## Regla de confianza
NUNCA inventar empresas, testimonios ni calificaciones. Si no hay
rating real, no mostrar estrellas. La credibilidad de Esthiven es el
producto: una empresa falsa lo destruye todo.

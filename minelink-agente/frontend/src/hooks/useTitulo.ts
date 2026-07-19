import { useEffect } from "react";
import { MARCA } from "../config/marca";

/** Título de la pestaña por página (julio 2026) — antes todas las rutas
 *  compartían el mismo título del index.html, así que con varias pestañas
 *  abiertas no se distinguían y Google indexaba peor las internas. */
export function useTitulo(titulo?: string) {
  useEffect(() => {
    const base = `${MARCA} — Formaliza tu minería y conecta con inversionistas`;
    document.title = titulo ? `${titulo} · ${MARCA}` : base;
    // Al desmontar no se restaura a propósito: la siguiente página define
    // el suyo y la portada vuelve a la base con useTitulo() sin argumento.
  }, [titulo]);
}

/** ÚNICA fuente de verdad del nombre de la marca (julio 2026, pedido de
 *  Esthiven tras renombrar MineLink → Qorilink: "que si modifico el nombre
 *  se modifique todo"). Para renombrar la plataforma otra vez, cambiar SOLO
 *  esta línea y recompilar. Excepciones que igual hay que tocar a mano
 *  (no pueden leer esta constante):
 *  - frontend/index.html (título y metas og: — HTML estático)
 *  - la documentación .md del repo
 *  - los nombres técnicos NO se tocan nunca (URLs de hosting, appId de
 *    Android, claves de localStorage, bucket/BD) — romperían la app. */
export const MARCA = "Qorilink";

/** Inserta separador de miles (250000 → 250,000) en cualquier texto que
 * contenga números sueltos de 4+ dígitos — montos de dinero, toneladas,
 * etc. Es idempotente: un número que ya viene con comas ("50,000") no se
 * vuelve a tocar porque la coma corta la racha de dígitos consecutivos.
 * Útil porque estos valores viajan como texto libre compuesto (ej.
 * "S/ 250000" o "USD 20000 - 1000000"), no como number, así que no se
 * pueden formatear con Intl.NumberFormat directamente. */
export function formatearMonto(texto?: string | null): string {
  if (!texto) return "";
  return texto.replace(/\d{4,}/g, (grupo) => Number(grupo).toLocaleString("es-PE"));
}

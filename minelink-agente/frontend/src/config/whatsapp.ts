// Número de WhatsApp del equipo MineLink (Esthiven, admin) — a donde el
// minero envía su resultado para recibir orientación. Sin "+", formato wa.me.
export const WHATSAPP_ADMIN = "51925512036";

/** Arma un enlace wa.me con mensaje prellenado. `numero` sin "+" (ej. 51987654321). */
export function enlaceWhatsApp(numero: string, mensaje: string): string {
  return `https://wa.me/${numero.replace(/\D/g, "")}?text=${encodeURIComponent(mensaje)}`;
}

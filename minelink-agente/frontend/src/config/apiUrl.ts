import { Capacitor } from "@capacitor/core";

// Detecta en tiempo de ejecución si la app corre como app nativa (Android/iOS vía
// Capacitor) o como página web normal, y usa la URL de backend correcta para cada caso.
// Así ambos entornos funcionan a la vez, sin tener que editar el .env manualmente.
const URL_WEB = (import.meta.env.VITE_API_URL_WEB as string | undefined) ?? "http://127.0.0.1:8000";
const URL_NATIVA =
  (import.meta.env.VITE_API_URL_NATIVE as string | undefined) ?? "http://10.0.2.2:8000";

export const BASE_URL = Capacitor.isNativePlatform() ? URL_NATIVA : URL_WEB;

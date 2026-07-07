import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.minelink.app",
  appName: "MineLink",
  webDir: "dist",
  // http en vez de https: el backend local (10.0.2.2:8000) solo habla HTTP
  // en desarrollo, y una página https:// no puede pedir recursos http://
  // (Mixed Content). Cuando el backend tenga dominio con HTTPS real,
  // quitar esto para volver al valor por defecto (https).
  server: {
    androidScheme: "http",
  },
};

export default config;

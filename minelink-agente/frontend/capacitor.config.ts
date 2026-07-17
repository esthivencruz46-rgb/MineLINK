import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.minelink.app",
  appName: "Qorilink",
  webDir: "dist",
  // El backend de producción (Render) tiene HTTPS real, así que se usa el
  // esquema https por defecto de Capacitor. Si algún día se prueba contra
  // un backend HTTP local, volver a poner: server: { androidScheme: "http" }
  // (y usesCleartextTraffic en AndroidManifest.xml) — ver errores_aprendidos.md.
};

export default config;

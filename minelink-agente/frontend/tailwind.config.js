/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      colors: {
        // Paleta refinada para un tono más institucional/inversor: verde
        // profundo (formalización/confianza) + bronce mate como acento
        // secundario (en vez del naranja-tierra anterior, más "obra").
        fondo: { DEFAULT: "#f6f7f9", dark: "#0b1420" },
        tarjeta: { DEFAULT: "#ffffff", dark: "#141f2e" },
        acento: "#0c6b58",
        "acento-profundo": "#083a30",
        secundario: "#a8752e",
        // Versión más clara del bronce, solo para texto/acentos SOBRE
        // fondos oscuros (ej. el hero de Inicio) — el bronce normal
        // (secundario) pierde contraste ahí.
        "secundario-claro": "#d4a350",
        texto: { DEFAULT: "#111827", dark: "#eef2f6" },
        "texto-suave": { DEFAULT: "#4b5566", dark: "#93a2b3" },
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        fondo: { DEFAULT: "#f4f6f8", dark: "#0f1923" },
        tarjeta: { DEFAULT: "#ffffff", dark: "#1a2332" },
        acento: "#0e7c66",
        secundario: "#b4552d",
        texto: { DEFAULT: "#1a2332", dark: "#f0f4f8" },
        "texto-suave": { DEFAULT: "#4a5568", dark: "#8899aa" },
      },
    },
  },
  plugins: [],
};

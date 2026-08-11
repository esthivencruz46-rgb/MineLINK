import { Capacitor } from "@capacitor/core";
import { useTitulo } from "../hooks/useTitulo";
import { MARCA } from "../config/marca";
import { Link, useNavigate } from "react-router-dom";
import { Reveal } from "../components/Reveal";
import { Briefcase, Check, Download, Pickaxe, Wrench, type LucideIcon } from "lucide-react";

interface TarjetaPerfil {
  Icono: LucideIcon;
  titulo: string;
  descripcion: string;
  accion: string;
  ruta: string;
  destacada?: boolean;
  sesion?: { texto: string; ruta: string };
}

const PERFILES: TarjetaPerfil[] = [
  {
    Icono: Pickaxe,
    titulo: "Soy minero",
    descripcion: "Descubre gratis qué te falta para formalizarte.",
    accion: "Empezar mi diagnóstico",
    ruta: "/diagnostico",
    destacada: true,
    sesion: { texto: "Ya tengo mi cuenta", ruta: "/ingresar" },
  },
  {
    Icono: Briefcase,
    titulo: "Inversionistas y curiosos",
    descripcion: "Explora operaciones mineras verificadas con REINFO.",
    accion: "Ver proyectos mineros",
    ruta: "/proyectos",
    sesion: { texto: "Ya dejé mi interés antes", ruta: "/ingresar-inversionista" },
  },
  {
    Icono: Wrench,
    titulo: "Soy consultor o empresa",
    descripcion: "Conecta con mineros que necesitan tus servicios.",
    accion: "Postular mis servicios",
    ruta: "/postular",
  },
];

const CONFIANZA = [
  "100% gratis para mineros",
  "Sin tramitadores de por medio",
  "Tu contacto nunca se muestra públicamente",
];

// agosto 2026, quinto pase: el usuario pidió "elimina los patrones y
// déjame el color verde" — se quitó el patrón de líneas topográficas
// SVG del hero (dejó de usarse tanto aquí como en HeroFranja) y el
// fondo queda como el degradado verde institucional limpio, con las
// siluetas de montañas + luz aurora + barrido que siguen en pie.
//
// julio 2026, cuarto pase (pedido explícito: "algo que me diera ganas
// de entrar" — la portada se sentía plana). El hero pasó de un bloque
// de texto centrado sobre gris a un panel a todo el ancho con
// degradado verde institucional + entrada animada sutil (motion-safe:
// de Tailwind, se desactiva sola si el visitante tiene reduced-motion).
// El resto de la estructura (grilla de 3 tarjetas, bloque de APK,
// insignias de confianza) se mantiene: solo se les suma una interacción
// más viva al pasar el mouse, sin salir de la línea institucional
// (bordes finos, sin sombras, colores semánticos donde corresponde).
//
// Tercer pase previo (pedido explícito: "se parece mucho a ¿Cómo
// funciona?, debe ser más simplista, menos letra... más vistoso") —
// Inicio y ComoFunciona.tsx compartían la misma estructura (lista de
// filas con borde, un párrafo de descripción por perfil): entrar a
// "¿Cómo funciona?" se sentía como leer la misma página dos veces, solo
// que más larga. Ahora son estructuralmente distintas: Inicio es una
// grilla de 3 tarjetas grandes y escaneables con una frase corta cada una
// (el elegí-tu-camino rápido); ComoFunciona sigue siendo la lista
// numerada y detallada para quien quiere leer el paso a paso completo.
// Insignias circulares con tinte de color (mismo patrón ya usado en
// InteresInversionModal/NoEncontrada/ResumenInversionRespuestas —
// `rounded-full bg-{color}/10 text-{color}`) en vez de un ícono plano
// junto al texto, para que cada tarjeta tenga más presencia visual sin
// añadir una sola palabra más.
export function Inicio() {
  useTitulo();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center">
      <section className="relative w-full overflow-hidden bg-gradient-to-br from-acento via-acento to-acento-profundo text-white">
        {/* Luz "aurora" que respira y migra detrás del título (agosto 2026):
            dos resplandores (blanco + bronce de marca) en movimiento lento
            — le da profundidad al verde plano sin romper la línea. */}
        <div className="punta-luz" aria-hidden="true" />

        {/* Barrido de luz diagonal que cruza el hero cada ~10s */}
        <div className="barrido-hero" aria-hidden="true" />

        {/* Siluetas de montañas andinas al pie — la esencia del minero.
            Tres capas: atrás clara (bruma), frente oscura que se funde con
            el fondo del degradado (acento-profundo). */}
        <svg
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full md:h-48"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0 320 L0 150 Q70 85 140 145 Q210 90 280 155 Q350 95 420 165 Q490 105 560 170 Q630 115 700 175 Q770 125 840 180 Q910 135 980 185 Q1050 145 1120 190 Q1190 155 1260 195 Q1330 165 1440 185 L1440 320 Z"
            fill="#0f5f4a"
            opacity="0.5"
          />
          <path
            d="M0 320 L0 210 Q90 150 180 205 Q270 145 360 210 Q450 155 540 215 Q630 165 720 220 Q810 175 900 225 Q990 185 1080 230 Q1170 195 1260 235 Q1350 205 1440 220 L1440 320 Z"
            fill="#0b4636"
          />
          <path
            d="M0 320 L0 255 Q120 205 240 250 Q360 200 480 255 Q600 210 720 260 Q840 215 960 265 Q1080 225 1200 270 Q1320 235 1440 275 L1440 320 Z"
            fill="#083a30"
          />
        </svg>

        <div className="relative z-10 mx-auto max-w-2xl px-4 pb-28 pt-16 text-center md:pb-48 md:pt-24">
          <p className="motion-safe:animate-[hero-entrada_0.7s_ease-out_both] text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
            Formalización minera artesanal · Perú
          </p>
          <h1 className="motion-safe:animate-[hero-entrada_0.7s_ease-out_0.1s_both] mx-auto mt-5 max-w-xl text-4xl font-semibold leading-[1.1] tracking-tight md:text-6xl">
            Formaliza tu minería.
            <br />
            <span className="text-secundario-claro">Conecta con inversionistas.</span>
          </h1>
          <p className="motion-safe:animate-[hero-entrada_0.7s_ease-out_0.2s_both] mx-auto mt-6 max-w-sm text-base text-white/80">
            Diagnóstico gratuito, proyectos verificados, clientes reales.
          </p>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-12 md:py-16">
        <div className="relative grid grid-cols-1 gap-4 md:grid-cols-3">
          <div
            className="pointer-events-none absolute -inset-x-8 -inset-y-10 -z-10 bg-[radial-gradient(ellipse_at_top,_theme(colors.acento/0.07),_transparent_65%)]"
            aria-hidden="true"
          />
          {PERFILES.map((p, i) => (
            <Reveal key={p.titulo} retraso={i * 100}>
            <div
              className={`group flex flex-col items-start gap-3 border p-6 transition duration-200 hover:-translate-y-1 ${
                p.destacada
                  ? "border-acento/30 bg-acento/[0.04] hover:border-acento/50 hover:shadow-[0_8px_24px_-12px_theme(colors.acento/0.5)]"
                  : "border-black/10 hover:border-acento/30 dark:border-white/10 dark:hover:border-acento/40"
              }`}
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-105 ${
                  p.destacada ? "bg-acento text-white" : "bg-acento/10 text-acento"
                }`}
              >
                <p.Icono size={22} strokeWidth={1.75} aria-hidden />
              </div>
              <h2 className="text-lg font-semibold">{p.titulo}</h2>
              <p className="text-sm text-texto-suave dark:text-texto-suave-dark">
                {p.descripcion}
              </p>
              <button
                onClick={() => navigate(p.ruta)}
                className={`mt-2 min-h-[44px] w-full px-5 text-sm font-semibold transition ${
                  p.destacada
                    ? "brillo bg-acento text-white hover:bg-acento/90 active:scale-[0.99]"
                    : "border border-black/15 text-texto hover:border-acento/40 hover:text-acento dark:border-white/15 dark:text-texto-dark"
                }`}
              >
                {p.accion}
              </button>
              {p.sesion && (
                <Link
                  to={p.sesion.ruta}
                  className="text-xs text-texto-suave underline underline-offset-2 dark:text-texto-suave-dark"
                >
                  {p.sesion.texto}
                </Link>
              )}
            </div>
            </Reveal>
          ))}
        </div>

        {/* Dentro de la app instalada no tiene sentido ofrecer descargarla */}
        {!Capacitor.isNativePlatform() && (
          <a
            href="https://khbztuyjekqzllplinmg.supabase.co/storage/v1/object/public/descargas/MineLink.apk"
            className="flex w-full max-w-md flex-col items-center self-center border border-black/10 p-4 text-center transition duration-200 hover:-translate-y-0.5 hover:border-acento/30 dark:border-white/10"
          >
            <span className="flex items-center justify-center gap-1.5 text-sm font-semibold">
              <Download size={16} strokeWidth={1.75} aria-hidden />
              Descargar la app para Android (APK)
            </span>
            <span className="mt-1 text-xs text-texto-suave dark:text-texto-suave-dark">
              Gratis, 4 MB. Al instalar, acepta "instalar de origen desconocido" —
              es normal para apps fuera de Play Store.
            </span>
          </a>
        )}

        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-center text-xs text-texto-suave dark:text-texto-suave-dark">
            {CONFIANZA.map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5">
                <Check size={13} strokeWidth={2.5} className="text-acento" aria-hidden />
                {c}
              </span>
            ))}
          </div>
          <Link
            to="/como-funciona"
            className="text-sm font-medium text-acento underline underline-offset-4"
          >
            ¿Cómo funciona {MARCA}, paso a paso?
          </Link>
        </div>
      </div>
    </div>
  );
}

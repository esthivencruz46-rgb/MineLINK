import { Capacitor } from "@capacitor/core";
import { useTitulo } from "../hooks/useTitulo";
import { MARCA } from "../config/marca";
import { Link, useNavigate } from "react-router-dom";
import { Briefcase, Check, Download, Pickaxe, Wrench, type LucideIcon } from "lucide-react";
import { NoticiasSection } from "../components/NoticiasSection";

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

// julio 2026, tercer pase sobre esta página (pedido explícito: "se parece
// mucho a ¿Cómo funciona?, debe ser más simplista, menos letra... más
// vistoso") — Inicio y ComoFunciona.tsx compartían la misma estructura
// (lista de filas con borde, un párrafo de descripción por perfil): entrar
// a "¿Cómo funciona?" se sentía como leer la misma página dos veces, solo
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
      <section className="w-full border-b border-black/10 dark:border-white/10">
        <div className="mx-auto max-w-2xl px-4 pb-14 pt-16 text-center md:pb-20 md:pt-24">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-texto-suave dark:text-texto-suave-dark">
            Formalización minera artesanal · Perú
          </p>
          <h1 className="mx-auto mt-5 max-w-xl text-4xl font-semibold leading-[1.1] tracking-tight md:text-6xl">
            Formaliza tu minería.
            <br />
            <span className="text-acento">Conecta con inversionistas.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-sm text-base text-texto-suave dark:text-texto-suave-dark">
            Diagnóstico gratuito, proyectos verificados, clientes reales.
          </p>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PERFILES.map((p) => (
            <div
              key={p.titulo}
              className={`flex flex-col items-start gap-3 border p-6 ${
                p.destacada
                  ? "border-acento/30 bg-acento/[0.04]"
                  : "border-black/10 dark:border-white/10"
              }`}
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full ${
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
                    ? "bg-acento text-white hover:bg-acento/90"
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
          ))}
        </div>

        <NoticiasSection />

        {/* Dentro de la app instalada no tiene sentido ofrecer descargarla */}
        {!Capacitor.isNativePlatform() && (
          <a
            href="https://khbztuyjekqzllplinmg.supabase.co/storage/v1/object/public/descargas/MineLink.apk"
            className="flex w-full max-w-md flex-col items-center self-center border border-black/10 p-4 text-center transition hover:border-acento/30 dark:border-white/10"
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

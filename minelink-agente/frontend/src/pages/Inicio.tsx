import { Capacitor } from "@capacitor/core";
import { MARCA } from "../config/marca";
import { Link, useNavigate } from "react-router-dom";
import { Briefcase, Download, Pickaxe, Wrench, type LucideIcon } from "lucide-react";

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
    descripcion:
      "Descubre gratis y en 5 minutos qué te falta para formalizarte. Es anónimo hasta que tú decidas dejar tu contacto.",
    accion: "Empezar mi diagnóstico",
    ruta: "/diagnostico",
    destacada: true,
    sesion: { texto: "Ya tengo mi cuenta", ruta: "/ingresar" },
  },
  {
    Icono: Briefcase,
    titulo: "Inversionistas y curiosos",
    descripcion:
      "Explora operaciones mineras verificadas con REINFO, con fotos, puntaje de formalización y ubicación real. Mira libremente y, si algo te interesa, deja tu contacto.",
    accion: "Ver proyectos mineros",
    ruta: "/proyectos",
    sesion: { texto: "Ya dejé mi interés antes", ruta: "/ingresar-inversionista" },
  },
  {
    Icono: Wrench,
    titulo: "Soy consultor o empresa",
    descripcion:
      "¿Eres ingeniero, geólogo o profesional colegiado? Te conectamos con mineros que necesitan exactamente tus servicios.",
    accion: "Postular mis servicios",
    ruta: "/postular",
  },
];

const CONFIANZA = [
  "100% gratis para mineros",
  "Sin tramitadores de por medio",
  "Tu contacto nunca se muestra públicamente",
];

export function Inicio() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center">
      {/* julio 2026, segunda pasada tras feedback directo de Esthiven
          ("quiero más profesionalismo"): fuera los globos de color, las
          insignias en burbuja y las sombras — línea editorial más
          institucional (borde fino, un solo acento, jerarquía por peso
          tipográfico en vez de por color). */}
      <section className="w-full border-b border-black/10 dark:border-white/10">
        <div className="mx-auto max-w-4xl px-4 pb-12 pt-14 text-center md:pb-16 md:pt-20">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-texto-suave dark:text-texto-suave-dark">
            Formalización minera artesanal · Perú
          </p>
          <h1 className="mx-auto mt-5 max-w-2xl text-3xl font-semibold leading-[1.15] tracking-tight md:text-[2.75rem]">
            Conectamos la minería artesanal con su formalización
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-texto-suave dark:text-texto-suave-dark">
            Diagnóstico gratuito para mineros, proyectos verificados para
            inversionistas y clientes reales para consultores.
          </p>
          <Link
            to="/como-funciona"
            className="mt-4 inline-block border-b border-acento text-sm font-medium text-acento"
          >
            ¿Cómo funciona {MARCA}?
          </Link>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-10">
        <div className="flex flex-col divide-y divide-black/10 border border-black/10 dark:divide-white/10 dark:border-white/10">
          {PERFILES.map((p) => (
            <div
              key={p.titulo}
              className={`flex flex-col gap-4 p-6 sm:flex-row sm:items-center ${
                p.destacada ? "bg-acento/[0.035]" : ""
              }`}
            >
              <div className="flex flex-1 items-start gap-3.5">
                <p.Icono
                  size={20}
                  strokeWidth={1.75}
                  className="mt-0.5 shrink-0 text-acento"
                  aria-hidden
                />
                <div>
                  <h2 className="font-semibold">{p.titulo}</h2>
                  <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
                    {p.descripcion}
                  </p>
                  {p.sesion && (
                    <Link
                      to={p.sesion.ruta}
                      className="mt-2 inline-block text-sm text-texto-suave underline underline-offset-2 dark:text-texto-suave-dark"
                    >
                      {p.sesion.texto}
                    </Link>
                  )}
                </div>
              </div>
              <button
                onClick={() => navigate(p.ruta)}
                className={`min-h-[44px] shrink-0 px-5 text-sm font-semibold transition ${
                  p.destacada
                    ? "bg-acento text-white hover:bg-acento/90"
                    : "border border-black/15 text-texto hover:border-acento/40 hover:text-acento dark:border-white/15 dark:text-texto-dark"
                }`}
              >
                {p.accion}
              </button>
            </div>
          ))}
        </div>

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

        <p className="text-center text-xs text-texto-suave dark:text-texto-suave-dark">
          {CONFIANZA.join("  ·  ")}
        </p>
      </div>
    </div>
  );
}

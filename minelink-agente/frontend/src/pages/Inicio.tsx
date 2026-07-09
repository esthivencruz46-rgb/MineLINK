import { Capacitor } from "@capacitor/core";
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

export function Inicio() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-4xl flex-col items-center justify-center gap-8 px-4 py-10">
      <div className="text-center">
        <h1 className="text-3xl font-bold md:text-4xl">
          Conectamos la minería artesanal con su formalización
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-texto-suave dark:text-texto-suave-dark">
          Diagnóstico gratuito para mineros, proyectos verificados para
          inversionistas y clientes reales para consultores.
        </p>
        <Link
          to="/como-funciona"
          className="mt-2 inline-block text-sm font-semibold text-acento underline"
        >
          ¿Cómo funciona MineLink?
        </Link>
      </div>

      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
        {PERFILES.map((p) => (
          <div
            key={p.titulo}
            className={`flex flex-col rounded-xl p-5 text-left ${
              p.destacada
                ? "border-2 border-acento bg-acento/5 md:col-span-2"
                : "bg-tarjeta dark:bg-tarjeta-dark"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-acento/10 text-acento">
                <p.Icono size={20} strokeWidth={2} aria-hidden />
              </span>
              <h2 className="text-lg font-bold">{p.titulo}</h2>
            </div>
            <p className="mt-2 flex-1 text-sm text-texto-suave dark:text-texto-suave-dark">
              {p.descripcion}
            </p>
            <button
              onClick={() => navigate(p.ruta)}
              className={`mt-4 min-h-[44px] rounded-lg px-4 font-semibold transition duration-200 hover:opacity-90 ${
                p.destacada
                  ? "bg-acento text-white"
                  : "border border-acento text-acento"
              }`}
            >
              {p.accion}
            </button>
            {p.sesion && (
              <Link
                to={p.sesion.ruta}
                className="mt-2 text-center text-sm text-texto-suave underline dark:text-texto-suave-dark"
              >
                {p.sesion.texto}
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Dentro de la app instalada no tiene sentido ofrecer descargarla */}
      {!Capacitor.isNativePlatform() && (
      <a
        href="https://khbztuyjekqzllplinmg.supabase.co/storage/v1/object/public/descargas/MineLink.apk"
        className="flex w-full max-w-md flex-col items-center rounded-xl border border-acento/30 bg-tarjeta p-4 text-center transition hover:opacity-90 dark:bg-tarjeta-dark"
      >
        <span className="flex items-center justify-center gap-1.5 font-semibold text-acento">
          <Download size={18} strokeWidth={2} aria-hidden />
          Descargar la app para Android (APK)
        </span>
        <span className="mt-1 text-xs text-texto-suave dark:text-texto-suave-dark">
          Gratis, 4 MB. Al instalar, acepta "instalar de origen desconocido" —
          es normal para apps fuera de Play Store.
        </span>
      </a>
      )}

      <p className="text-center text-xs text-texto-suave dark:text-texto-suave-dark">
        100% gratis para mineros · Sin tramitadores · Tus datos de contacto
        nunca se muestran públicamente
      </p>
    </div>
  );
}

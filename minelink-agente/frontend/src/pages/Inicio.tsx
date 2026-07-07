import { Link, useNavigate } from "react-router-dom";

interface TarjetaPerfil {
  emoji: string;
  titulo: string;
  descripcion: string;
  accion: string;
  ruta: string;
  destacada?: boolean;
  sesion?: { texto: string; ruta: string };
}

const PERFILES: TarjetaPerfil[] = [
  {
    emoji: "⛏️",
    titulo: "Soy minero",
    descripcion:
      "Descubre gratis y en 5 minutos qué te falta para formalizarte. Es anónimo hasta que tú decidas dejar tu contacto.",
    accion: "Empezar mi diagnóstico",
    ruta: "/diagnostico",
    destacada: true,
    sesion: { texto: "Ya tengo mi cuenta", ruta: "/ingresar" },
  },
  {
    emoji: "💼",
    titulo: "Soy inversionista",
    descripcion:
      "Explora operaciones mineras verificadas con REINFO, con fotos, puntaje de formalización y ubicación real.",
    accion: "Ver proyectos para invertir",
    ruta: "/proyectos",
    sesion: { texto: "Ya dejé mi interés antes", ruta: "/ingresar-inversionista" },
  },
  {
    emoji: "🛠️",
    titulo: "Soy consultor o empresa",
    descripcion:
      "¿Eres ingeniero, geólogo o profesional colegiado? Te conectamos con mineros que necesitan exactamente tus servicios.",
    accion: "Postular mis servicios",
    ruta: "/postular",
  },
  {
    emoji: "👀",
    titulo: "Solo quiero mirar",
    descripcion:
      "Conoce los proyectos mineros artesanales del Perú que están en camino a la formalización.",
    accion: "Ver proyectos mineros",
    ruta: "/proyectos",
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
      </div>

      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
        {PERFILES.map((p) => (
          <div
            key={p.titulo}
            className={`flex flex-col rounded-xl p-5 text-left ${
              p.destacada
                ? "border-2 border-acento bg-acento/5"
                : "bg-tarjeta dark:bg-tarjeta-dark"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden>
                {p.emoji}
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

      <p className="text-center text-xs text-texto-suave dark:text-texto-suave-dark">
        100% gratis para mineros · Sin tramitadores · Tus datos de contacto
        nunca se muestran públicamente
      </p>
    </div>
  );
}

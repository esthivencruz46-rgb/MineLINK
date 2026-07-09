import { Link } from "react-router-dom";
import { Briefcase, Pickaxe, Wrench, type LucideIcon } from "lucide-react";

interface Paso {
  numero: string;
  titulo: string;
  detalle: string;
}

interface Seccion {
  Icono: LucideIcon;
  titulo: string;
  pasos: Paso[];
  accion: string;
  ruta: string;
}

const SECCIONES: Seccion[] = [
  {
    Icono: Pickaxe,
    titulo: "Si eres minero",
    pasos: [
      {
        numero: "1",
        titulo: "Responde el cuestionario (5 minutos, gratis)",
        detalle:
          "Preguntas simples de sí o no sobre tus papeles y tu labor. Es anónimo: nadie sabe quién eres hasta que tú decidas dejar tu contacto.",
      },
      {
        numero: "2",
        titulo: "Recibe tu puntaje y tu lista de pendientes",
        detalle:
          "Te decimos exactamente qué te falta para formalizarte, explicado en palabras simples — sin jerga legal ni letras chiquitas.",
      },
      {
        numero: "3",
        titulo: "Te conectamos con quien te puede ayudar",
        detalle:
          "Profesionales de confianza que hacen justo los estudios que te faltan, y si buscas inversión, tu proyecto puede aparecer ante inversionistas (sin mostrar tu nombre ni tu número).",
      },
    ],
    accion: "Empezar mi diagnóstico",
    ruta: "/diagnostico",
  },
  {
    Icono: Briefcase,
    titulo: "Si eres inversionista",
    pasos: [
      {
        numero: "1",
        titulo: "Explora proyectos verificados",
        detalle:
          "Solo se muestran operaciones con REINFO, con fotos reales, puntaje de formalización, ubicación en el mapa y documentos presentados.",
      },
      {
        numero: "2",
        titulo: "Deja tu interés en el proyecto que te guste",
        detalle:
          "Nos cuentas tu motivo, el capital que manejas y qué información necesitas. Nunca compartimos tu contacto públicamente.",
      },
      {
        numero: "3",
        titulo: "MineLink te presenta con el titular",
        detalle:
          "Filtramos y coordinamos la presentación formal entre tú y el minero. Acompañamos la conversación para que ambos negocien con confianza.",
      },
    ],
    accion: "Ver proyectos",
    ruta: "/proyectos",
  },
  {
    Icono: Wrench,
    titulo: "Si eres consultor o empresa",
    pasos: [
      {
        numero: "1",
        titulo: "Postula con tu colegiatura y tu CV",
        detalle:
          "Ingenieros, geólogos y profesionales colegiados con al menos 3 años de experiencia. La postulación es gratuita.",
      },
      {
        numero: "2",
        titulo: "Revisamos y aprobamos tu perfil",
        detalle:
          "Verificamos tu experiencia para proteger a los mineros de malos tramitadores — esa confianza también te beneficia a ti.",
      },
      {
        numero: "3",
        titulo: "Te llegan clientes precalificados",
        detalle:
          "Cuando un minero necesita exactamente lo que tú ofreces y en tu región, apareces como su opción recomendada.",
      },
    ],
    accion: "Postular mis servicios",
    ruta: "/postular",
  },
];

export function ComoFunciona() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">¿Cómo funciona MineLink?</h1>
        <p className="mx-auto mt-2 max-w-xl text-texto-suave dark:text-texto-suave-dark">
          Tres caminos, un mismo objetivo: que la minería artesanal del Perú se
          formalice y crezca.
        </p>
      </div>

      {SECCIONES.map((s) => (
        <div key={s.titulo} className="rounded-xl bg-tarjeta p-6 dark:bg-tarjeta-dark">
          <h2 className="flex items-center gap-2.5 text-xl font-bold">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-acento/10 text-acento">
              <s.Icono size={20} strokeWidth={2} aria-hidden />
            </span>
            {s.titulo}
          </h2>
          <div className="mt-4 flex flex-col gap-4">
            {s.pasos.map((paso) => (
              <div key={paso.numero} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-acento/15 font-bold text-acento">
                  {paso.numero}
                </span>
                <div>
                  <h3 className="font-semibold">{paso.titulo}</h3>
                  <p className="mt-0.5 text-sm text-texto-suave dark:text-texto-suave-dark">
                    {paso.detalle}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <Link
            to={s.ruta}
            className="mt-5 flex min-h-[44px] items-center justify-center rounded-lg bg-acento px-4 font-semibold text-white transition duration-200 hover:opacity-90"
          >
            {s.accion}
          </Link>
        </div>
      ))}

      <p className="text-center text-xs text-texto-suave dark:text-texto-suave-dark">
        100% gratis para mineros · Sin tramitadores · Tus datos de contacto
        nunca se muestran públicamente
      </p>
    </div>
  );
}

import { Link } from "react-router-dom";
import { useTitulo } from "../hooks/useTitulo";
import { MARCA } from "../config/marca";
import { Briefcase, Pickaxe, Wrench, type LucideIcon } from "lucide-react";
import { HeroFranja } from "../components/HeroFranja";

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

// julio 2026: reescrita para reflejar el modelo actual (perfiles A/B/C/D,
// dos semáforos + Índice de Madurez, Módulo INV, publicación automática y
// "Con respaldo" solo tras revisión del equipo) — la versión anterior
// describía el diagnóstico viejo de puntaje único 0-100, que ya no existe.
const SECCIONES: Seccion[] = [
  {
    Icono: Pickaxe,
    titulo: "Si eres minero",
    pasos: [
      {
        numero: "1",
        titulo: "Responde 4 preguntas filtro (2 minutos, gratis y anónimo)",
        detalle:
          "Te ubican en tu situación exacta: recién empezando, con concesión pero sin operar, operando con REINFO, o ya formal. Nadie sabe quién eres hasta que tú decidas dejar tu contacto.",
      },
      {
        numero: "2",
        titulo: "Recibe tu diagnóstico completo, no un solo número",
        detalle:
          "Dos semáforos independientes — uno legal y otro técnico, con tu Índice de Madurez — más el checklist exacto de tu etapa: qué ya cumples y qué te falta, sin jerga legal.",
      },
      {
        numero: "3",
        titulo: "Crea tu cuenta y sube tus respaldos",
        detalle:
          "Cada trámite pendiente te dice qué estudio necesitas y qué empresas o consultores lo hacen en tu región. Sube la foto de cada documento que ya tienes — resuelve tu pendiente al instante.",
      },
      {
        numero: "4",
        titulo: "Publicación automática ante inversionistas",
        detalle:
          "En cuanto envías tus documentos y tu perfil de inversión, y no tienes ningún problema legal activo, tu proyecto aparece solo en la cartera — sin trámite manual de por medio.",
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
        titulo: "Explora proyectos con su situación legal en orden",
        detalle:
          "Un proyecto con un problema legal activo (REINFO suspendido, concesión vencida) nunca se muestra — se oculta hasta que el minero lo resuelve. Lo que ves ya pasó ese primer filtro.",
      },
      {
        numero: "2",
        titulo: "Revisa la ficha completa, no solo fotos",
        detalle:
          `Semáforos y checklist de formalización, cotejo automático contra el catastro minero y la geología del punto (INGEMMET), y verificación del código REINFO. El sello "Con respaldo" solo aparece en documentos que el equipo de ${MARCA} ya revisó — el resto se ve pero conviene revisarlo con cuidado.`,
      },
      {
        numero: "3",
        titulo: "Deja tu interés — nosotros intermediamos",
        detalle:
          "Nos cuentas tu motivo y qué necesitas saber. Nunca compartimos el contacto del minero directamente: coordinamos la presentación formal para que ambos negocien con confianza.",
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
          "Ingenieros, geólogos y profesionales colegiados. Marcas en qué trámites y estudios puedes ayudar. La postulación es gratuita.",
      },
      {
        numero: "2",
        titulo: "Revisamos y aprobamos tu perfil",
        detalle:
          "Verificamos tu colegiatura y tu CV para proteger a los mineros de malos tramitadores — esa confianza también te beneficia a ti.",
      },
      {
        numero: "3",
        titulo: "Te llegan clientes precalificados",
        detalle:
          "Cuando un minero tiene exactamente la brecha que tú resuelves y está en tu región, te aparece como su opción recomendada.",
      },
    ],
    accion: "Postular mis servicios",
    ruta: "/postular",
  },
];

export function ComoFunciona() {
  useTitulo("Cómo funciona");
  return (
    <div className="flex flex-col items-center">
      <HeroFranja
        titulo={`¿Cómo funciona ${MARCA}?`}
        subtitulo="Tres caminos, un mismo objetivo: que la minería artesanal del Perú se formalice y crezca."
        ancho="max-w-3xl"
      />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      {SECCIONES.map((s) => (
        <div key={s.titulo} className="border border-black/10 p-6 transition-colors hover:border-acento/25 dark:border-white/10">
          <h2 className="flex items-center gap-2.5 text-xl font-semibold">
            <s.Icono size={22} strokeWidth={1.75} className="shrink-0 text-acento" aria-hidden />
            {s.titulo}
          </h2>
          <div className="mt-5 flex flex-col divide-y divide-black/10 dark:divide-white/10">
            {s.pasos.map((paso) => (
              <div key={paso.numero} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                <span className="shrink-0 text-sm font-semibold text-acento">
                  {paso.numero.padStart(2, "0")}
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
            className="mt-5 flex min-h-[44px] items-center justify-center bg-acento px-4 font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-acento/90"
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
    </div>
  );
}

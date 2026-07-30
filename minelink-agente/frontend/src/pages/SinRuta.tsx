import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Compass } from "lucide-react";

/** Caso SIN RUTA del Módulo 0: opera extrayendo mineral sin concesión, sin
 * contrato y sin REINFO. El REINFO está cerrado a nuevas inscripciones desde
 * septiembre 2020, así que no existe un trámite directo que lo formalice.
 * El spec pide informar SIN JUZGAR: riesgos objetivos + la ruta legal que
 * sí existe. No se registra diagnóstico ni se crea cuenta. */
export function SinRuta() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <div className="motion-safe:animate-[hero-entrada_0.5s_ease-out_both] flex items-start gap-3 border border-amber-500/25 bg-amber-500/5 p-4">
        <AlertTriangle size={22} strokeWidth={2} className="mt-0.5 shrink-0 text-amber-500" aria-hidden />
        <div>
          <h1 className="text-xl font-semibold">Hoy operas sin amparo legal</h1>
          <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
            Por lo que nos contaste, extraes mineral sin concesión propia, sin
            contrato con un titular y sin inscripción en el REINFO. El REINFO
            está cerrado a nuevas inscripciones desde septiembre de 2020, así
            que hoy no existe un trámite directo que formalice tu operación
            tal como está.
          </p>
        </div>
      </div>

      <div className="border border-black/10 bg-tarjeta p-5 dark:border-white/10 dark:bg-tarjeta-dark">
        <h2 className="font-semibold">Los riesgos reales de seguir así</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-texto-suave dark:text-texto-suave-dark">
          <li>• Interdicción: las autoridades pueden paralizar tu operación en cualquier momento.</li>
          <li>• Decomiso o destrucción de tu maquinaria y equipos.</li>
          <li>• Proceso penal por minería ilegal (hasta 8 años de pena).</li>
          <li>• No puedes vender tu mineral con liquidación formal ni acceder a crédito o inversionistas.</li>
        </ul>
      </div>

      <div className="border border-black/10 bg-tarjeta p-5 dark:border-white/10 dark:bg-tarjeta-dark">
        <div className="flex items-center gap-2">
          <Compass size={19} strokeWidth={2} className="text-acento" aria-hidden />
          <h2 className="font-semibold">La ruta legal que sí existe</h2>
        </div>
        <ul className="mt-3 flex flex-col gap-3 text-sm">
          <li>
            <span className="font-medium">1. Conseguir tu propia concesión.</span>{" "}
            <span className="text-texto-suave dark:text-texto-suave-dark">
              Buscas un área libre, presentas tu petitorio ante INGEMMET y sigues
              el régimen general. Nuestro diagnóstico te guía paso a paso.
            </span>
          </li>
          <li>
            <span className="font-medium">2. Firmar un contrato con el titular de la concesión donde trabajas.</span>{" "}
            <span className="text-texto-suave dark:text-texto-suave-dark">
              Un contrato de cesión o explotación te da amparo legal para operar
              en concesión ajena.
            </span>
          </li>
        </ul>
        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
          <Link
            to="/diagnostico"
            className="inline-flex min-h-[44px] items-center justify-center gap-1 bg-acento px-5 font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-acento/90"
          >
            Explorar esa ruta
            <ArrowRight size={16} strokeWidth={2.25} aria-hidden />
          </Link>
          <Link
            to="/empresas"
            className="inline-flex min-h-[44px] items-center justify-center border border-black/10 px-5 font-semibold transition duration-200 hover:-translate-y-0.5 hover:border-acento/40 dark:border-white/10"
          >
            Buscar asesoría legal
          </Link>
        </div>
      </div>

      <p className="text-xs text-texto-suave dark:text-texto-suave-dark">
        Esta información es orientativa, no una acusación ni una asesoría legal
        formal. Miles de mineros están en tu misma situación — lo importante es
        conocer el camino para salir de ella.
      </p>
    </div>
  );
}

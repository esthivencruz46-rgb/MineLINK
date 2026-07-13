import { Check } from "lucide-react";
import type { MineroPerfil } from "../types/minero";

function Item({
  titulo,
  subtitulo,
  hecho,
}: {
  titulo: string;
  subtitulo: string;
  hecho: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          hecho ? "bg-emerald-500 text-white" : "bg-acento text-white"
        }`}
      >
        {hecho ? <Check size={16} strokeWidth={3} aria-hidden /> : "•"}
      </div>
      <div>
        <p className="text-sm font-semibold">{titulo}</p>
        <p className="text-xs text-texto-suave dark:text-texto-suave-dark">{subtitulo}</p>
      </div>
    </div>
  );
}

/** Resumen de las dos partes que Esthiven revisa antes de publicar el
 *  proyecto en la cartera pública — Formalización e Inversión se pueden
 *  completar en paralelo, en la misma sesión, SIN esperar la aprobación
 *  de una para empezar la otra; lo único que espera a que ambas estén
 *  aprobadas es la publicación final (ver apto_inversionistas). */
export function PasosFormalizacionInversion({ perfil }: { perfil: MineroPerfil }) {
  const totalBrechas = perfil.brechas.length;
  const resueltas = perfil.brechas_resueltas.length;
  const formalizacionHecha = perfil.visto_bueno_documentos;
  const inversionHecha = perfil.inv_visto_bueno;
  const publicado = formalizacionHecha && inversionHecha;

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-tarjeta p-4 dark:bg-tarjeta-dark">
      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        <Item
          titulo="Formalización"
          subtitulo={
            formalizacionHecha
              ? "Aprobada"
              : totalBrechas > 0
                ? `${resueltas}/${totalBrechas} completos`
                : "En curso"
          }
          hecho={formalizacionHecha}
        />
        <Item
          titulo="Inversión"
          subtitulo={
            inversionHecha ? "Aprobada" : perfil.inv_enviado ? "En revisión" : "Puedes completarla ahora"
          }
          hecho={inversionHecha}
        />
      </div>
      <p className="text-xs text-texto-suave dark:text-texto-suave-dark">
        {publicado
          ? "Esthiven aprobó las dos partes — tu proyecto ya está publicado en la cartera."
          : "Puedes completar las dos partes sin esperar una a la otra — Esthiven las revisa juntas antes de publicarte en la cartera."}
      </p>
    </div>
  );
}

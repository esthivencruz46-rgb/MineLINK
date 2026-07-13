import { Check } from "lucide-react";
import { NOMBRE_PERFIL } from "../data/preguntas";
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

/** Resumen de las dos partes que hay que enviar antes de publicar el
 *  proyecto en la cartera pública — Formalización e Inversión se pueden
 *  completar en paralelo, en la misma sesión, sin esperar una a la otra;
 *  no hay aprobación manual del admin: la publicación es automática en
 *  cuanto ambas están enviadas (ver apto_inversionistas). */
export function PasosFormalizacionInversion({ perfil }: { perfil: MineroPerfil }) {
  const totalBrechas = perfil.brechas.length;
  const resueltas = perfil.brechas_resueltas.length;
  const formalizacionHecha = perfil.documentos_enviados;
  const inversionHecha = perfil.inv_enviado;
  const publicado = perfil.apto_inversionistas;

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-tarjeta p-4 dark:bg-tarjeta-dark">
      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        <Item
          titulo="Formalización"
          subtitulo={
            formalizacionHecha
              ? "Enviada"
              : totalBrechas > 0
                ? `${resueltas}/${totalBrechas} completos`
                : "En curso"
          }
          hecho={formalizacionHecha}
        />
        <Item
          titulo="Inversión"
          subtitulo={inversionHecha ? "Enviada" : "Puedes completarla ahora"}
          hecho={inversionHecha}
        />
        {perfil.perfil && (
          <span className="rounded-full bg-acento/15 px-4 py-1 text-sm font-semibold text-acento sm:ml-auto">
            {NOMBRE_PERFIL[perfil.perfil] ?? perfil.perfil}
          </span>
        )}
      </div>
      <p className="text-xs text-texto-suave dark:text-texto-suave-dark">
        {publicado
          ? "Tu proyecto ya está publicado en la cartera para inversionistas."
          : "Puedes completar las dos partes sin esperar una a la otra — se publica sola en cuanto envíes ambas."}
      </p>
    </div>
  );
}

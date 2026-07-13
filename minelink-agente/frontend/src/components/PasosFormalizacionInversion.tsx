import { Check, Lock } from "lucide-react";
import type { MineroPerfil } from "../types/minero";

type EstadoPaso = "hecho" | "actual" | "bloqueado";

function Paso({
  numero,
  titulo,
  subtitulo,
  estado,
}: {
  numero: number;
  titulo: string;
  subtitulo?: string;
  estado: EstadoPaso;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          estado === "hecho"
            ? "bg-emerald-500 text-white"
            : estado === "actual"
              ? "bg-acento text-white"
              : "bg-black/10 text-texto-suave dark:bg-white/10 dark:text-texto-suave-dark"
        }`}
      >
        {estado === "hecho" ? (
          <Check size={16} strokeWidth={3} aria-hidden />
        ) : estado === "bloqueado" ? (
          <Lock size={13} strokeWidth={2.5} aria-hidden />
        ) : (
          numero
        )}
      </div>
      <div>
        <p
          className={`text-sm font-semibold ${
            estado === "bloqueado" ? "text-texto-suave dark:text-texto-suave-dark" : ""
          }`}
        >
          {titulo}
        </p>
        {subtitulo && (
          <p className="text-xs text-texto-suave dark:text-texto-suave-dark">{subtitulo}</p>
        )}
      </div>
    </div>
  );
}

/** Indicador "① Formalización → ② Inversión" al inicio de la cuenta —
 *  dos columnas (Formalización a la izquierda, Inversión a la derecha en
 *  escritorio) pueden leerse como opciones sueltas si no queda claro que
 *  una desbloquea la otra; esto lo hace explícito de un vistazo. */
export function PasosFormalizacionInversion({ perfil }: { perfil: MineroPerfil }) {
  const totalBrechas = perfil.brechas.length;
  const resueltas = perfil.brechas_resueltas.length;
  const paso1Hecho = perfil.visto_bueno_documentos;
  const paso2Hecho = perfil.inv_visto_bueno;

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg bg-tarjeta p-4 dark:bg-tarjeta-dark sm:gap-6">
      <Paso
        numero={1}
        titulo="Formalización"
        subtitulo={
          paso1Hecho
            ? "Completa"
            : totalBrechas > 0
              ? `${resueltas}/${totalBrechas} completos`
              : "En curso"
        }
        estado={paso1Hecho ? "hecho" : "actual"}
      />
      <div className="h-px flex-1 min-w-[24px] bg-black/10 dark:bg-white/10" />
      <Paso
        numero={2}
        titulo="Inversión"
        subtitulo={
          paso2Hecho ? "Completa" : paso1Hecho ? "Ya puedes completarla" : "Se desbloquea al terminar el paso 1"
        }
        estado={paso2Hecho ? "hecho" : paso1Hecho ? "actual" : "bloqueado"}
      />
    </div>
  );
}

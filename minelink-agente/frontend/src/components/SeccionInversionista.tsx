import { CheckCircle2, Lock, TrendingUp } from "lucide-react";
import type { MineroPerfil } from "../types/minero";

/** Tarjeta "Inversionista" al final de la cuenta (MiCuenta/MiConcesion) —
 *  refleja el estado del gate de documentos y del Módulo INV en un solo
 *  vistazo, sin duplicar la lógica entre las dos ventanas. */
export function SeccionInversionista({
  perfil,
  onAbrir,
}: {
  perfil: MineroPerfil;
  onAbrir: () => void;
}) {
  if (!perfil.inversion_ofrecida) {
    return (
      <div className="flex items-start gap-3 rounded-lg bg-tarjeta p-5 opacity-70 dark:bg-tarjeta-dark">
        <Lock size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-texto-suave dark:text-texto-suave-dark" />
        <div>
          <h2 className="font-semibold">Inversionista</h2>
          <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
            Por ahora no aplica a tu perfil.
          </p>
        </div>
      </div>
    );
  }

  if (!perfil.visto_bueno_documentos) {
    return (
      <div className="flex items-start gap-3 rounded-lg bg-tarjeta p-5 opacity-70 dark:bg-tarjeta-dark">
        <Lock size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-texto-suave dark:text-texto-suave-dark" />
        <div>
          <h2 className="font-semibold">Inversionista (bloqueado)</h2>
          <p className="mt-1 text-sm text-texto-suave dark:text-texto-suave-dark">
            {perfil.documentos_enviados
              ? "Esthiven está revisando los archivos que enviaste. Se desbloquea en cuanto los valide."
              : "Se desbloquea cuando envíes tus archivos en \"Respalda tu declaración\" y Esthiven los valide."}
          </p>
        </div>
      </div>
    );
  }

  if (perfil.inv_visto_bueno) {
    return (
      <div className="flex items-start gap-3 rounded-lg bg-emerald-500/10 p-5 text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 size={18} strokeWidth={2} className="mt-0.5 shrink-0" />
        <div>
          <h2 className="font-semibold">Tu perfil ya es visible para inversionistas</h2>
          <p className="mt-1 text-sm opacity-90">
            Esthiven validó tu perfil de inversión. Tu proyecto ya compite en la vitrina.
          </p>
        </div>
      </div>
    );
  }

  if (perfil.inv_enviado) {
    return (
      <div className="flex items-start gap-3 rounded-lg bg-acento/10 p-5 text-acento">
        <TrendingUp size={18} strokeWidth={2} className="mt-0.5 shrink-0" />
        <div>
          <h2 className="font-semibold">Inversionista — en revisión</h2>
          <p className="mt-1 text-sm opacity-90">
            Enviaste tu perfil de inversión. Esthiven lo está revisando junto con tus documentos
            de sustento.
          </p>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onAbrir}
      className="flex items-center justify-between gap-3 rounded-lg bg-acento p-5 text-left text-white"
    >
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          <TrendingUp size={18} strokeWidth={2} /> Inversionista
        </h2>
        <p className="mt-1 text-sm text-white/85">
          Esthiven ya validó tus documentos. Completa tu perfil para atraer inversionistas.
        </p>
      </div>
    </button>
  );
}

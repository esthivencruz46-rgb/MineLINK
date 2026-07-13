import { CheckCircle2, Lock, TrendingUp } from "lucide-react";
import type { MineroPerfil } from "../types/minero";

/** Tarjeta "Inversionista" al final de la cuenta (MiCuenta/MiConcesion) —
 *  refleja el estado del Módulo INV en un solo vistazo, sin duplicar la
 *  lógica entre las dos ventanas. No hay aprobación manual del admin: el
 *  minero completa formalización e inversión en la misma sesión y la
 *  publicación en la cartera es automática al enviar ambas partes (ver
 *  `apto_inversionistas` en scoring.py) — los inversionistas verifican
 *  los datos por sí mismos. */
export function SeccionInversionista({
  perfil,
  abierto,
  onAbrir,
}: {
  perfil: MineroPerfil;
  /** true mientras el wizard embebido (CuestionarioInversionInline) está
   *  desplegado debajo de esta tarjeta en la misma columna. */
  abierto: boolean;
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

  if (perfil.apto_inversionistas) {
    return (
      <div className="flex items-start gap-3 rounded-lg bg-emerald-500/10 p-5 text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 size={18} strokeWidth={2} className="mt-0.5 shrink-0" />
        <div>
          <h2 className="font-semibold">Tu perfil ya es visible para inversionistas</h2>
          <p className="mt-1 text-sm opacity-90">
            Tu proyecto ya está publicado en la cartera y compite por inversionistas.
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
          <h2 className="font-semibold">Inversionista — enviado</h2>
          <p className="mt-1 text-sm opacity-90">
            Enviaste tu perfil de inversión. Se publica en la cartera en cuanto también envíes
            tus documentos de formalización (si todavía no lo hiciste).
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
          {abierto
            ? "Completa tu perfil de inversión aquí abajo."
            : "Completa tu perfil de inversión — no hace falta esperar a que aprueben tus documentos de formalización para empezar."}
        </p>
      </div>
    </button>
  );
}

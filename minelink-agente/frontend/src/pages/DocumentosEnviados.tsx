import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check, TrendingUp } from "lucide-react";
import { useMineroAuth } from "../context/MineroAuthContext";

interface EstadoEnvio {
  volverA?: string;
  titulo?: string;
  mensaje?: string;
  /** true cuando viene de guardar documentos de FORMALIZACIÓN — ahí se
   *  ofrece seguir directo con el Módulo INV en la misma sesión, sin
   *  esperar a que aprueben estos documentos primero. */
  mostrarCtaInversion?: boolean;
}

/** Pantalla dedicada de confirmación tras un envío a revisión — la usan
 *  tanto "Guardar archivos" en DocumentosMinero.tsx (documentos de
 *  formalización) como el envío final del Módulo INV en
 *  CuestionarioInversion.tsx (respuestas + documentos de sustento). No
 *  deja al minero parado en medio del formulario: confirma y da un solo
 *  botón claro para volver a su cuenta cuando quiera. */
export function DocumentosEnviados() {
  const navigate = useNavigate();
  const location = useLocation();
  const { authFetch } = useMineroAuth();
  const estado = (location.state as EstadoEnvio | null) ?? {};
  const volverA = estado.volverA ?? "/mi-cuenta";
  const titulo = estado.titulo ?? "¡Archivos enviados!";
  const mensaje =
    estado.mensaje ??
    "Tus archivos ya quedaron guardados. Esthiven puede marcarte si alguno se ve mal (foto " +
      "borrosa, documento equivocado) para que lo corrijas — no bloquea nada mientras tanto.";
  const [ofrecerInversion, setOfrecerInversion] = useState(false);

  useEffect(() => {
    if (!estado.mostrarCtaInversion) return;
    authFetch("/mineros/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => setOfrecerInversion(Boolean(me?.inversion_ofrecida && !me?.inv_enviado)))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
        <Check size={32} strokeWidth={2} className="text-emerald-500" aria-hidden />
      </div>
      <h1 className="text-xl font-bold">{titulo}</h1>
      <p className="text-sm text-texto-suave dark:text-texto-suave-dark">{mensaje}</p>

      {ofrecerInversion && (
        <>
          <button
            onClick={() => navigate("/mi-inversion")}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-acento px-6 py-3 font-semibold text-white"
          >
            <TrendingUp size={18} strokeWidth={2} aria-hidden />
            Continuar con tu perfil de inversión →
          </button>
          <p className="text-xs text-texto-suave dark:text-texto-suave-dark">
            No hace falta esperar a que aprueben estos documentos para empezar.
          </p>
        </>
      )}

      <button
        onClick={() => navigate(volverA)}
        className={`min-h-[44px] rounded-lg px-6 font-semibold ${
          ofrecerInversion
            ? "border border-black/10 dark:border-white/10"
            : "bg-acento text-white"
        }`}
      >
        Volver a mi cuenta
      </button>
    </div>
  );
}

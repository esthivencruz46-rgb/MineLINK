import { useLocation, useNavigate } from "react-router-dom";
import { Check } from "lucide-react";

interface EstadoEnvio {
  volverA?: string;
  titulo?: string;
  mensaje?: string;
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
  const estado = (location.state as EstadoEnvio | null) ?? {};
  const volverA = estado.volverA ?? "/mi-cuenta";
  const titulo = estado.titulo ?? "¡Archivos enviados!";
  const mensaje =
    estado.mensaje ??
    "Esthiven va a revisar cada documento. Si alguno está mal, te va a indicar cuál y por qué " +
      "para que lo corrijas. Cuando todos queden aprobados, se desbloquea tu botón de Inversionista.";

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
        <Check size={32} strokeWidth={2} className="text-emerald-500" aria-hidden />
      </div>
      <h1 className="text-xl font-bold">{titulo}</h1>
      <p className="text-sm text-texto-suave dark:text-texto-suave-dark">{mensaje}</p>
      <button
        onClick={() => navigate(volverA)}
        className="min-h-[44px] rounded-lg bg-acento px-6 font-semibold text-white"
      >
        Volver a mi cuenta
      </button>
    </div>
  );
}

import { useLocation, useNavigate } from "react-router-dom";
import { Check } from "lucide-react";

/** Pantalla dedicada a la que llega el minero justo después de pulsar
 *  "Guardar archivos" en DocumentosMinero.tsx — confirma el envío y no lo
 *  deja parado en medio de la sección de documentos, con un solo botón
 *  claro para volver a su cuenta cuando quiera. */
export function DocumentosEnviados() {
  const navigate = useNavigate();
  const location = useLocation();
  const volverA = (location.state as { volverA?: string } | null)?.volverA ?? "/mi-cuenta";

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
        <Check size={32} strokeWidth={2} className="text-emerald-500" aria-hidden />
      </div>
      <h1 className="text-xl font-bold">¡Archivos enviados!</h1>
      <p className="text-sm text-texto-suave dark:text-texto-suave-dark">
        Esthiven va a revisar cada documento. Si alguno está mal, te va a indicar cuál y por qué
        para que lo corrijas. Cuando todos queden aprobados, se desbloquea tu botón de
        Inversionista.
      </p>
      <button
        onClick={() => navigate(volverA)}
        className="min-h-[44px] rounded-lg bg-acento px-6 font-semibold text-white"
      >
        Volver a mi cuenta
      </button>
    </div>
  );
}

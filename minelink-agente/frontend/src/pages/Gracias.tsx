import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

export function Gracias() {
  return (
    <div className="motion-safe:animate-[hero-entrada_0.5s_ease-out_both] flex min-h-[80vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-acento/10 text-acento">
        <CheckCircle2 size={26} strokeWidth={1.75} aria-hidden />
      </div>
      <h1 className="text-2xl font-semibold">¡Gracias!</h1>
      <p className="max-w-md text-texto-suave dark:text-texto-suave-dark">
        Te escribiremos por WhatsApp.
      </p>
      <Link
        to="/"
        className="min-h-[44px] bg-acento px-6 py-3 font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-acento/90"
      >
        Volver al inicio
      </Link>
    </div>
  );
}

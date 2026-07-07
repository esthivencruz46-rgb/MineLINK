import { Link } from "react-router-dom";

export function Gracias() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">¡Gracias!</h1>
      <p className="max-w-md text-texto-suave dark:text-texto-suave-dark">
        Te escribiremos por WhatsApp.
      </p>
      <Link
        to="/"
        className="min-h-[44px] rounded-lg bg-acento px-6 py-3 font-semibold text-white"
      >
        Volver al inicio
      </Link>
    </div>
  );
}

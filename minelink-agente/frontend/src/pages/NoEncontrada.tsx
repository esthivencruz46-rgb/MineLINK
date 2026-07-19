import { Link } from "react-router-dom";
import { useTitulo } from "../hooks/useTitulo";
import { Compass } from "lucide-react";
import { MARCA } from "../config/marca";

/** Página para rutas que no existen (julio 2026) — antes una URL
 *  equivocada mostraba la pantalla en blanco (el Routes no tenía
 *  catch-all), lo que parecía que la web estaba caída. */
export function NoEncontrada() {
  useTitulo("Página no encontrada");
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-acento/10 text-acento">
        <Compass size={32} strokeWidth={1.75} aria-hidden />
      </span>
      <h1 className="text-2xl font-bold">Esta página no existe</h1>
      <p className="text-sm text-texto-suave dark:text-texto-suave-dark">
        Puede que el enlace esté mal escrito o que la página se haya movido.
        Nada se perdió — todo {MARCA} sigue funcionando normal.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link
          to="/"
          className="min-h-[44px] rounded-lg bg-acento px-5 py-2.5 font-semibold text-white"
        >
          Ir a la portada
        </Link>
        <Link
          to="/proyectos"
          className="min-h-[44px] rounded-lg border border-black/10 px-5 py-2.5 font-semibold dark:border-white/10"
        >
          Ver proyectos
        </Link>
      </div>
    </div>
  );
}

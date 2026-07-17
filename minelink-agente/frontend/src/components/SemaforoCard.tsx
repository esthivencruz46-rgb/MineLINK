/** Tarjeta de un semáforo (Track Legal / Track Técnico) — compartida entre
 * /resultado y las ventanas de cuenta (MiCuenta/MiConcesion) para que el
 * minero vea el mismo lenguaje visual en todo el sitio.
 *
 * julio 2026: el borde y el tinte de fondo ahora reflejan el color del
 * semáforo (antes toda tarjeta era neutra y solo el punto de color
 * cambiaba) — un vistazo rápido ya comunica "estás bien" o "hay algo que
 * atender" antes de leer una sola palabra. */
export function SemaforoCard({
  titulo,
  semaforo,
  subtitulo,
  grande,
}: {
  titulo: string;
  semaforo: { color: string; etiqueta: string; claseTexto: string };
  subtitulo?: string;
  grande?: boolean;
}) {
  const TINTES: Record<string, string> = {
    verde: "border-emerald-500/30 bg-emerald-500/[0.06]",
    ambar: "border-amber-500/30 bg-amber-500/[0.06]",
    rojo: "border-red-500/30 bg-red-500/[0.06]",
  };
  const tinte = TINTES[semaforo.color] ?? "border-black/10 bg-tarjeta dark:border-white/10 dark:bg-tarjeta-dark";

  return (
    <div className={`border text-center ${tinte} ${grande ? "p-6" : "p-4"}`}>
      <p
        className={`mb-2 font-medium text-texto-suave dark:text-texto-suave-dark ${
          grande ? "text-sm" : "text-xs"
        }`}
      >
        {titulo}
      </p>
      <div
        className={`mx-auto mb-2 rounded-full ${grande ? "h-4 w-4" : "h-3 w-3"} ${
          semaforo.color === "verde"
            ? "bg-emerald-500"
            : semaforo.color === "ambar"
              ? "bg-amber-500"
              : semaforo.color === "rojo"
                ? "bg-red-500"
                : "bg-gray-400"
        }`}
      />
      <p className={`font-semibold ${semaforo.claseTexto} ${grande ? "text-xl" : "text-sm"}`}>
        {semaforo.etiqueta}
      </p>
      {subtitulo && (
        <p className="mt-1 text-xs text-texto-suave dark:text-texto-suave-dark">
          {subtitulo}
        </p>
      )}
    </div>
  );
}

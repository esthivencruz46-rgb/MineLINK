/** Tarjeta de un semáforo (Track Legal / Track Técnico) — compartida entre
 * /resultado y las ventanas de cuenta (MiCuenta/MiConcesion) para que el
 * minero vea el mismo lenguaje visual en todo el sitio. */
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
  return (
    <div
      className={`rounded-lg bg-tarjeta text-center dark:bg-tarjeta-dark ${
        grande ? "p-6" : "p-4"
      }`}
    >
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
      <p className={`font-bold ${semaforo.claseTexto} ${grande ? "text-xl" : "text-sm"}`}>
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

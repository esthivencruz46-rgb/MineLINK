import { useState } from "react";
import { BASE_URL } from "../../services/api";
import type { FotoPublica } from "../../types/proyecto";

/** Mosaico superior de la ficha (julio 2026): la parte ANCHA es la
 * ubicación en vista satelital y las celdas del costado son las fotos del
 * proyecto (mina, minerales...). Sin ubicación, las fotos ocupan todo el
 * rectángulo (layout anterior); sin nada, un placeholder compacto. */
export function GaleriaProyecto({
  fotos,
  ubicacionCoords,
}: {
  fotos: FotoPublica[];
  ubicacionCoords?: string | null;
}) {
  const [indiceAbierto, setIndiceAbierto] = useState<number | null>(null);

  if (fotos.length === 0 && !ubicacionCoords) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-black/10 bg-tarjeta text-sm text-texto-suave dark:border-white/10 dark:bg-tarjeta-dark dark:text-texto-suave-dark">
        Aún no hay fotos ni ubicación de este proyecto
      </div>
    );
  }

  const mapa = ubicacionCoords ? (
    <div className="h-full min-h-64 overflow-hidden rounded-lg shadow-sm md:min-h-96">
      <iframe
        title="Ubicación del proyecto (vista satelital)"
        src={`https://maps.google.com/maps?q=${ubicacionCoords}&z=15&t=k&output=embed`}
        className="h-full w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    </div>
  ) : null;

  const miniatura = (foto: FotoPublica, indice: number, alto: string) => (
    <button
      key={foto.id}
      onClick={() => setIndiceAbierto(indice)}
      className="group overflow-hidden rounded-lg shadow-sm transition duration-200"
    >
      <img
        src={`${BASE_URL}${foto.url}`}
        alt="Foto del proyecto"
        loading="lazy"
        className={`${alto} w-full object-cover transition duration-200 group-hover:scale-105`}
      />
    </button>
  );

  return (
    <>
      {mapa ? (
        // Rectángulo con la ubicación en la parte ancha + fotos al costado.
        fotos.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[7fr_3fr]">
            {mapa}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
              {fotos
                .slice(0, 2)
                .map((foto, i) => miniatura(foto, i, "h-32 md:h-[186px]"))}
            </div>
          </div>
        ) : (
          mapa
        )
      ) : (
        // Sin ubicación: las fotos ocupan todo el rectángulo.
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[7fr_3fr]">
          {miniatura(fotos[0], 0, "h-64 md:h-96")}
          {fotos.length > 1 && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
              {fotos
                .slice(1, 3)
                .map((foto, i) => miniatura(foto, i + 1, "h-32 md:h-[186px]"))}
            </div>
          )}
        </div>
      )}

      {indiceAbierto !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
          onClick={() => setIndiceAbierto(null)}
        >
          <img
            src={`${BASE_URL}${fotos[indiceAbierto].url}`}
            alt="Foto del proyecto"
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
          />
          <div className="mt-4 flex gap-2">
            {fotos.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setIndiceAbierto(i);
                }}
                className={`h-2 w-2 rounded-full ${i === indiceAbierto ? "bg-white" : "bg-white/40"}`}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

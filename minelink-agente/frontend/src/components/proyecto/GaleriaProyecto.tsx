import { useState } from "react";
import { BASE_URL } from "../../services/api";
import type { FotoPublica } from "../../types/proyecto";

export function GaleriaProyecto({ fotos }: { fotos: FotoPublica[] }) {
  const [indiceAbierto, setIndiceAbierto] = useState<number | null>(null);

  if (fotos.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-black/10 bg-tarjeta text-sm text-texto-suave dark:border-white/10 dark:bg-tarjeta-dark dark:text-texto-suave-dark">
        Aún no hay fotos de este proyecto
      </div>
    );
  }

  const principal = fotos[0];
  const secundarias = fotos.slice(1, 3);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[7fr_3fr]">
        <button
          onClick={() => setIndiceAbierto(0)}
          className="group overflow-hidden rounded-lg shadow-sm transition duration-200"
        >
          <img
            src={`${BASE_URL}${principal.url}`}
            alt="Foto principal del proyecto"
            className="h-64 w-full object-cover transition duration-200 group-hover:scale-105 md:h-96"
          />
        </button>
        {secundarias.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
            {secundarias.map((foto, i) => (
              <button
                key={foto.id}
                onClick={() => setIndiceAbierto(i + 1)}
                className="group overflow-hidden rounded-lg shadow-sm transition duration-200"
              >
                <img
                  src={`${BASE_URL}${foto.url}`}
                  alt="Foto del proyecto"
                  className="h-32 w-full object-cover transition duration-200 group-hover:scale-105 md:h-[186px]"
                />
              </button>
            ))}
          </div>
        )}
      </div>

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
